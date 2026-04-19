import { Injectable, ConflictException, NotFoundException, ForbiddenException, BadRequestException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { R2Service } from '../r2/r2.service';
import { CreateSolicitudDto } from './dto/create-solicitud.dto';
import { AmpliacionRentaDto } from './dto/ampliar-renta.dto';
import { RegistrarDevolucionDto } from './dto/registrar-devolucion.dto';
import type { AuthenticatedUser } from '../auth/interfaces/jwt-payload.interface';
import {
  ExtensionEntry,
  DevolucionEntry,
  DevolucionItemEntry,
  CargoAdicional,
  calcularFechaFinEstimada,
  calcularFechaFinEstimadaConExtensiones,
  calcularRecargoTotalConExtensiones,
  calcularFinItemConExtensiones,
  calcularRecargoItem,
  calcularCostoAdaptativo,
  calcularDevolucionItem,
} from './recargo.util';

type SolicitudConCliente = Prisma.SolicitudGetPayload<{ include: { cliente: true } }>;

const ROLES_CON_ACCESO_GLOBAL = new Set(['admin', 'secretaria']);

/** Admin y secretaria pueden operar sobre cualquier solicitud sin importar quién la creó. */
function tieneAccesoGlobal(user: AuthenticatedUser): boolean {
  return ROLES_CON_ACCESO_GLOBAL.has(user.role);
}

// Shape mínima de un item para extraer equipoId sin asumir tipos extras
interface ItemConKind { kind: string; equipoId?: string }

// Shape mínima de un item del snapshot para cálculos de tiempo y recargo
interface ItemParaCalculo {
  kind:      string;
  duracion:  number;
  unidad:    string;
  tarifa:    number | null;
  equipoId?: string;
  tipo?:     string;
  conMadera?: boolean;
  cantidad?:  number;
}

export interface RechazadasPage {
  data:       ReturnType<SolicitudesService['serialize']>[];
  nextCursor: string | null;
}

interface KeysetCursor          { fechaDecision:         string; id: string }
interface HistorialCursor       { fechaUltimaDevolucion: string; id: string }

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
      select: { items: true, devolucionesParciales: true },
    });

    const reservados = new Set<string>();
    for (const s of activas) {
      // Construir el set de itemRefs ya devueltos en devoluciones parciales
      const devoluciones = (s.devolucionesParciales as unknown as DevolucionEntry[]) ?? [];
      const yaDevueltos  = new Set<string>(
        devoluciones.flatMap(d => d.items.map(i => i.itemRef)),
      );

      const items = s.items as unknown as ItemConKind[];
      for (const item of items) {
        if (item.kind === 'maquinaria' && item.equipoId && !yaDevueltos.has(item.equipoId)) {
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
   * Todas las solicitudes ACTIVA cuya fechaFinEstimada ya pasó — vista del admin/secretaria.
   */
  async findVencidas() {
    const now = new Date();
    const solicitudes = await this.prisma.solicitud.findMany({
      where:   { estado: 'ACTIVA', fechaFinEstimada: { lt: now } },
      include: { cliente: true },
      orderBy: { fechaFinEstimada: 'asc' },
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
   * Registra la devolución de una renta (activa o vencida), parcial o completa.
   *
   * Lógica:
   *  - Si dto.itemRefs está vacío, se devuelven todos los ítems pendientes (devolución completa).
   *  - Para cada ítem devuelto se calcula el costo real con precios actuales de DB usando
   *    la lógica adaptive (meses + semanas + días sobre días reales usados).
   *  - El cargo por atraso se aplica solo a los ítems cuya fecha efectiva ya pasó.
   *  - Si quedan ítems pendientes tras la devolución, la solicitud permanece ACTIVA y
   *    se recalcula fechaFinEstimada para los ítems restantes.
   *  - Si todos los ítems fueron devueltos, la solicitud pasa a DEVUELTA y se fija totalFinal.
   *  - El PDF de liquidación se sube en un paso separado (PATCH :id/liquidacion).
   */
  async registrarDevolucion(id: string, dto: RegistrarDevolucionDto, user: AuthenticatedUser) {
    const solicitud = await this.prisma.solicitud.findUnique({ where: { id } });

    if (!solicitud)
      throw new NotFoundException('Solicitud no encontrada.');
    if (!tieneAccesoGlobal(user) && solicitud.creadaPor !== user.username)
      throw new ForbiddenException('Solo el encargado que creó la solicitud puede registrar la devolución.');
    if (solicitud.estado !== 'ACTIVA')
      throw new ConflictException('Solo se puede registrar la devolución de rentas activas.');
    if (!solicitud.fechaInicioRenta)
      throw new ConflictException('La solicitud no tiene fecha de inicio registrada.');

    const fechaDevolucion   = new Date();
    const fechaInicio       = solicitud.fechaInicioRenta;
    const snapshotItems     = solicitud.items       as unknown as ItemParaCalculo[];
    const extensiones       = (solicitud.extensiones ?? []) as unknown as ExtensionEntry[];
    const devolucionesViejas = (solicitud.devolucionesParciales ?? []) as unknown as DevolucionEntry[];

    // ── Determinar ítems ya devueltos y ítems pendientes ──────────────────────
    const yaDevueltosRefs = new Set<string>(
      devolucionesViejas.flatMap(d => d.items.map(i => i.itemRef)),
    );
    const itemsPendientes = snapshotItems.filter(item => {
      const ref = item.equipoId ?? item.tipo ?? '';
      return !yaDevueltosRefs.has(ref);
    });

    if (itemsPendientes.length === 0)
      throw new ConflictException('Todos los ítems de esta solicitud ya fueron devueltos.');

    // ── Determinar ítems a devolver en esta operación ─────────────────────────
    const refsADevolver = dto.itemRefs && dto.itemRefs.length > 0
      ? new Set(dto.itemRefs)
      : new Set(itemsPendientes.map(i => i.equipoId ?? i.tipo ?? ''));

    const itemsADevolver = itemsPendientes.filter(i => refsADevolver.has(i.equipoId ?? i.tipo ?? ''));

    if (itemsADevolver.length === 0)
      throw new BadRequestException('Ninguno de los ítems indicados está pendiente de devolución.');

    const toNum = (v: unknown): number | null =>
      v != null ? parseFloat(String(v)) : null;

    // ── Calcular costo y recargo por ítem ─────────────────────────────────────
    const devolucionItems: DevolucionItemEntry[] = [];

    for (const item of itemsADevolver) {
      const itemRef  = item.equipoId ?? item.tipo ?? '';
      const extsItem = extensiones.filter(e => e.itemRef === itemRef);
      const finEfectivo = calcularFinItemConExtensiones(fechaInicio, item, extsItem);

      // Recargo por atraso (aplica cuando la fecha efectiva ya pasó)
      const recargoTiempo = item.tarifa != null
        ? calcularRecargoItem(item.tarifa, finEfectivo, fechaDevolucion)
        : 0;

      // Costo real basado en días reales de uso con precios actuales de DB
      let costoReal = 0;

      if (item.kind === 'maquinaria' && item.equipoId) {
        const equipo = await this.prisma.equipo.findUnique({ where: { id: item.equipoId } });
        if (equipo) {
          const precios = {
            dia:    toNum(equipo.rentaDia),
            semana: toNum(equipo.rentaSemana),
            mes:    toNum(equipo.rentaMes),
          };
          ({ costoReal } = calcularDevolucionItem(fechaInicio, fechaDevolucion, precios));
        }
      } else if (item.kind === 'granel' && item.tipo) {
        const config = await this.prisma.configGranel.findUnique({
          where: { tipo: item.tipo as any },
        });
        if (config) {
          const conMadera = item.conMadera ?? false;
          const cantidad  = item.cantidad  ?? 1;
          const precios   = conMadera
            ? { dia: toNum(config.rentaDiaConMadera), semana: toNum(config.rentaSemanaConMadera), mes: toNum(config.rentaMesConMadera) }
            : { dia: toNum(config.rentaDia),          semana: toNum(config.rentaSemana),          mes: toNum(config.rentaMes)          };
          ({ costoReal } = calcularDevolucionItem(fechaInicio, fechaDevolucion, precios, cantidad));
        }
      }

      devolucionItems.push({ itemRef, kind: item.kind as 'maquinaria' | 'granel', diasCobrados: 0, costoReal, recargoTiempo });
    }

    // diasCobrados es uniforme (todos los ítems comparten fechaInicio y fechaDevolucion)
    const rentedMs      = fechaDevolucion.getTime() - fechaInicio.getTime();
    const diasCompletos = Math.floor(rentedMs / 86_400_000);
    const excesoMs      = rentedMs - diasCompletos * 86_400_000;
    const diasCobrados  = Math.max(excesoMs <= 3_600_000 ? diasCompletos : diasCompletos + 1, 1);
    devolucionItems.forEach(i => { i.diasCobrados = diasCobrados; });

    // ── Construir entrada de devolución ───────────────────────────────────────
    const recargosAdicionales: CargoAdicional[] = (dto.recargosAdicionales ?? []).map(c => ({
      descripcion: c.descripcion,
      monto:       c.monto,
    }));

    const subtotalItems    = devolucionItems.reduce((s, i) => s + i.costoReal,     0);
    const subtotalRecargos = devolucionItems.reduce((s, i) => s + i.recargoTiempo, 0);
    const subtotalAdicionales = recargosAdicionales.reduce((s, c) => s + c.monto, 0);
    const totalLote        = subtotalItems + subtotalRecargos + subtotalAdicionales;

    const tipoDevolucion: 'A_TIEMPO' | 'TARDIA' =
      devolucionItems.some(i => i.recargoTiempo > 0) ? 'TARDIA' : 'A_TIEMPO';

    const esParcial = itemsADevolver.length < itemsPendientes.length;

    const nuevaEntrada: DevolucionEntry = {
      fechaDevolucion:     fechaDevolucion.toISOString(),
      registradoPor:       user.username,
      esParcial,
      tipoDevolucion,
      items:               devolucionItems,
      recargosAdicionales,
      totalLote,
      liquidacionKey:      null,
    };

    const todasLasDevoluciones = [...devolucionesViejas, nuevaEntrada];
    const devolucionCompleta   = !esParcial;

    // ── Persistir en transacción ──────────────────────────────────────────────
    const updateData: Prisma.SolicitudUpdateInput = {
      devolucionesParciales: todasLasDevoluciones as object[],
    };

    // Siempre actualizamos fechaUltimaDevolucion para que el historial pueda filtrar por fecha
    updateData.fechaUltimaDevolucion = fechaDevolucion;

    if (devolucionCompleta) {
      const totalFinal    = todasLasDevoluciones.reduce((s, d) => s + d.totalLote, 0);
      const recargoTotal  = todasLasDevoluciones.reduce(
        (s, d) => s + d.items.reduce((si, i) => si + i.recargoTiempo, 0), 0,
      );
      updateData.estado          = 'DEVUELTA';
      updateData.fechaDevolucion = fechaDevolucion;
      updateData.recargoTotal    = recargoTotal;
      updateData.totalFinal      = totalFinal;
    } else {
      // Recalcular fechaFinEstimada para los ítems que quedan pendientes
      const refsDevueltosAhora = new Set([...yaDevueltosRefs, ...devolucionItems.map(i => i.itemRef)]);
      const itemsRestantes     = snapshotItems.filter(i => !refsDevueltosAhora.has(i.equipoId ?? i.tipo ?? ''));
      const nuevaFechaFin      = calcularFechaFinEstimadaConExtensiones(fechaInicio, itemsRestantes, extensiones);
      updateData.fechaFinEstimada = nuevaFechaFin;
    }

    const actualizada = await this.prisma.solicitud.update({
      where:   { id },
      data:    updateData,
      include: { cliente: true },
    });

    return this.serialize(actualizada);
  }

  /**
   * Recibe el PDF de liquidación generado en el frontend, lo sube a R2 y actualiza
   * la `liquidacionKey` de la última entrada en `devolucionesParciales`.
   * Devuelve la URL firmada temporal del documento.
   */
  async subirLiquidacion(
    id:       string,
    buffer:   Buffer,
    mimetype: string,
    user:     AuthenticatedUser,
  ): Promise<{ url: string }> {
    const solicitud = await this.prisma.solicitud.findUnique({ where: { id } });

    if (!solicitud)
      throw new NotFoundException('Solicitud no encontrada.');
    if (!tieneAccesoGlobal(user) && solicitud.creadaPor !== user.username)
      throw new ForbiddenException('Solo el encargado que creó la solicitud puede subir la liquidación.');

    const devoluciones = (solicitud.devolucionesParciales as unknown as DevolucionEntry[]) ?? [];
    if (devoluciones.length === 0)
      throw new ConflictException('No hay devolución registrada para esta solicitud.');

    this.validatePdfBuffer(buffer);

    const loteIndex = devoluciones.length; // 1-based para el nombre del archivo
    const key       = `clientes/${solicitud.clienteId}/liquidaciones/${solicitud.folio ?? solicitud.id}-${loteIndex}.pdf`;
    await this.r2.uploadFile(key, buffer, mimetype);

    // Actualizar la última entrada con la key del PDF
    devoluciones[devoluciones.length - 1].liquidacionKey = key;

    await this.prisma.solicitud.update({
      where: { id },
      data:  { devolucionesParciales: devoluciones as object[] },
    });

    const url = await this.r2.getPresignedUrl(key);
    return { url };
  }

  /**
   * Amplía una o más ítems de una renta activa.
   *
   * Reglas:
   *  - Solo el encargado que creó la solicitud puede ampliarla.
   *  - La solicitud debe estar en estado ACTIVA.
   *  - Cada ítem se identifica por `itemRef` (equipoId para maquinaria, tipo para granel).
   *  - El costo de la extensión se calcula con precios ACTUALES del equipo/granel.
   *  - El JSON original de `items` queda inmutable; las extensiones se acumulan en `extensiones`.
   *  - `totalEstimado` se incrementa en el costo total de todas las extensiones.
   *  - `fechaFinEstimada` se recalcula como el mínimo de todas las fechas de vencimiento efectivas.
   *  - Para rentas vencidas: la extensión empieza desde la `fechaFinEstimada` actual,
   *    lo que puede mover la renta de nuevo a "activa" si la nueva fecha queda en el futuro.
   */
  async ampliar(id: string, dto: AmpliacionRentaDto, user: AuthenticatedUser) {
    const solicitud = await this.prisma.solicitud.findUnique({ where: { id } });

    if (!solicitud)
      throw new NotFoundException('Solicitud no encontrada.');
    if (!tieneAccesoGlobal(user) && solicitud.creadaPor !== user.username)
      throw new ForbiddenException('Solo el encargado que creó la solicitud puede ampliarla.');
    if (solicitud.estado !== 'ACTIVA')
      throw new ConflictException('Solo se pueden ampliar rentas activas.');
    if (!solicitud.fechaInicioRenta)
      throw new ConflictException('La solicitud no tiene fecha de inicio registrada.');

    const fechaInicio   = solicitud.fechaInicioRenta;
    const snapshotItems = solicitud.items as unknown as ItemParaCalculo[];
    const extensionesActuales = (solicitud.extensiones ?? []) as unknown as ExtensionEntry[];

    const nuevasExtensiones: ExtensionEntry[] = [];
    let   costoTotalExtra = 0;

    for (const extDto of dto.items) {
      // Buscar el ítem correspondiente en el snapshot
      const snapItem = snapshotItems.find(i =>
        extDto.kind === 'maquinaria'
          ? i.kind === 'maquinaria' && i.equipoId === extDto.itemRef
          : i.kind === 'granel'    && i.tipo     === extDto.itemRef,
      );

      if (!snapItem) {
        throw new BadRequestException(
          `Ítem "${extDto.itemRef}" no encontrado en la solicitud.`,
        );
      }

      // Calcular la fecha de inicio de esta extensión = fin efectivo del ítem (incluyendo extensiones previas)
      const extsPrevias = extensionesActuales.filter(e => e.itemRef === extDto.itemRef);
      const fechaInicioExt = calcularFinItemConExtensiones(fechaInicio, snapItem, extsPrevias);

      // Obtener precios actuales y calcular costo adaptativo
      let costoExtra = 0;

      if (extDto.kind === 'maquinaria') {
        const equipo = await this.prisma.equipo.findUnique({
          where: { id: extDto.itemRef },
        });
        if (!equipo) throw new BadRequestException(`Equipo "${extDto.itemRef}" no encontrado.`);

        const toNum = (v: unknown): number | null =>
          v != null ? parseFloat(String(v)) : null;

        costoExtra = calcularCostoAdaptativo(
          fechaInicioExt,
          extDto.duracion,
          extDto.unidad,
          {
            dia:    toNum(equipo.rentaDia),
            semana: toNum(equipo.rentaSemana),
            mes:    toNum(equipo.rentaMes),
          },
        );
      } else {
        // granel
        const config = await this.prisma.configGranel.findUnique({
          where: { tipo: extDto.itemRef as any },
        });
        if (!config) throw new BadRequestException(`Configuración de granel "${extDto.itemRef}" no encontrada.`);

        const toNum = (v: unknown): number | null =>
          v != null ? parseFloat(String(v)) : null;

        const conMadera = snapItem.conMadera ?? false;
        const cantidad  = snapItem.cantidad  ?? 1;
        const precios   = conMadera
          ? { dia: toNum(config.rentaDiaConMadera), semana: toNum(config.rentaSemanaConMadera), mes: toNum(config.rentaMesConMadera) }
          : { dia: toNum(config.rentaDia),          semana: toNum(config.rentaSemana),          mes: toNum(config.rentaMes)          };

        costoExtra = calcularCostoAdaptativo(
          fechaInicioExt, extDto.duracion, extDto.unidad, precios, cantidad,
        );
      }

      costoTotalExtra += costoExtra;

      nuevasExtensiones.push({
        itemRef:        extDto.itemRef,
        kind:           extDto.kind as 'maquinaria' | 'granel',
        duracion:       extDto.duracion,
        unidad:         extDto.unidad,
        costoExtra,
        fechaExtension: new Date().toISOString(),
      });
    }

    // Calcular nueva fechaFinEstimada con todas las extensiones (anteriores + nuevas)
    const todasLasExtensiones = [...extensionesActuales, ...nuevasExtensiones];
    const itemsParaFin = snapshotItems.map(i => ({
      duracion:  i.duracion,
      unidad:    i.unidad,
      equipoId:  i.equipoId,
      tipo:      i.tipo,
    }));
    const nuevaFechaFin = (() => {
      const fins = itemsParaFin.map(item => {
        const itemRef  = item.equipoId ?? item.tipo ?? '';
        const extsItem = todasLasExtensiones.filter(e => e.itemRef === itemRef);
        return calcularFinItemConExtensiones(fechaInicio, item, extsItem).getTime();
      });
      return new Date(Math.min(...fins));
    })();

    const actualizada = await this.prisma.solicitud.update({
      where: { id },
      data:  {
        extensiones:      todasLasExtensiones as object[],
        totalEstimado:    { increment: costoTotalExtra },
        fechaFinEstimada: nuevaFechaFin,
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
  /**
   * Historial de rentas del encargado: solicitudes con al menos una devolución registrada
   * (parcial o completa), filtradas por la fecha de la última devolución.
   * Incluye tanto ACTIVA (con parciales pendientes) como DEVUELTA (cerradas).
   */
  async findHistorialMias(
    username: string,
    params: { fechaDesde: Date; fechaHasta: Date; cursor?: string },
  ): Promise<RechazadasPage> {
    const { fechaDesde, fechaHasta, cursor } = params;
    const keysetClause = cursor ? this.decodeHistorialCursor(cursor) : null;

    const solicitudes = await this.prisma.solicitud.findMany({
      where: {
        creadaPor:            username,
        estado:               { in: ['ACTIVA', 'DEVUELTA'] },
        fechaUltimaDevolucion: { not: null, gte: fechaDesde, lte: fechaHasta },
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

    return { data: pageData.map(s => this.serialize(s)), nextCursor };
  }

  /**
   * Historial global de rentas (admin / secretaria): igual que findHistorialMias
   * pero sin filtro de encargado — devuelve todos los contratos con al menos
   * una devolución registrada, paginados por fechaUltimaDevolucion.
   */
  async findHistorial(
    params: { fechaDesde: Date; fechaHasta: Date; cursor?: string },
  ): Promise<RechazadasPage> {
    const { fechaDesde, fechaHasta, cursor } = params;
    const keysetClause = cursor ? this.decodeHistorialCursor(cursor) : null;

    const solicitudes = await this.prisma.solicitud.findMany({
      where: {
        estado:                { in: ['ACTIVA', 'DEVUELTA'] },
        fechaUltimaDevolucion: { not: null, gte: fechaDesde, lte: fechaHasta },
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

    return { data: pageData.map(s => this.serialize(s)), nextCursor };
  }

  /**
   * Devuelve la URL firmada del PDF de liquidación de un lote específico.
   * loteIndex es el índice 0-based dentro de devolucionesParciales.
   */
  async getLiquidacionUrl(id: string, loteIndex: number, user: AuthenticatedUser): Promise<{ url: string }> {
    const solicitud = await this.prisma.solicitud.findUnique({ where: { id } });

    if (!solicitud)
      throw new NotFoundException('Solicitud no encontrada.');
    if (!tieneAccesoGlobal(user) && solicitud.creadaPor !== user.username)
      throw new ForbiddenException('No tienes acceso a esta solicitud.');

    const devoluciones = (solicitud.devolucionesParciales ?? []) as unknown as DevolucionEntry[];

    if (loteIndex < 0 || loteIndex >= devoluciones.length)
      throw new NotFoundException('Lote de devolución no encontrado.');

    const key = devoluciones[loteIndex].liquidacionKey;
    if (!key)
      throw new NotFoundException('Este lote no tiene liquidación generada.');

    const url = await this.r2.getPresignedUrl(key);
    return { url };
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

  private encodeHistorialCursor(cursor: HistorialCursor): string {
    return Buffer.from(JSON.stringify(cursor)).toString('base64');
  }

  private decodeHistorialCursor(raw: string): { fechaUltimaDevolucion: Date; id: string } {
    const parsed = JSON.parse(Buffer.from(raw, 'base64').toString('utf8')) as HistorialCursor;
    return { fechaUltimaDevolucion: new Date(parsed.fechaUltimaDevolucion), id: parsed.id };
  }

  serialize(s: SolicitudConCliente) {
    return {
      ...s,
      totalEstimado:         parseFloat(s.totalEstimado.toString()),
      recargoTotal:          s.recargoTotal != null ? parseFloat(s.recargoTotal.toString())           : null,
      totalFinal:            s.totalFinal   != null ? parseFloat((s.totalFinal as any).toString())    : null,
      extensiones:           (s.extensiones          ?? null) as ExtensionEntry[]   | null,
      devolucionesParciales: (s.devolucionesParciales ?? null) as DevolucionEntry[] | null,
      fechaUltimaDevolucion: s.fechaUltimaDevolucion?.toISOString() ?? null,
    };
  }
}
