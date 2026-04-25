import { Injectable, ConflictException, NotFoundException, ForbiddenException, BadRequestException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { R2Service } from '../r2/r2.service';
import { CreateSolicitudDto } from './dto/create-solicitud.dto';
import { AmpliacionRentaDto } from './dto/ampliar-renta.dto';
import { RegistrarDevolucionDto } from './dto/registrar-devolucion.dto';
import { IniciarEntregaDto } from './dto/iniciar-entrega.dto';
import type { AuthenticatedUser } from '../auth/interfaces/jwt-payload.interface';
import { tieneAccesoGlobal } from '../auth/utils/roles.util';
import { serializeSolicitud } from './solicitudes.serializer';
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

  async create(dto: CreateSolicitudDto, username: string) {
    const esPesada = dto.items.every(i => i.kind === 'pesada');
    const esMixta  = !esPesada && dto.items.some(i => i.kind === 'pesada');

    if (esMixta) {
      throw new BadRequestException(
        'Una solicitud no puede mezclar ítems de maquinaria pesada con maquinaria liviana o granel.',
      );
    }

    const equipoIds = dto.items
      .filter((i): i is typeof i & { equipoId: string } =>
        (i.kind === 'maquinaria' || i.kind === 'pesada') && !!i.equipoId,
      )
      .map(i => i.equipoId);

    if (equipoIds.length > 0) {
      const reservados = new Set(await this.getEquiposReservadosInterno());
      const conflictos = equipoIds.filter(id => reservados.has(id));

      if (conflictos.length > 0) {
        throw new ConflictException(
          'Uno o más equipos seleccionados ya están en una solicitud activa y no están disponibles.',
        );
      }
    }

    let itemsToStore: object[] = dto.items as object[];
    if (esPesada && equipoIds.length > 0) {
      const equipos = await this.prisma.equipo.findMany({
        where:  { id: { in: equipoIds } },
        select: { id: true, rentaHora: true, rentaHoraMartillo: true },
      });
      const equipoMap = new Map(equipos.map(e => [e.id, e]));

      itemsToStore = dto.items.map(item => {
        if (item.kind !== 'pesada' || !item.equipoId) return item as object;
        const eq = equipoMap.get(item.equipoId);
        const tarifa = item.conMartillo && eq?.rentaHoraMartillo != null
          ? parseFloat(eq.rentaHoraMartillo.toString())
          : eq?.rentaHora != null
            ? parseFloat(eq.rentaHora.toString())
            : 0;
        const { tarifaEfectiva: _dropped, ...rest } = item as any;
        return { ...rest, tarifaEfectiva: tarifa };
      });
    }

    const solicitud = await this.prisma.solicitud.create({
      data: {
        clienteId:     dto.clienteId,
        items:         itemsToStore,
        modalidad:     dto.modalidad,
        notas:         dto.notas,
        totalEstimado: esPesada ? 0 : (dto.totalEstimado ?? 0),
        esPesada,
        creadaPor:     username,
      },
      include: { cliente: true },
    });
    return serializeSolicitud(solicitud);
  }

  async aprobar(id: string, aprobadaPor: string) {
    return this.prisma.$transaction(async (tx) => {
      const now     = new Date();
      const mesAnio = `${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, '0')}`;

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

      return serializeSolicitud(solicitud);
    });
  }

  async rechazar(id: string, motivoRechazo: string) {
    const solicitud = await this.prisma.solicitud.update({
      where:   { id },
      data:    { estado: 'RECHAZADA', motivoRechazo, fechaDecision: new Date() },
      include: { cliente: true },
    });
    return serializeSolicitud(solicitud);
  }

  /**
   * Registra el inicio oficial de la renta: graba fechaInicioRenta = now() la primera
   * vez que el encargado genera el comprobante. Si ya está fijada, devuelve la solicitud
   * sin modificarla — la fecha de inicio es inmutable una vez establecida.
   */
  async iniciarEntrega(id: string, username: string, dto?: IniciarEntregaDto) {
    const solicitud = await this.prisma.solicitud.findUnique({ where: { id } });

    if (!solicitud) throw new NotFoundException('Solicitud no encontrada.');
    if (solicitud.creadaPor !== username)
      throw new ForbiddenException('Solo el encargado que creó la solicitud puede iniciar la entrega.');
    if (solicitud.estado !== 'APROBADA')
      throw new ConflictException('Solo se puede iniciar la entrega de solicitudes aprobadas.');

    const data: Prisma.SolicitudUpdateInput = {};

    if (!solicitud.fechaInicioRenta) {
      data.fechaInicioRenta = new Date();
    }

    if (dto?.horometrosIniciales?.length) {
      const horometroMap = new Map(dto.horometrosIniciales.map(h => [h.equipoId, h.valor]));
      const items = solicitud.items as Record<string, unknown>[];
      data.items = items.map(item =>
        item['kind'] === 'pesada' && horometroMap.has(item['equipoId'] as string)
          ? { ...item, horometroInicial: horometroMap.get(item['equipoId'] as string) }
          : item,
      ) as unknown as Prisma.InputJsonValue;
    }

    if (!data.fechaInicioRenta && !data.items) {
      const actual = await this.prisma.solicitud.findUnique({
        where: { id }, include: { cliente: true },
      });
      return serializeSolicitud(actual!);
    }

    const actualizada = await this.prisma.solicitud.update({
      where:   { id },
      data,
      include: { cliente: true },
    });
    return serializeSolicitud(actualizada);
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

    if (!solicitud)
      throw new NotFoundException('Solicitud no encontrada.');
    if (solicitud.creadaPor !== username)
      throw new ForbiddenException('Solo el encargado que creó la solicitud puede confirmar la entrega.');
    if (solicitud.estado !== 'APROBADA')
      throw new ConflictException('Solo se puede confirmar la entrega de solicitudes aprobadas.');
    if (!solicitud.folio)
      throw new ConflictException('La solicitud no tiene folio asignado.');

    this.validatePdfBuffer(buffer);

    const key = this.buildComprobanteKey(solicitud.clienteId, solicitud.folio);
    await this.r2.uploadFile(key, buffer, mimetype);

    const fechaEntrega   = new Date();
    const fechaInicio    = solicitud.fechaInicioRenta ?? fechaEntrega;
    const items          = solicitud.items as unknown as ItemParaCalculo[];

    let fechaFinEstimada: Date;
    if (solicitud.esPesada) {
      const pesadaItems = items as unknown as Array<{ diasSolicitados?: number }>;
      const maxDias = Math.max(...pesadaItems.map(i => i.diasSolicitados ?? 1), 1);
      fechaFinEstimada = new Date(fechaInicio.getTime() + maxDias * 86_400_000);
    } else {
      fechaFinEstimada = calcularFechaFinEstimada(fechaInicio, items);
    }

    const actualizada = await this.prisma.solicitud.update({
      where:   { id },
      data:    { estado: 'ACTIVA', comprobanteKey: key, fechaEntrega, fechaFinEstimada },
      include: { cliente: true },
    });
    return serializeSolicitud(actualizada);
  }

  /**
   * Amplía una o más ítems de una renta activa.
   *
   * Reglas:
   *  - Solo el encargado que creó la solicitud puede ampliarla.
   *  - El costo de la extensión se calcula con precios ACTUALES del equipo/granel.
   *  - El JSON original de `items` queda inmutable; las extensiones se acumulan en `extensiones`.
   *  - Para rentas vencidas: la extensión empieza desde la `fechaFinEstimada` actual.
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

    const fechaInicio         = solicitud.fechaInicioRenta;
    const snapshotItems       = solicitud.items as unknown as ItemParaCalculo[];
    const extensionesActuales = (solicitud.extensiones ?? []) as unknown as ExtensionEntry[];

    const nuevasExtensiones: ExtensionEntry[] = [];
    let   costoTotalExtra = 0;

    for (const extDto of dto.items) {
      const snapItem = snapshotItems.find(i =>
        extDto.kind === 'maquinaria'
          ? i.kind === 'maquinaria' && i.equipoId === extDto.itemRef
          : i.kind === 'granel'    && i.tipo     === extDto.itemRef,
      );

      if (!snapItem) {
        throw new BadRequestException(`Ítem "${extDto.itemRef}" no encontrado en la solicitud.`);
      }

      const extsPrevias    = extensionesActuales.filter(e => e.itemRef === extDto.itemRef);
      const fechaInicioExt = calcularFinItemConExtensiones(fechaInicio, snapItem, extsPrevias);

      const toNum = (v: unknown): number | null =>
        v != null ? parseFloat(String(v)) : null;

      let costoExtra = 0;

      if (extDto.kind === 'maquinaria') {
        const equipo = await this.prisma.equipo.findUnique({ where: { id: extDto.itemRef } });
        if (!equipo) throw new BadRequestException(`Equipo "${extDto.itemRef}" no encontrado.`);

        costoExtra = calcularCostoAdaptativo(
          fechaInicioExt,
          extDto.duracion,
          extDto.unidad,
          { dia: toNum(equipo.rentaDia), semana: toNum(equipo.rentaSemana), mes: toNum(equipo.rentaMes) },
        );
      } else {
        const config = await this.prisma.configGranel.findUnique({
          where: { tipo: extDto.itemRef as any },
        });
        if (!config) throw new BadRequestException(`Configuración de granel "${extDto.itemRef}" no encontrada.`);

        const conMadera = snapItem.conMadera ?? false;
        const cantidad  = snapItem.cantidad  ?? 1;
        const precios   = conMadera
          ? { dia: toNum(config.rentaDiaConMadera), semana: toNum(config.rentaSemanaConMadera), mes: toNum(config.rentaMesConMadera) }
          : { dia: toNum(config.rentaDia),          semana: toNum(config.rentaSemana),          mes: toNum(config.rentaMes)          };

        costoExtra = calcularCostoAdaptativo(fechaInicioExt, extDto.duracion, extDto.unidad, precios, cantidad);
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

    const todasLasExtensiones = [...extensionesActuales, ...nuevasExtensiones];
    const itemsParaFin        = snapshotItems.map(i => ({
      duracion: i.duracion,
      unidad:   i.unidad,
      equipoId: i.equipoId,
      tipo:     i.tipo,
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

    return serializeSolicitud(actualizada);
  }

  /**
   * Registra la devolución de una renta (activa o vencida), parcial o completa.
   *
   * Lógica:
   *  - Si dto.itemRefs está vacío, se devuelven todos los ítems pendientes.
   *  - Para cada ítem devuelto se calcula el costo real con precios actuales de DB.
   *  - El cargo por atraso se aplica solo a los ítems cuya fecha efectiva ya pasó.
   *  - Si quedan ítems pendientes, la solicitud permanece ACTIVA y se recalcula fechaFinEstimada.
   *  - Si todos los ítems fueron devueltos, la solicitud pasa a DEVUELTA y se fija totalFinal.
   */
  async registrarDevolucion(id: string, dto: RegistrarDevolucionDto, user: AuthenticatedUser) {
    const solicitud = await this.prisma.solicitud.findUnique({ where: { id } });

    if (!solicitud)
      throw new NotFoundException('Solicitud no encontrada.');
    if (solicitud.esPesada)
      throw new BadRequestException('Las rentas de maquinaria pesada usan el endpoint PATCH :id/registrar-devolucion-pesada.');
    if (!tieneAccesoGlobal(user) && solicitud.creadaPor !== user.username)
      throw new ForbiddenException('Solo el encargado que creó la solicitud puede registrar la devolución.');
    if (solicitud.estado !== 'ACTIVA')
      throw new ConflictException('Solo se puede registrar la devolución de rentas activas.');
    if (!solicitud.fechaInicioRenta)
      throw new ConflictException('La solicitud no tiene fecha de inicio registrada.');

    const fechaDevolucion    = new Date();
    const fechaInicio        = solicitud.fechaInicioRenta;
    const snapshotItems      = solicitud.items as unknown as ItemParaCalculo[];
    const extensiones        = (solicitud.extensiones        ?? []) as unknown as ExtensionEntry[];
    const devolucionesViejas = (solicitud.devolucionesParciales ?? []) as unknown as DevolucionEntry[];

    const yaDevueltosRefs = new Set<string>(
      devolucionesViejas.flatMap(d => d.items.map(i => i.itemRef)),
    );
    const itemsPendientes = snapshotItems.filter(item => {
      const ref = item.equipoId ?? item.tipo ?? '';
      return !yaDevueltosRefs.has(ref);
    });

    if (itemsPendientes.length === 0)
      throw new ConflictException('Todos los ítems de esta solicitud ya fueron devueltos.');

    const refsADevolver = dto.itemRefs && dto.itemRefs.length > 0
      ? new Set(dto.itemRefs)
      : new Set(itemsPendientes.map(i => i.equipoId ?? i.tipo ?? ''));

    const itemsADevolver = itemsPendientes.filter(i => refsADevolver.has(i.equipoId ?? i.tipo ?? ''));

    if (itemsADevolver.length === 0)
      throw new BadRequestException('Ninguno de los ítems indicados está pendiente de devolución.');

    const toNum = (v: unknown): number | null =>
      v != null ? parseFloat(String(v)) : null;

    const devolucionItems: DevolucionItemEntry[] = [];

    for (const item of itemsADevolver) {
      const itemRef     = item.equipoId ?? item.tipo ?? '';
      const extsItem    = extensiones.filter(e => e.itemRef === itemRef);
      const finEfectivo = calcularFinItemConExtensiones(fechaInicio, item, extsItem);

      const recargoTiempo = item.tarifa != null
        ? calcularRecargoItem(item.tarifa, finEfectivo, fechaDevolucion)
        : 0;

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

    const rentedMs      = fechaDevolucion.getTime() - fechaInicio.getTime();
    const diasCompletos = Math.floor(rentedMs / 86_400_000);
    const excesoMs      = rentedMs - diasCompletos * 86_400_000;
    const diasCobrados  = Math.max(excesoMs <= 3_600_000 ? diasCompletos : diasCompletos + 1, 1);
    devolucionItems.forEach(i => { i.diasCobrados = diasCobrados; });

    const recargosAdicionales: CargoAdicional[] = (dto.recargosAdicionales ?? []).map(c => ({
      descripcion: c.descripcion,
      monto:       c.monto,
    }));

    const subtotalItems       = devolucionItems.reduce((s, i) => s + i.costoReal,     0);
    const subtotalRecargos    = devolucionItems.reduce((s, i) => s + i.recargoTiempo, 0);
    const subtotalAdicionales = recargosAdicionales.reduce((s, c) => s + c.monto, 0);
    const totalLote           = subtotalItems + subtotalRecargos + subtotalAdicionales;

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

    const updateData: Prisma.SolicitudUpdateInput = {
      devolucionesParciales: todasLasDevoluciones as object[],
      fechaUltimaDevolucion: fechaDevolucion,
    };

    if (devolucionCompleta) {
      const totalFinal   = todasLasDevoluciones.reduce((s, d) => s + d.totalLote, 0);
      const recargoTotal = todasLasDevoluciones.reduce(
        (s, d) => s + d.items.reduce((si, i) => si + i.recargoTiempo, 0), 0,
      );
      updateData.estado          = 'DEVUELTA';
      updateData.fechaDevolucion = fechaDevolucion;
      updateData.recargoTotal    = recargoTotal;
      updateData.totalFinal      = totalFinal;
    } else {
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

    return serializeSolicitud(actualizada);
  }

  /**
   * Recibe el PDF de liquidación generado en el frontend, lo sube a R2 y actualiza
   * la `liquidacionKey` de la última entrada en `devolucionesParciales`.
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

    const loteIndex = devoluciones.length;
    const key       = `clientes/${solicitud.clienteId}/liquidaciones/${solicitud.folio ?? solicitud.id}-${loteIndex}.pdf`;
    await this.r2.uploadFile(key, buffer, mimetype);

    devoluciones[devoluciones.length - 1].liquidacionKey = key;

    await this.prisma.solicitud.update({
      where: { id },
      data:  { devolucionesParciales: devoluciones as object[] },
    });

    const url = await this.r2.getPresignedUrl(key);
    return { url };
  }

  async getComprobanteUrl(id: string, username: string): Promise<{ url: string }> {
    const solicitud = await this.prisma.solicitud.findUnique({ where: { id } });

    if (!solicitud)
      throw new NotFoundException('Solicitud no encontrada.');
    if (!solicitud.comprobanteKey)
      throw new NotFoundException('Esta solicitud no tiene comprobante subido.');

    const url = await this.r2.getPresignedUrl(solicitud.comprobanteKey);
    return { url };
  }

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

  // Usado internamente por create() para verificar disponibilidad de equipos
  private async getEquiposReservadosInterno(): Promise<string[]> {
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
      const items = s.items as unknown as Array<{ kind: string; equipoId?: string }>;
      for (const item of items) {
        if ((item.kind === 'maquinaria' || item.kind === 'pesada') && item.equipoId && !yaDevueltos.has(item.equipoId)) {
          reservados.add(item.equipoId);
        }
      }
    }

    return [...reservados];
  }
}
