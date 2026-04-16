import { Injectable, ConflictException, NotFoundException, ForbiddenException, BadRequestException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { R2Service } from '../r2/r2.service';
import { CreateSolicitudDto } from './dto/create-solicitud.dto';
import { calcularFechaFinEstimada, calcularRecargoTotal } from './recargo.util';

type SolicitudConCliente = Prisma.SolicitudGetPayload<{ include: { cliente: true } }>;

// Shape mínima de un item para extraer equipoId sin asumir tipos extras
interface ItemConKind { kind: string; equipoId?: string }

// Shape mínima de un item para cálculos de tiempo y recargo
interface ItemParaCalculo { duracion: number; unidad: string; tarifa: number | null }

export interface RechazadasPage {
  data:       ReturnType<SolicitudesService['serialize']>[];
  nextCursor: string | null;
}

interface KeysetCursor { fechaDecision: string; id: string }

const PAGE_SIZE = 20;

const PDF_MAGIC_BYTES = Buffer.from([0x25, 0x50, 0x44, 0x46]); // %PDF

@Injectable()
export class SolicitudesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly r2:     R2Service,
  ) {}

  private buildComprobanteKey(clienteId: string, folio: string): string {
    return `clientes/${clienteId}/comprobantes/${folio}.pdf`;
  }

  private validatePdfBuffer(buffer: Buffer): void {
    if (buffer.length < 4 || !buffer.subarray(0, 4).equals(PDF_MAGIC_BYTES)) {
      throw new BadRequestException('El archivo no es un PDF válido.');
    }
  }

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
   * Orden: fechaDecision DESC, id DESC.
   * Cursor: { fechaDecision, id } codificado en base64.
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
        estado:        'RECHAZADA',
        fechaDecision: { gte: fechaDesde, lte: fechaHasta },
        ...(keysetClause && {
          OR: [
            { fechaDecision: { lt: keysetClause.fechaDecision } },
            { fechaDecision: keysetClause.fechaDecision, id: { lt: keysetClause.id } },
          ],
        }),
      },
      include: { cliente: true },
      orderBy: [{ fechaDecision: 'desc' }, { id: 'desc' }],
      take:    PAGE_SIZE + 1,
    });

    const hasMore    = solicitudes.length > PAGE_SIZE;
    const pageData   = hasMore ? solicitudes.slice(0, PAGE_SIZE) : solicitudes;
    const last       = pageData.at(-1);
    const nextCursor = hasMore && last
      ? this.encodeCursor({ fechaDecision: last.fechaDecision!.toISOString(), id: last.id })
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
   * Solicitudes ACTIVA del encargado autenticado que aún no han vencido.
   * Las rentascon fechaFinEstimada < now se consultan vía findVencidasMias().
   */
  async findActivasMias(username: string) {
    const now = new Date();
    const solicitudes = await this.prisma.solicitud.findMany({
      where: {
        creadaPor: username,
        estado:    'ACTIVA',
        OR: [
          { fechaFinEstimada: null },
          { fechaFinEstimada: { gte: now } },
        ],
      },
      include: { cliente: true },
      orderBy: { fechaEntrega: 'desc' },
    });
    return solicitudes.map(s => this.serialize(s));
  }

  /**
   * Solicitudes ACTIVA del encargado autenticado que ya superaron su fechaFinEstimada.
   * Estas requieren que el cliente devuelva el equipo — pueden tener recargo por atraso.
   */
  async findVencidasMias(username: string) {
    const now = new Date();
    const solicitudes = await this.prisma.solicitud.findMany({
      where: {
        creadaPor:        username,
        estado:           'ACTIVA',
        fechaFinEstimada: { lt: now },
      },
      include: { cliente: true },
      orderBy: { fechaFinEstimada: 'asc' },
    });
    return solicitudes.map(s => this.serialize(s));
  }

  /**
   * Registra la devolución de una renta vencida.
   * Calcula el recargo según los días de atraso y cierra la renta (DEVUELTA).
   * Solo el encargado que creó la solicitud puede registrar la devolución.
   */
  async registrarDevolucion(id: string, username: string) {
    const solicitud = await this.prisma.solicitud.findUnique({ where: { id } });

    if (!solicitud) throw new NotFoundException('Solicitud no encontrada.');
    if (solicitud.creadaPor !== username)
      throw new ForbiddenException('Solo el encargado que creó la solicitud puede registrar la devolución.');
    if (solicitud.estado !== 'ACTIVA')
      throw new ConflictException('Solo se puede registrar la devolución de rentas activas o vencidas.');
    if (!solicitud.fechaInicioRenta)
      throw new ConflictException('La solicitud no tiene fecha de inicio registrada.');

    const fechaDevolucion = new Date();
    const items = solicitud.items as unknown as ItemParaCalculo[];
    const recargo = calcularRecargoTotal(items, solicitud.fechaInicioRenta, fechaDevolucion);

    const actualizada = await this.prisma.solicitud.update({
      where:   { id },
      data:    {
        estado:          'DEVUELTA',
        fechaDevolucion,
        recargoTotal:    recargo,
      },
      include: { cliente: true },
    });
    return this.serialize(actualizada);
  }

  /**
   * Paginación keyset sobre las solicitudes RECHAZADA del encargado autenticado,
   * filtradas por rango de fecha (fechaDecision = momento del rechazo).
   *
   * Usa el índice compuesto (creadaPor, estado, fechaDecision, id) para seeks O(log n).
   */
  async findHistorialMias(
    username: string,
    params: { fechaDesde: Date; fechaHasta: Date; cursor?: string },
  ): Promise<RechazadasPage> {
    const { fechaDesde, fechaHasta, cursor } = params;
    const keysetClause = cursor ? this.decodeCursor(cursor) : null;

    const solicitudes = await this.prisma.solicitud.findMany({
      where: {
        creadaPor:     username,
        estado:        'RECHAZADA',
        fechaDecision: { gte: fechaDesde, lte: fechaHasta },
        ...(keysetClause && {
          OR: [
            { fechaDecision: { lt: keysetClause.fechaDecision } },
            { fechaDecision: keysetClause.fechaDecision, id: { lt: keysetClause.id } },
          ],
        }),
      },
      include: { cliente: true },
      orderBy: [{ fechaDecision: 'desc' }, { id: 'desc' }],
      take:    PAGE_SIZE + 1,
    });

    const hasMore    = solicitudes.length > PAGE_SIZE;
    const pageData   = hasMore ? solicitudes.slice(0, PAGE_SIZE) : solicitudes;
    const last       = pageData.at(-1);
    const nextCursor = hasMore && last
      ? this.encodeCursor({ fechaDecision: last.fechaDecision!.toISOString(), id: last.id })
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
        data:    { estado: 'APROBADA', aprobadaPor, folio, fechaDecision: now },
        include: { cliente: true },
      });

      return this.serialize(solicitud);
    });
  }

  async rechazar(id: string, motivoRechazo: string) {
    const solicitud = await this.prisma.solicitud.update({
      where:   { id },
      data:    { estado: 'RECHAZADA', motivoRechazo, fechaDecision: new Date() },
      include: { cliente: true },
    });
    return this.serialize(solicitud);
  }

  /**
   * Registra el inicio oficial de la renta: graba fechaInicioRenta = now() la primera
   * vez que el encargado genera el comprobante. Si ya está fijada, devuelve la solicitud
   * sin modificarla — la fecha de inicio es inmutable una vez establecida.
   */
  async iniciarEntrega(id: string, username: string) {
    const solicitud = await this.prisma.solicitud.findUnique({ where: { id } });

    if (!solicitud) throw new NotFoundException('Solicitud no encontrada.');
    if (solicitud.creadaPor !== username)
      throw new ForbiddenException('Solo el encargado que creó la solicitud puede iniciar la entrega.');
    if (solicitud.estado !== 'APROBADA')
      throw new ConflictException('Solo se puede iniciar la entrega de solicitudes aprobadas.');

    // Inmutable: si ya se fijó, devolver sin modificar
    if (solicitud.fechaInicioRenta) {
      const actual = await this.prisma.solicitud.findUnique({
        where: { id }, include: { cliente: true },
      });
      return this.serialize(actual!);
    }

    const actualizada = await this.prisma.solicitud.update({
      where:   { id },
      data:    { fechaInicioRenta: new Date() },
      include: { cliente: true },
    });
    return this.serialize(actualizada);
  }

  /**
   * Confirma la entrega física: APROBADA → ACTIVA.
   * Sube el comprobante PDF firmado a R2 y guarda la key en la solicitud.
   * Solo el encargado que creó la solicitud puede confirmarla.
   */
  async confirmarEntrega(
    id:       string,
    buffer:   Buffer,
    mimetype: string,
    username: string,
  ) {
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
    if (!solicitud.folio) {
      throw new ConflictException('La solicitud no tiene folio asignado.');
    }

    this.validatePdfBuffer(buffer);

    const key = this.buildComprobanteKey(solicitud.clienteId, solicitud.folio);
    await this.r2.uploadFile(key, buffer, mimetype);

    const fechaEntrega   = new Date();
    const fechaInicio    = solicitud.fechaInicioRenta ?? fechaEntrega;
    const items          = solicitud.items as unknown as ItemParaCalculo[];
    const fechaFinEstimada = calcularFechaFinEstimada(fechaInicio, items);

    const actualizada = await this.prisma.solicitud.update({
      where:   { id },
      data:    { estado: 'ACTIVA', comprobanteKey: key, fechaEntrega, fechaFinEstimada },
      include: { cliente: true },
    });
    return this.serialize(actualizada);
  }

  /**
   * Genera una URL firmada temporal (15 min) para descargar el comprobante.
   */
  async getComprobanteUrl(id: string, username: string): Promise<{ url: string }> {
    const solicitud = await this.prisma.solicitud.findUnique({ where: { id } });

    if (!solicitud) {
      throw new NotFoundException('Solicitud no encontrada.');
    }
    if (!solicitud.comprobanteKey) {
      throw new NotFoundException('Esta solicitud no tiene comprobante subido.');
    }

    const url = await this.r2.getPresignedUrl(solicitud.comprobanteKey);
    return { url };
  }

  // ── Helpers internos ────────────────────────────────────────────────────────

  private encodeCursor(cursor: KeysetCursor): string {
    return Buffer.from(JSON.stringify(cursor)).toString('base64');
  }

  private decodeCursor(raw: string): { fechaDecision: Date; id: string } {
    const parsed = JSON.parse(Buffer.from(raw, 'base64').toString('utf8')) as KeysetCursor;
    return { fechaDecision: new Date(parsed.fechaDecision), id: parsed.id };
  }

  serialize(s: SolicitudConCliente) {
    return {
      ...s,
      totalEstimado: parseFloat(s.totalEstimado.toString()),
      recargoTotal:  s.recargoTotal != null ? parseFloat(s.recargoTotal.toString()) : null,
    };
  }
}
