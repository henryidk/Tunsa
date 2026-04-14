import { Injectable, ConflictException, NotFoundException, ForbiddenException } from '@nestjs/common';
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
   * Devuelve los IDs de equipos bloqueados: PENDIENTE, APROBADA o ACTIVA.
   * Un equipo en renta activa sigue ocupado hasta que la renta finalice.
   */
  async getEquiposReservados(): Promise<string[]> {
    const activas = await this.prisma.solicitud.findMany({
      where:  { estado: { in: ['PENDIENTE', 'APROBADA', 'ACTIVA'] } },
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
      where:   { creadaPor: username, estado: { in: ['PENDIENTE', 'APROBADA'] } },
      include: { cliente: true },
      orderBy: { createdAt: 'desc' },
    });
    return solicitudes.map(s => this.serialize(s));
  }

  /**
   * Todas las solicitudes en estado ACTIVA — vista del admin/secretaria.
   */
  async findActivas() {
    const solicitudes = await this.prisma.solicitud.findMany({
      where:   { estado: 'ACTIVA' },
      include: { cliente: true },
      orderBy: { fechaEntrega: 'desc' },
    });
    return solicitudes.map(s => this.serialize(s));
  }

  /**
   * Solicitudes ACTIVA del encargado autenticado — su propia vista de rentas en curso.
   */
  async findActivasMias(username: string) {
    const solicitudes = await this.prisma.solicitud.findMany({
      where:   { creadaPor: username, estado: 'ACTIVA' },
      include: { cliente: true },
      orderBy: { fechaEntrega: 'desc' },
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

  async aprobar(id: string, aprobadaPor: string) {
    return this.prisma.$transaction(async (tx) => {
      const now     = new Date();
      const mesAnio = `${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, '0')}`;

      // Incremento atómico del contador mensual — INSERT ... ON CONFLICT DO UPDATE
      const secuencia = await tx.folioSecuencia.upsert({
        where:  { mesAnio },
        create: { mesAnio, ultimo: 1 },
        update: { ultimo: { increment: 1 } },
      });

      const folio = `${mesAnio}-${String(secuencia.ultimo).padStart(4, '0')}`;

      const solicitud = await tx.solicitud.update({
        where:   { id },
        data:    { estado: 'APROBADA', aprobadaPor, folio },
        include: { cliente: true },
      });

      return this.serialize(solicitud);
    });
  }

  async rechazar(id: string, motivoRechazo: string) {
    const solicitud = await this.prisma.solicitud.update({
      where:   { id },
      data:    { estado: 'RECHAZADA', motivoRechazo },
      include: { cliente: true },
    });
    return this.serialize(solicitud);
  }

  /**
   * Confirma la entrega física: APROBADA → ACTIVA.
   * Solo el encargado que creó la solicitud puede confirmarla.
   */
  async confirmarEntrega(id: string, firmaCliente: string, username: string) {
    const solicitud = await this.prisma.solicitud.findUnique({ where: { id } });

    if (!solicitud) {
      throw new NotFoundException('Solicitud no encontrada.');
    }
    if (solicitud.creadaPor !== username) {
      throw new ForbiddenException('Solo el encargado que creó la solicitud puede confirmar la entrega.');
    }
    if (solicitud.estado !== 'APROBADA') {
      throw new ConflictException('Solo se puede confirmar la entrega de solicitudes aprobadas.');
    }

    const actualizada = await this.prisma.solicitud.update({
      where:   { id },
      data:    { estado: 'ACTIVA', firmaCliente, fechaEntrega: new Date() },
      include: { cliente: true },
    });
    return this.serialize(actualizada);
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
