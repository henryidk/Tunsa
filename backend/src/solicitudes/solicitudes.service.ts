import { Injectable, ConflictException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { CreateSolicitudDto } from './dto/create-solicitud.dto';

type SolicitudConCliente = Prisma.SolicitudGetPayload<{ include: { cliente: true } }>;

// Shape mínima de un item para extraer equipoId sin asumir tipos extras
interface ItemConKind { kind: string; equipoId?: string }

@Injectable()
export class SolicitudesService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Devuelve los IDs de equipos que están en solicitudes PENDIENTE o APROBADA.
   * Usado para validar nuevas solicitudes y para exponer al frontend del encargado.
   */
  async getEquiposReservados(): Promise<string[]> {
    const activas = await this.prisma.solicitud.findMany({
      where:  { estado: { in: ['PENDIENTE', 'APROBADA'] } },
      select: { items: true },
    });

    const reservados = new Set<string>();
    for (const s of activas) {
      const items = s.items as unknown as ItemConKind[];
      for (const item of items) {
        if (item.kind === 'maquinaria' && item.equipoId) {
          reservados.add(item.equipoId);
        }
      }
    }

    return [...reservados];
  }

  async create(dto: CreateSolicitudDto, username: string) {
    const maquinariaIds = dto.items
      .filter((i): i is typeof i & { equipoId: string } =>
        i.kind === 'maquinaria' && !!i.equipoId,
      )
      .map(i => i.equipoId);

    if (maquinariaIds.length > 0) {
      const reservados = new Set(await this.getEquiposReservados());
      const conflictos = maquinariaIds.filter(id => reservados.has(id));

      if (conflictos.length > 0) {
        throw new ConflictException(
          'Uno o más equipos seleccionados ya están en una solicitud activa y no están disponibles.',
        );
      }
    }

    const solicitud = await this.prisma.solicitud.create({
      data: {
        clienteId:     dto.clienteId,
        items:         dto.items as object[],
        modalidad:     dto.modalidad,
        notas:         dto.notas,
        totalEstimado: dto.totalEstimado,
        creadaPor:     username,
      },
      include: { cliente: true },
    });
    return this.serialize(solicitud);
  }

  async findAll() {
    const solicitudes = await this.prisma.solicitud.findMany({
      include: { cliente: true },
      orderBy: { createdAt: 'desc' },
    });
    return solicitudes.map(s => this.serialize(s));
  }

  async findMias(username: string) {
    const solicitudes = await this.prisma.solicitud.findMany({
      where:   { creadaPor: username, estado: 'PENDIENTE' },
      include: { cliente: true },
      orderBy: { createdAt: 'desc' },
    });
    return solicitudes.map(s => this.serialize(s));
  }

  private serialize(s: SolicitudConCliente) {
    return {
      ...s,
      totalEstimado: parseFloat(s.totalEstimado.toString()),
    };
  }
}
