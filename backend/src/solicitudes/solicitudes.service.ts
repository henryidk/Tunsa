import { Injectable, ConflictException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { CreateSolicitudDto } from './dto/create-solicitud.dto';

type SolicitudConCliente = Prisma.SolicitudGetPayload<{ include: { cliente: true } }>;

// Shape mínima de un item para extraer equipoId sin asumir tipos extras
interface ItemConKind { kind: string; equipoId?: string }

export interface RechazadasPage {
  data:       ReturnType<SolicitudesService['serialize']>[];
  nextCursor: string | null;
}

interface KeysetCursor { updatedAt: string; id: string }

const PAGE_SIZE = 20;

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

  /**
   * Solo devuelve PENDIENTE y APROBADA — las solicitudes activas que el admin gestiona.
   * RECHAZADA se consulta aparte vía findRechazadas() con paginación keyset.
   */
  async findAll() {
    const solicitudes = await this.prisma.solicitud.findMany({
      where:   { estado: { in: ['PENDIENTE', 'APROBADA'] } },
      include: { cliente: true },
      orderBy: { createdAt: 'desc' },
    });
    return solicitudes.map(s => this.serialize(s));
  }

  /**
   * Paginación keyset sobre solicitudes RECHAZADA filtradas por rango de fecha.
   *
   * Orden: updatedAt DESC, id DESC (updatedAt = momento del rechazo).
   * Cursor: { updatedAt, id } codificado en base64 — apunta al último registro
   * de la página anterior para que la siguiente consulta salte directamente
   * al siguiente registro sin escanear filas previas.
   *
   * Se solicita PAGE_SIZE + 1 registros; si devuelve PAGE_SIZE + 1 existe
   * una página siguiente y se construye el nextCursor con el último registro
   * devuelto (el elemento extra que no se incluye en data).
   */
  async findRechazadas(params: {
    fechaDesde: Date;
    fechaHasta: Date;
    cursor?:    string;
  }): Promise<RechazadasPage> {
    const { fechaDesde, fechaHasta, cursor } = params;

    const keysetClause = cursor ? this.decodeCursor(cursor) : null;

    const solicitudes = await this.prisma.solicitud.findMany({
      where: {
        estado:    'RECHAZADA',
        updatedAt: { gte: fechaDesde, lte: fechaHasta },
        ...(keysetClause && {
          OR: [
            { updatedAt: { lt: keysetClause.updatedAt } },
            { updatedAt: keysetClause.updatedAt, id: { lt: keysetClause.id } },
          ],
        }),
      },
      include: { cliente: true },
      orderBy: [{ updatedAt: 'desc' }, { id: 'desc' }],
      take:    PAGE_SIZE + 1,
    });

    const hasMore   = solicitudes.length > PAGE_SIZE;
    const pageData  = hasMore ? solicitudes.slice(0, PAGE_SIZE) : solicitudes;
    const last      = pageData.at(-1);
    const nextCursor = hasMore && last
      ? this.encodeCursor({ updatedAt: last.updatedAt.toISOString(), id: last.id })
      : null;

    return { data: pageData.map(s => this.serialize(s)), nextCursor };
  }

  async findMias(username: string) {
    const solicitudes = await this.prisma.solicitud.findMany({
      where:   { creadaPor: username, estado: 'PENDIENTE' },
      include: { cliente: true },
      orderBy: { createdAt: 'desc' },
    });
    return solicitudes.map(s => this.serialize(s));
  }

  /**
   * Paginación keyset sobre las solicitudes RECHAZADA del encargado autenticado,
   * filtradas por rango de fecha (updatedAt = momento del rechazo).
   *
   * Usa el índice compuesto (creadaPor, estado, updatedAt, id) para seeks O(log n)
   * independientemente del volumen acumulado de rechazadas por usuario.
   */
  async findHistorialMias(
    username: string,
    params: { fechaDesde: Date; fechaHasta: Date; cursor?: string },
  ): Promise<RechazadasPage> {
    const { fechaDesde, fechaHasta, cursor } = params;
    const keysetClause = cursor ? this.decodeCursor(cursor) : null;

    const solicitudes = await this.prisma.solicitud.findMany({
      where: {
        creadaPor: username,
        estado:    'RECHAZADA',
        updatedAt: { gte: fechaDesde, lte: fechaHasta },
        ...(keysetClause && {
          OR: [
            { updatedAt: { lt: keysetClause.updatedAt } },
            { updatedAt: keysetClause.updatedAt, id: { lt: keysetClause.id } },
          ],
        }),
      },
      include: { cliente: true },
      orderBy: [{ updatedAt: 'desc' }, { id: 'desc' }],
      take:    PAGE_SIZE + 1,
    });

    const hasMore    = solicitudes.length > PAGE_SIZE;
    const pageData   = hasMore ? solicitudes.slice(0, PAGE_SIZE) : solicitudes;
    const last       = pageData.at(-1);
    const nextCursor = hasMore && last
      ? this.encodeCursor({ updatedAt: last.updatedAt.toISOString(), id: last.id })
      : null;

    return { data: pageData.map(s => this.serialize(s)), nextCursor };
  }

  async rechazar(id: string, motivoRechazo: string) {
    const solicitud = await this.prisma.solicitud.update({
      where:   { id },
      data:    { estado: 'RECHAZADA', motivoRechazo },
      include: { cliente: true },
    });
    return this.serialize(solicitud);
  }

  // ── Helpers internos ────────────────────────────────────────────────────────

  private encodeCursor(cursor: KeysetCursor): string {
    return Buffer.from(JSON.stringify(cursor)).toString('base64');
  }

  private decodeCursor(raw: string): { updatedAt: Date; id: string } {
    const parsed = JSON.parse(Buffer.from(raw, 'base64').toString('utf8')) as KeysetCursor;
    return { updatedAt: new Date(parsed.updatedAt), id: parsed.id };
  }

  serialize(s: SolicitudConCliente) {
    return {
      ...s,
      totalEstimado: parseFloat(s.totalEstimado.toString()),
    };
  }
}
