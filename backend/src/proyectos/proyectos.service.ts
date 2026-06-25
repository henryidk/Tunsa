import {
  Injectable,
  NotFoundException,
  ConflictException,
  BadRequestException,
} from '@nestjs/common';
import { EstadoProyecto, Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { CreateProyectoDto } from './dto/create-proyecto.dto';
import { UpdateProyectoDto } from './dto/update-proyecto.dto';
import { AsignarProyectoDto } from './dto/asignar-proyecto.dto';

@Injectable()
export class ProyectosService {
  constructor(private readonly prisma: PrismaService) {}

  // ── Queries ──────────────────────────────────────────────────────────────

  async findAll(filtros?: { clienteId?: string; estado?: EstadoProyecto }) {
    const where: Prisma.ProyectoWhereInput = {};
    if (filtros?.clienteId) where.clienteId = filtros.clienteId;
    if (filtros?.estado)    where.estado    = filtros.estado;

    const proyectos = await this.prisma.proyecto.findMany({
      where,
      orderBy: [{ estado: 'asc' }, { createdAt: 'desc' }],
      include: {
        cliente: { select: { id: true, nombre: true } },
        _count:  { select: { solicitudes: true } },
        // Cuenta cuántas rentas están en curso sin cargar los registros completos
        solicitudes: {
          where:  { estado: { in: ['ACTIVA', 'APROBADA', 'PENDIENTE'] } },
          select: { id: true },
        },
      },
    });

    return proyectos.map(p => ({
      ...p,
      solicitudesActivas: p.solicitudes.length,
      solicitudes:        undefined, // no exponer el array al cliente
    }));
  }

  async findByCliente(clienteId: string) {
    return this.prisma.proyecto.findMany({
      where:   { clienteId, estado: 'ACTIVO' },
      orderBy: { createdAt: 'desc' },
      select:  { id: true, nombre: true },
    });
  }

  async findOne(id: string) {
    const proyecto = await this.prisma.proyecto.findUnique({
      where:   { id },
      include: { cliente: { select: { id: true, nombre: true } } },
    });
    if (!proyecto) throw new NotFoundException(`Proyecto ${id} no encontrado.`);
    return proyecto;
  }

  async findSolicitudesDeProyecto(proyectoId: string) {
    await this.findOne(proyectoId); // lanza 404 si no existe

    const [enProceso, activas, vencidas, devueltas] = await Promise.all([
      this.prisma.solicitud.findMany({
        where:   { proyectoId, estado: { in: ['PENDIENTE', 'APROBADA'] } },
        include: { cliente: true, proyecto: { select: { id: true, nombre: true } } },
        orderBy: { createdAt: 'desc' },
      }),
      this.prisma.solicitud.findMany({
        where: {
          proyectoId,
          estado: 'ACTIVA',
          OR: [{ fechaFinEstimada: null }, { fechaFinEstimada: { gte: new Date() } }],
        },
        include: {
          cliente:  true,
          proyecto: { select: { id: true, nombre: true } },
          lecturas: { orderBy: { fecha: 'desc' }, take: 1 },
        },
        orderBy: { fechaFinEstimada: 'asc' },
      }),
      this.prisma.solicitud.findMany({
        where: {
          proyectoId,
          estado: 'ACTIVA',
          fechaFinEstimada: { lt: new Date() },
        },
        include: {
          cliente:  true,
          proyecto: { select: { id: true, nombre: true } },
          lecturas: { orderBy: { fecha: 'desc' }, take: 1 },
        },
        orderBy: { fechaFinEstimada: 'asc' },
      }),
      this.prisma.solicitud.findMany({
        where:   { proyectoId, estado: 'DEVUELTA' },
        include: { cliente: true, proyecto: { select: { id: true, nombre: true } } },
        orderBy: { fechaUltimaDevolucion: 'desc' },
        take:    30,
      }),
    ]);

    return { enProceso, activas, vencidas, devueltas };
  }

  // ── Mutaciones ───────────────────────────────────────────────────────────

  async create(dto: CreateProyectoDto, creadoPor: string) {
    const clienteExiste = await this.prisma.cliente.findUnique({
      where:  { id: dto.clienteId },
      select: { id: true },
    });
    if (!clienteExiste) {
      throw new NotFoundException(`Cliente ${dto.clienteId} no encontrado.`);
    }

    const id = await this.generarId();

    await this.prisma.proyecto.create({
      data: {
        id,
        nombre:      dto.nombre,
        descripcion: dto.descripcion ?? null,
        clienteId:   dto.clienteId,
        fechaInicio: new Date(dto.fechaInicio),
        fechaFin:    dto.fechaFin ? new Date(dto.fechaFin) : null,
        creadoPor,
      },
    });
    return this.toResponse(id);
  }

  async update(id: string, dto: UpdateProyectoDto) {
    await this.findOne(id);

    const data: Prisma.ProyectoUpdateInput = {};
    if (dto.nombre      !== undefined) data.nombre      = dto.nombre;
    if (dto.descripcion !== undefined) data.descripcion = dto.descripcion;
    if (dto.fechaInicio !== undefined) data.fechaInicio = new Date(dto.fechaInicio);
    if (dto.fechaFin    !== undefined) data.fechaFin    = dto.fechaFin ? new Date(dto.fechaFin) : null;

    await this.prisma.proyecto.update({ where: { id }, data });
    return this.toResponse(id);
  }

  async finalizar(id: string) {
    await this.findOne(id);

    const rentasEnCurso = await this.prisma.solicitud.count({
      where: { proyectoId: id, estado: { in: ['PENDIENTE', 'APROBADA', 'ACTIVA'] } },
    });

    if (rentasEnCurso > 0) {
      throw new ConflictException(
        `No se puede finalizar el proyecto porque tiene ${rentasEnCurso} renta(s) activa(s) o en proceso.`,
      );
    }

    await this.prisma.proyecto.update({ where: { id }, data: { estado: 'FINALIZADO' } });
    return this.toResponse(id);
  }

  async reactivar(id: string) {
    const proyecto = await this.findOne(id);

    if (proyecto.estado === 'ACTIVO') {
      throw new BadRequestException('El proyecto ya está activo.');
    }

    await this.prisma.proyecto.update({ where: { id }, data: { estado: 'ACTIVO' } });
    return this.toResponse(id);
  }

  async asignarSolicitud(solicitudId: string, dto: AsignarProyectoDto) {
    const solicitud = await this.prisma.solicitud.findUnique({
      where:  { id: solicitudId },
      select: { id: true, estado: true, clienteId: true, proyectoId: true },
    });

    if (!solicitud) {
      throw new NotFoundException(`Solicitud ${solicitudId} no encontrada.`);
    }
    if (solicitud.estado !== 'ACTIVA') {
      throw new BadRequestException('Solo se puede asignar un proyecto a una renta activa.');
    }
    if (solicitud.proyectoId !== null) {
      throw new ConflictException('Esta renta ya tiene un proyecto asignado.');
    }

    const proyecto = await this.prisma.proyecto.findUnique({
      where:  { id: dto.proyectoId },
      select: { id: true, clienteId: true, estado: true },
    });

    if (!proyecto) {
      throw new NotFoundException(`Proyecto ${dto.proyectoId} no encontrado.`);
    }
    if (proyecto.estado !== 'ACTIVO') {
      throw new BadRequestException('Solo se pueden asignar proyectos activos.');
    }
    if (proyecto.clienteId !== solicitud.clienteId) {
      throw new BadRequestException('El proyecto no pertenece al mismo cliente de la renta.');
    }

    await this.prisma.solicitud.update({
      where: { id: solicitudId },
      data:  { proyectoId: dto.proyectoId },
    });
  }

  // ── Helpers privados ─────────────────────────────────────────────────────

  private async toResponse(id: string) {
    const p = await this.prisma.proyecto.findUniqueOrThrow({
      where: { id },
      include: {
        cliente:    { select: { id: true, nombre: true } },
        _count:     { select: { solicitudes: true } },
        solicitudes: {
          where:  { estado: { in: ['ACTIVA', 'APROBADA', 'PENDIENTE'] } },
          select: { id: true },
        },
      },
    });
    return { ...p, solicitudesActivas: p.solicitudes.length, solicitudes: undefined };
  }

  private async generarId(): Promise<string> {
    const ultimo = await this.prisma.proyecto.findFirst({
      orderBy: { id: 'desc' },
      select:  { id: true },
    });

    let siguiente = 1;
    if (ultimo) {
      const match = ultimo.id.match(/^PROY-(\d+)$/);
      if (match) siguiente = parseInt(match[1], 10) + 1;
    }

    let intentos = 0;
    let id: string;
    do {
      id = `PROY-${String(siguiente).padStart(4, '0')}`;
      const existe = await this.prisma.proyecto.findUnique({ where: { id }, select: { id: true } });
      if (!existe) break;
      siguiente++;
      intentos++;
    } while (intentos < 100);

    return id!;
  }
}
