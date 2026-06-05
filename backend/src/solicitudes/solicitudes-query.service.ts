import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { serializeSolicitud, SolicitudConCliente, RechazadasPage } from './solicitudes.serializer';
import type { DevolucionEntry } from './recargo.util';
import { tieneEquipoId, type ItemConKind } from './solicitudes.types';

interface KeysetCursor    { fechaDecision:         string; id: string }
interface HistorialCursor { fechaUltimaDevolucion: string; id: string }

const PAGE_SIZE = 20;

@Injectable()
export class SolicitudesQueryService {
  constructor(private readonly prisma: PrismaService) {}

  private encargadoFilter(username: string) {
    return { OR: [{ creadaPor: username }, { gestionadaPor: username }] };
  }

  private async buildNombresMap(usernames: string[]): Promise<Map<string, string>> {
    if (usernames.length === 0) return new Map();
    const usuarios = await this.prisma.usuario.findMany({
      where:  { username: { in: usernames } },
      select: { username: true, nombre: true },
    });
    return new Map(usuarios.map(u => [u.username, u.nombre]));
  }

  /**
   * Devuelve los IDs de equipos bloqueados: PENDIENTE, APROBADA o ACTIVA.
   * Un equipo en renta activa sigue ocupado hasta que la renta finalice.
   */
  async getEquiposReservados(): Promise<string[]> {
    const activas = await this.prisma.solicitud.findMany({
      where:  { estado: { in: ['PENDIENTE', 'APROBADA', 'ACTIVA'] } },
      select: { items: true, devolucionesParciales: true },
    });

    const reservados = new Set<string>();
    for (const s of activas) {
      const devoluciones = (s.devolucionesParciales as unknown as DevolucionEntry[]) ?? [];
      const yaDevueltos  = new Set<string>(
        devoluciones.flatMap(d => d.items.map(i => i.itemRef)),
      );
      const items = s.items as unknown as ItemConKind[];
      for (const item of items) {
        if (tieneEquipoId(item.kind) && item.equipoId && !yaDevueltos.has(item.equipoId)) {
          reservados.add(item.equipoId);
        }
      }
    }

    return [...reservados];
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
    const nombres = await this.buildNombresMap(solicitudes.map(s => s.creadaPor));
    return solicitudes.map(s => serializeSolicitud(s, { creador: nombres.get(s.creadaPor) }));
  }

  async findMias(username: string) {
    const solicitudes = await this.prisma.solicitud.findMany({
      where: {
        AND: [
          this.encargadoFilter(username),
          { estado: { in: ['PENDIENTE', 'APROBADA'] } },
        ],
      },
      include: { cliente: true },
      orderBy: { createdAt: 'desc' },
    });
    return solicitudes.map(s => serializeSolicitud(s));
  }

  async findVencidas() {
    const now = new Date();
    const solicitudes = await this.prisma.solicitud.findMany({
      where:   { estado: 'ACTIVA', fechaFinEstimada: { lt: now } },
      include: { cliente: true, lecturas: { orderBy: { fecha: 'desc' }, take: 1 } },
      orderBy: { fechaFinEstimada: 'asc' },
    });
    const nombres = await this.buildNombresMap(solicitudes.map(s => s.creadaPor));
    return solicitudes.map(s => serializeSolicitud(s as SolicitudConCliente, { creador: nombres.get(s.creadaPor) }));
  }

  async findActivas() {
    const now = new Date();
    const solicitudes = await this.prisma.solicitud.findMany({
      where: {
        estado: 'ACTIVA',
        OR: [{ fechaFinEstimada: null }, { fechaFinEstimada: { gte: now } }],
      },
      include: { cliente: true, lecturas: { orderBy: { fecha: 'desc' }, take: 1 } },
      orderBy: { fechaEntrega: 'desc' },
    });
    const nombres = await this.buildNombresMap(solicitudes.map(s => s.creadaPor));
    return solicitudes.map(s => serializeSolicitud(s as SolicitudConCliente, { creador: nombres.get(s.creadaPor) }));
  }

  async getDashboardStatsEncargado(username: string) {
    const now       = new Date();
    const inicioMes = new Date(now.getFullYear(), now.getMonth(), 1);

    const [pendientes, activas, vencidas, solicitudesEsteMes] = await this.prisma.$transaction([
      this.prisma.solicitud.count({
        where: { creadaPor: username, estado: { in: ['PENDIENTE', 'APROBADA'] } },
      }),
      this.prisma.solicitud.count({
        where: {
          AND: [
            this.encargadoFilter(username),
            { estado: 'ACTIVA', OR: [{ fechaFinEstimada: null }, { fechaFinEstimada: { gte: now } }] },
          ],
        },
      }),
      this.prisma.solicitud.count({
        where: { ...this.encargadoFilter(username), estado: 'ACTIVA', fechaFinEstimada: { lt: now } },
      }),
      this.prisma.solicitud.count({
        where: { creadaPor: username, createdAt: { gte: inicioMes } },
      }),
    ]);

    const recaudacion = await this.prisma.recaudacionMensual.findUnique({
      where: { encargado_anio_mes: { encargado: username, anio: now.getFullYear(), mes: now.getMonth() + 1 } },
    });

    const pesadaRecaudadaMes  = recaudacion ? Number(recaudacion.pesada)  : 0;
    const livianaRecaudadaMes = recaudacion ? Number(recaudacion.liviana) : 0;

    return { pendientes, activas, vencidas, solicitudesEsteMes, pesadaRecaudadaMes, livianaRecaudadaMes };
  }

  async getDashboardStatsGlobal() {
    const now       = new Date();
    const inicioMes = new Date(now.getFullYear(), now.getMonth(), 1);

    const [pendientes, activas, vencidas, solicitudesEsteMes, recaudacionAgg] = await this.prisma.$transaction([
      this.prisma.solicitud.count({
        where: { estado: { in: ['PENDIENTE', 'APROBADA'] } },
      }),
      this.prisma.solicitud.count({
        where: {
          estado: 'ACTIVA',
          OR: [{ fechaFinEstimada: null }, { fechaFinEstimada: { gte: now } }],
        },
      }),
      this.prisma.solicitud.count({
        where: { estado: 'ACTIVA', fechaFinEstimada: { lt: now } },
      }),
      this.prisma.solicitud.count({
        where: { createdAt: { gte: inicioMes } },
      }),
      this.prisma.recaudacionMensual.aggregate({
        where: { anio: now.getFullYear(), mes: now.getMonth() + 1 },
        _sum:  { pesada: true, liviana: true },
      }),
    ]);

    const pesadaRecaudadaMes  = Number(recaudacionAgg._sum.pesada  ?? 0);
    const livianaRecaudadaMes = Number(recaudacionAgg._sum.liviana ?? 0);

    return { pendientes, activas, vencidas, solicitudesEsteMes, pesadaRecaudadaMes, livianaRecaudadaMes };
  }

  async backfillRecaudacion() {
    const devueltas = await this.prisma.solicitud.findMany({
      where:  { estado: 'DEVUELTA', fechaDevolucion: { not: null } },
      select: { creadaPor: true, fechaDevolucion: true, totalFinal: true, items: true },
    });

    const esPesada = (items: unknown) =>
      (items as Array<{ kind: string }>).some(i => i.kind === 'pesada');

    const map = new Map<string, { encargado: string; anio: number; mes: number; pesada: number; liviana: number }>();

    for (const s of devueltas) {
      const fecha = s.fechaDevolucion!;
      const anio  = fecha.getFullYear();
      const mes   = fecha.getMonth() + 1;
      const key   = `${s.creadaPor}:${anio}:${mes}`;
      const total = Number(s.totalFinal) || 0;
      const tipo  = esPesada(s.items) ? 'pesada' : 'liviana';

      if (!map.has(key)) {
        map.set(key, { encargado: s.creadaPor, anio, mes, pesada: 0, liviana: 0 });
      }
      map.get(key)![tipo] += total;
    }

    for (const entry of map.values()) {
      await this.prisma.recaudacionMensual.upsert({
        where:  { encargado_anio_mes: { encargado: entry.encargado, anio: entry.anio, mes: entry.mes } },
        create: entry,
        update: { pesada: entry.pesada, liviana: entry.liviana },
      });
    }

    return { solicitudesProcesadas: devueltas.length, registrosGenerados: map.size };
  }

  async findActivasMias(username: string) {
    const startOfToday = new Date();
    startOfToday.setUTCHours(0, 0, 0, 0);
    const solicitudes = await this.prisma.solicitud.findMany({
      where: {
        AND: [
          this.encargadoFilter(username),
          { estado: 'ACTIVA', OR: [{ fechaFinEstimada: null }, { fechaFinEstimada: { gte: startOfToday } }] },
        ],
      },
      include: {
        cliente:  true,
        lecturas: { orderBy: { fecha: 'desc' }, take: 1 },
      },
      orderBy: { fechaEntrega: 'desc' },
    });
    return solicitudes.map(s => serializeSolicitud(s as SolicitudConCliente));
  }

  async findVencidasMias(username: string) {
    const startOfToday = new Date();
    startOfToday.setUTCHours(0, 0, 0, 0);
    const solicitudes = await this.prisma.solicitud.findMany({
      where: {
        ...this.encargadoFilter(username),
        estado:           'ACTIVA',
        fechaFinEstimada: { lt: startOfToday },
      },
      include: { cliente: true, lecturas: { orderBy: { fecha: 'desc' }, take: 1 } },
      orderBy: { fechaFinEstimada: 'asc' },
    });
    return solicitudes.map(s => serializeSolicitud(s as SolicitudConCliente));
  }

  /**
   * Paginación keyset sobre solicitudes RECHAZADA filtradas por rango de fecha.
   * Orden: fechaDecision DESC, id DESC.
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

    return { data: pageData.map(s => serializeSolicitud(s as SolicitudConCliente)), nextCursor };
  }

  async findRechazadasMias(
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

    return { data: pageData.map(s => serializeSolicitud(s as SolicitudConCliente)), nextCursor };
  }

  /**
   * Historial de rentas del encargado: solicitudes con al menos una devolución registrada,
   * filtradas por la fecha de la última devolución.
   */
  async findHistorialMias(
    username: string,
    params: { fechaDesde: Date; fechaHasta: Date; cursor?: string },
  ): Promise<RechazadasPage> {
    const { fechaDesde, fechaHasta, cursor } = params;
    const keysetClause = cursor ? this.decodeHistorialCursor(cursor) : null;

    const solicitudes = await this.prisma.solicitud.findMany({
      where: {
        AND: [
          this.encargadoFilter(username),
          {
            estado:                { in: ['ACTIVA', 'DEVUELTA'] },
            fechaUltimaDevolucion: { not: null, gte: fechaDesde, lte: fechaHasta },
            ...(keysetClause && {
              OR: [
                { fechaUltimaDevolucion: { lt: keysetClause.fechaUltimaDevolucion } },
                { fechaUltimaDevolucion: keysetClause.fechaUltimaDevolucion, id: { lt: keysetClause.id } },
              ],
            }),
          },
        ],
      },
      include: { cliente: true },
      orderBy: [{ fechaUltimaDevolucion: 'desc' }, { id: 'desc' }],
      take:    PAGE_SIZE + 1,
    });

    const hasMore    = solicitudes.length > PAGE_SIZE;
    const pageData   = hasMore ? solicitudes.slice(0, PAGE_SIZE) : solicitudes;
    const last       = pageData.at(-1);
    const nextCursor = hasMore && last
      ? this.encodeHistorialCursor({
          fechaUltimaDevolucion: last.fechaUltimaDevolucion!.toISOString(),
          id: last.id,
        })
      : null;

    return { data: pageData.map(s => serializeSolicitud(s as SolicitudConCliente)), nextCursor };
  }

  /**
   * Historial global de rentas (admin / secretaria): igual que findHistorialMias
   * pero sin filtro de encargado.
   */
  async findHistorial(
    params: { fechaDesde: Date; fechaHasta: Date; cursor?: string; creadaPor?: string },
  ): Promise<RechazadasPage> {
    const { fechaDesde, fechaHasta, cursor, creadaPor } = params;
    const keysetClause = cursor ? this.decodeHistorialCursor(cursor) : null;

    const solicitudes = await this.prisma.solicitud.findMany({
      where: {
        estado:                { in: ['ACTIVA', 'DEVUELTA'] },
        fechaUltimaDevolucion: { not: null, gte: fechaDesde, lte: fechaHasta },
        ...(creadaPor && { creadaPor }),
        ...(keysetClause && {
          OR: [
            { fechaUltimaDevolucion: { lt: keysetClause.fechaUltimaDevolucion } },
            { fechaUltimaDevolucion: keysetClause.fechaUltimaDevolucion, id: { lt: keysetClause.id } },
          ],
        }),
      },
      include: { cliente: true },
      orderBy: [{ fechaUltimaDevolucion: 'desc' }, { id: 'desc' }],
      take:    PAGE_SIZE + 1,
    });

    const hasMore    = solicitudes.length > PAGE_SIZE;
    const pageData   = hasMore ? solicitudes.slice(0, PAGE_SIZE) : solicitudes;
    const last       = pageData.at(-1);
    const nextCursor = hasMore && last
      ? this.encodeHistorialCursor({
          fechaUltimaDevolucion: last.fechaUltimaDevolucion!.toISOString(),
          id: last.id,
        })
      : null;

    const nombres = await this.buildNombresMap(pageData.map(s => s.creadaPor));
    return { data: pageData.map(s => serializeSolicitud(s, { creador: nombres.get(s.creadaPor) })), nextCursor };
  }

  // ── Cursor helpers ────────────────────────────────────────────────────────────

  private encodeCursor(cursor: KeysetCursor): string {
    return Buffer.from(JSON.stringify(cursor)).toString('base64');
  }

  private decodeCursor(raw: string): { fechaDecision: Date; id: string } {
    const parsed = JSON.parse(Buffer.from(raw, 'base64').toString('utf8')) as KeysetCursor;
    return { fechaDecision: new Date(parsed.fechaDecision), id: parsed.id };
  }

  private encodeHistorialCursor(cursor: HistorialCursor): string {
    return Buffer.from(JSON.stringify(cursor)).toString('base64');
  }

  private decodeHistorialCursor(raw: string): { fechaUltimaDevolucion: Date; id: string } {
    const parsed = JSON.parse(Buffer.from(raw, 'base64').toString('utf8')) as HistorialCursor;
    return { fechaUltimaDevolucion: new Date(parsed.fechaUltimaDevolucion), id: parsed.id };
  }
}
