import {
  Injectable,
  NotFoundException,
  ConflictException,
  BadRequestException,
  ForbiddenException,
} from '@nestjs/common';
import { EstadoProyecto, Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { CreateProyectoDto } from './dto/create-proyecto.dto';
import { UpdateProyectoDto } from './dto/update-proyecto.dto';
import { AsignarProyectoDto } from './dto/asignar-proyecto.dto';
import type { AuthenticatedUser } from '../auth/interfaces/jwt-payload.interface';
import { tieneAccesoGlobal } from '../auth/utils/roles.util';

@Injectable()
export class ProyectosService {
  constructor(private readonly prisma: PrismaService) {}

  // ── Control de acceso ─────────────────────────────────────────────────────

  async checkAccesoProyecto(proyectoId: string, user: AuthenticatedUser): Promise<void> {
    if (tieneAccesoGlobal(user)) return;
    const asignacion = await this.prisma.proyectoEncargado.findUnique({
      where: { proyectoId_usuarioId: { proyectoId, usuarioId: user.id } },
    });
    if (!asignacion) throw new ForbiddenException('No tienes acceso a este proyecto.');
  }

  // ── Queries ──────────────────────────────────────────────────────────────

  async findAll(user: AuthenticatedUser, filtros?: { clienteId?: string; estado?: EstadoProyecto }) {
    const where: Prisma.ProyectoWhereInput = {};
    if (filtros?.clienteId) where.clienteId = filtros.clienteId;
    if (filtros?.estado)    where.estado    = filtros.estado;
    if (!tieneAccesoGlobal(user)) where.encargados = { some: { usuarioId: user.id } };

    const proyectos = await this.prisma.proyecto.findMany({
      where,
      orderBy: [{ estado: 'asc' }, { createdAt: 'desc' }],
      include: {
        cliente: { select: { id: true, nombre: true } },
        _count:  { select: { solicitudes: true } },
        solicitudes: {
          where:  { estado: { in: ['ACTIVA', 'APROBADA', 'PENDIENTE'] } },
          select: { id: true },
        },
      },
    });

    if (proyectos.length === 0) return [];

    const ids = proyectos.map(p => p.id);

    const [costosAgg, activeSols] = await Promise.all([
      this.prisma.solicitud.groupBy({
        by:    ['proyectoId'],
        where: { proyectoId: { in: ids }, totalFinal: { not: null } },
        _sum:  { totalFinal: true },
      }),
      this.prisma.solicitud.findMany({
        where:  { proyectoId: { in: ids }, estado: 'ACTIVA' },
        select: { proyectoId: true, items: true },
      }),
    ]);

    const costoMap   = new Map(costosAgg.map(r => [r.proyectoId, Number(r._sum.totalFinal ?? 0)]));
    const equiposMap = new Map<string, number>();
    for (const s of activeSols) {
      const items = (s.items as any[]) ?? [];
      const count = items.reduce((n: number, item: any) =>
        n + (item.kind === 'granel' ? (item.cantidad ?? 1) : 1), 0);
      equiposMap.set(s.proyectoId!, (equiposMap.get(s.proyectoId!) ?? 0) + count);
    }

    return proyectos.map(p => ({
      ...p,
      solicitudesActivas: p.solicitudes.length,
      solicitudes:        undefined,
      costoAcumulado:     costoMap.get(p.id)   ?? 0,
      equiposEnCampo:     equiposMap.get(p.id) ?? 0,
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

  async findSolicitudesDeProyecto(proyectoId: string, user: AuthenticatedUser) {
    await this.findOneConAcceso(proyectoId, user);

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

  async findOneConAcceso(id: string, user: AuthenticatedUser) {
    const proyecto = await this.findOne(id); // lanza 404
    await this.checkAccesoProyecto(id, user); // lanza 403
    return proyecto;
  }

  async create(dto: CreateProyectoDto, usuarioId: string, nombreUsuario: string, user: AuthenticatedUser) {
    const clienteExiste = await this.prisma.cliente.findUnique({
      where:  { id: dto.clienteId },
      select: { id: true },
    });
    if (!clienteExiste) {
      throw new NotFoundException(`Cliente ${dto.clienteId} no encontrado.`);
    }

    const idsAInsertar = this.buildEncargadosParaInsertar(dto, usuarioId, user);

    if (idsAInsertar.length > 0) {
      await Promise.all(idsAInsertar.map(id => this.validarRolEncargado(id)));
    }

    const id = await this.generarId();

    await this.prisma.$transaction(async (tx) => {
      await tx.proyecto.create({
        data: {
          id,
          nombre:      dto.nombre,
          descripcion: dto.descripcion ?? null,
          clienteId:   dto.clienteId,
          fechaInicio: new Date(),
          creadoPor:   nombreUsuario,
          creadoPorId: usuarioId,
        },
      });
      if (idsAInsertar.length > 0) {
        await tx.proyectoEncargado.createMany({
          data:           idsAInsertar.map(uid => ({ proyectoId: id, usuarioId: uid })),
          skipDuplicates: true,
        });
      }
    });

    return this.toResponse(id);
  }

  async getMisProyectos(user: AuthenticatedUser) {
    const esAdmin = ['admin', 'secretaria'].includes(user.role);
    return this.prisma.proyecto.findMany({
      where: {
        estado: 'ACTIVO',
        ...(esAdmin ? {} : {
          encargados: { some: { usuarioId: user.id } },
        }),
      },
      select: { id: true, nombre: true, clienteId: true },
      orderBy: { createdAt: 'desc' },
    });
  }

  async getEncargados(proyectoId: string) {
    const proyecto = await this.prisma.proyecto.findUnique({
      where:  { id: proyectoId },
      select: { creadoPorId: true },
    });

    const encargados = await this.prisma.proyectoEncargado.findMany({
      where: {
        proyectoId,
        usuario: { role: { nombre: 'encargado_maquinas' } },
      },
      include: { usuario: { select: { id: true, nombre: true } } },
      orderBy: { asignadoEn: 'asc' },
    });

    return encargados.map(e => ({
      usuarioId:  e.usuarioId,
      nombre:     e.usuario.nombre,
      asignadoEn: e.asignadoEn,
      esCreador:  e.usuarioId === proyecto?.creadoPorId,
    }));
  }

  async agregarEncargado(proyectoId: string, usuarioId: string) {
    await this.findOne(proyectoId);
    await this.validarRolEncargado(usuarioId);

    await this.prisma.proyectoEncargado.upsert({
      where:  { proyectoId_usuarioId: { proyectoId, usuarioId } },
      create: { proyectoId, usuarioId },
      update: {},
    });
    return this.getEncargados(proyectoId);
  }

  async quitarEncargado(proyectoId: string, usuarioId: string) {
    const proyecto = await this.prisma.proyecto.findUnique({
      where:  { id: proyectoId },
      select: { creadoPorId: true },
    });
    if (!proyecto) throw new NotFoundException(`Proyecto ${proyectoId} no encontrado.`);
    if (proyecto.creadoPorId === usuarioId) {
      throw new ConflictException('El creador no puede ser removido del proyecto.');
    }

    await this.prisma.proyectoEncargado.deleteMany({
      where: { proyectoId, usuarioId },
    });
    return this.getEncargados(proyectoId);
  }

  async update(id: string, dto: UpdateProyectoDto, user: AuthenticatedUser) {
    await this.findOneConAcceso(id, user);

    const data: Prisma.ProyectoUpdateInput = {};
    if (dto.nombre      !== undefined) data.nombre      = dto.nombre;
    if (dto.descripcion !== undefined) data.descripcion = dto.descripcion;

    await this.prisma.proyecto.update({ where: { id }, data });
    return this.toResponse(id);
  }

  async finalizar(id: string, user: AuthenticatedUser) {
    await this.findOneConAcceso(id, user);

    const rentasEnCurso = await this.prisma.solicitud.count({
      where: { proyectoId: id, estado: { in: ['PENDIENTE', 'APROBADA', 'ACTIVA'] } },
    });

    if (rentasEnCurso > 0) {
      throw new ConflictException(
        `No se puede finalizar el proyecto porque tiene ${rentasEnCurso} renta(s) activa(s) o en proceso.`,
      );
    }

    await this.prisma.proyecto.update({ where: { id }, data: { estado: 'FINALIZADO', fechaFin: new Date() } });
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

  async asignarSolicitud(solicitudId: string, dto: AsignarProyectoDto, user: AuthenticatedUser) {
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

    await this.checkAccesoProyecto(dto.proyectoId, user);

    await this.prisma.solicitud.update({
      where: { id: solicitudId },
      data:  { proyectoId: dto.proyectoId },
    });
  }

  // ── Helpers privados ─────────────────────────────────────────────────────

  private async toResponse(id: string) {
    const [p, costosAgg, activeSols] = await Promise.all([
      this.prisma.proyecto.findUniqueOrThrow({
        where: { id },
        include: {
          cliente:    { select: { id: true, nombre: true } },
          _count:     { select: { solicitudes: true } },
          solicitudes: {
            where:  { estado: { in: ['ACTIVA', 'APROBADA', 'PENDIENTE'] } },
            select: { id: true },
          },
        },
      }),
      this.prisma.solicitud.aggregate({
        where: { proyectoId: id, totalFinal: { not: null } },
        _sum:  { totalFinal: true },
      }),
      this.prisma.solicitud.findMany({
        where:  { proyectoId: id, estado: 'ACTIVA' },
        select: { items: true },
      }),
    ]);

    const costoAcumulado = Number(costosAgg._sum.totalFinal ?? 0);
    const equiposEnCampo = activeSols.reduce((sum, s) => {
      const items = (s.items as any[]) ?? [];
      return sum + items.reduce((n: number, item: any) =>
        n + (item.kind === 'granel' ? (item.cantidad ?? 1) : 1), 0);
    }, 0);

    return {
      ...p,
      solicitudesActivas: p.solicitudes.length,
      solicitudes:        undefined,
      costoAcumulado,
      equiposEnCampo,
    };
  }

  private buildEncargadosParaInsertar(
    dto:       CreateProyectoDto,
    usuarioId: string,
    user:      AuthenticatedUser,
  ): string[] {
    const ids = new Set<string>();
    if (tieneAccesoGlobal(user)) {
      (dto.encargadoIds ?? []).forEach(id => ids.add(id));
    } else {
      ids.add(usuarioId); // encargado: solo puede auto-asignarse
    }
    return [...ids];
  }

  private async validarRolEncargado(usuarioId: string): Promise<void> {
    const usuario = await this.prisma.usuario.findUnique({
      where:  { id: usuarioId },
      select: { role: { select: { nombre: true } } },
    });
    if (!usuario) throw new NotFoundException(`Usuario ${usuarioId} no encontrado.`);
    if (usuario.role.nombre !== 'encargado_maquinas') {
      throw new BadRequestException('Solo se pueden asignar encargados de máquinas a un proyecto.');
    }
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
