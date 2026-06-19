import {
  Injectable, BadRequestException, ForbiddenException,
  NotFoundException, ConflictException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { HorometroCalcService, RECARGO_NOCTURNO } from './horometro-calc.service';
import { RegistrarLecturaDto } from './dto/lectura-horometro.dto';
import { RegistrarTramoDto, DeshacerTramoDto } from './dto/tramo-horometro.dto';
import { RegistrarDevolucionPesadaDto } from './dto/registrar-devolucion-pesada.dto';
import type { AuthenticatedUser } from '../auth/interfaces/jwt-payload.interface';
import { tieneAccesoGlobal } from '../auth/utils/roles.util';
import type { DevolucionEntry, DevolucionItemEntry, CargoAdicional, DescuentoAplicado } from './recargo.util';
import type {
  ItemPesadaSnapshot, ExtraSeleccionadoSnapshot, TramoHorometro, DesgloseComplemento, CorteNocturnoInput,
} from './solicitudes.types';

@Injectable()
export class HorometroService {
  constructor(
    private readonly prisma:  PrismaService,
    private readonly calc:    HorometroCalcService,
  ) {}

  // ── Lectura diaria ──────────────────────────────────────────────────────────

  async registrarLectura(
    solicitudId: string,
    dto:         RegistrarLecturaDto,
    user:        AuthenticatedUser,
  ) {
    const solicitud = await this.prisma.solicitud.findUnique({ where: { id: solicitudId } });

    if (!solicitud)
      throw new NotFoundException('Solicitud no encontrada.');
    if (!solicitud.esPesada)
      throw new BadRequestException('Esta solicitud no es de maquinaria pesada.');
    if (solicitud.estado !== 'ACTIVA')
      throw new ConflictException('Solo se pueden registrar lecturas en rentas activas.');
    if (!tieneAccesoGlobal(user) && solicitud.creadaPor !== user.username && solicitud.gestionadaPor !== user.username)
      throw new ForbiddenException('No tienes permiso para registrar lecturas en esta solicitud.');

    const items = solicitud.items as unknown as ItemPesadaSnapshot[];
    const item  = items.find(i => i.equipoId === dto.equipoId);
    if (!item)
      throw new BadRequestException(`El equipo ${dto.equipoId} no pertenece a esta solicitud.`);

    if (dto.tipo === 'fin5pm' && dto.extraId !== undefined)
      throw new BadRequestException('El complemento inicial no aplica al registrar el cierre del día.');

    const fechaDate = new Date(dto.fecha + 'T00:00:00.000Z');

    if (dto.tipo === 'inicio') {
      const cortesNocturnos = dto.tramosNocturnos?.map(c => ({
        horometroCorte: c.horometroCorte,
        extraId:        c.extraId ?? null,
      }));
      return this.registrarInicio(
        solicitudId, dto.equipoId, fechaDate, dto.valor, item,
        dto.extraId, dto.complementoNocturnoInicialId, cortesNocturnos, user.username,
      );
    }
    return this.registrarFin5pm(solicitudId, dto.equipoId, fechaDate, dto.valor, item, user.username);
  }

  // ── Tramos (cambios de complemento dentro del día) ──────────────────────────

  async registrarTramo(
    solicitudId: string,
    dto:         RegistrarTramoDto,
    user:        AuthenticatedUser,
  ) {
    const solicitud = await this.prisma.solicitud.findUnique({ where: { id: solicitudId } });

    if (!solicitud)
      throw new NotFoundException('Solicitud no encontrada.');
    if (!solicitud.esPesada)
      throw new BadRequestException('Esta solicitud no es de maquinaria pesada.');
    if (solicitud.estado !== 'ACTIVA')
      throw new ConflictException('Solo se pueden registrar tramos en rentas activas.');
    if (!tieneAccesoGlobal(user) && solicitud.creadaPor !== user.username && solicitud.gestionadaPor !== user.username)
      throw new ForbiddenException('No tienes permiso para registrar tramos en esta solicitud.');

    const items = solicitud.items as unknown as ItemPesadaSnapshot[];
    const item  = items.find(i => i.equipoId === dto.equipoId);
    if (!item)
      throw new BadRequestException(`El equipo ${dto.equipoId} no pertenece a esta solicitud.`);
    if (dto.extraId != null && !item.extras.some(e => e.tipoExtraId === dto.extraId))
      throw new BadRequestException('El complemento indicado no está disponible para este equipo.');

    const fechaDate = new Date(dto.fecha + 'T00:00:00.000Z');
    const lectura = await this.prisma.lecturaHorometro.findUnique({
      where: { solicitudId_equipoId_fecha: { solicitudId, equipoId: dto.equipoId, fecha: fechaDate } },
    });

    if (!lectura || lectura.horometroInicio == null)
      throw new ConflictException('Registra primero el horómetro de inicio del día.');
    if (lectura.horometroFin5pm != null)
      throw new ConflictException('Este día ya está cerrado; no se pueden registrar más cambios de complemento.');

    const tramosActuales   = (lectura.tramos ?? []) as unknown as TramoHorometro[];
    const ultimaReferencia = tramosActuales.length > 0
      ? tramosActuales[tramosActuales.length - 1].horometroHasta
      : parseFloat(lectura.horometroInicio.toString());

    if (dto.horometro <= ultimaReferencia)
      throw new BadRequestException(
        `El horómetro (${dto.horometro} hrs) debe ser mayor al último registrado en el día (${ultimaReferencia} hrs).`,
      );

    const estadoActual      = lectura.complementoActivoId ?? null;
    const { tarifa, nombre } = this.resolverTarifa(item.tarifaEfectiva, estadoActual, item.extras);
    const horas              = this.calc.diffHorometro(ultimaReferencia, dto.horometro);

    const nuevoTramo: TramoHorometro = {
      horometroDesde: ultimaReferencia,
      horometroHasta: dto.horometro,
      horas,
      extraId:        estadoActual,
      extraNombre:    nombre,
      tarifa,
      costo:          horas * tarifa,
    };
    const tramos = [...tramosActuales, nuevoTramo];

    const nuevoExtra       = dto.extraId != null ? item.extras.find(e => e.tipoExtraId === dto.extraId) : undefined;
    const nuevoActivoId    = dto.extraId ?? null;
    const nuevoActivoNombre = nuevoExtra?.nombre ?? null;

    const actualizada = await this.prisma.lecturaHorometro.update({
      where: { id: lectura.id },
      data: {
        tramos:                   tramos as unknown as Prisma.InputJsonValue,
        complementoActivoId:      nuevoActivoId,
        complementoActivoNombre:  nuevoActivoNombre,
      },
    });

    return this.serializeLectura(actualizada);
  }

  async deshacerUltimoTramo(
    solicitudId: string,
    dto:         DeshacerTramoDto,
    user:        AuthenticatedUser,
  ) {
    const solicitud = await this.prisma.solicitud.findUnique({ where: { id: solicitudId } });

    if (!solicitud)
      throw new NotFoundException('Solicitud no encontrada.');
    if (!solicitud.esPesada)
      throw new BadRequestException('Esta solicitud no es de maquinaria pesada.');
    if (solicitud.estado !== 'ACTIVA')
      throw new ConflictException('Solo se pueden corregir tramos en rentas activas.');
    if (!tieneAccesoGlobal(user) && solicitud.creadaPor !== user.username && solicitud.gestionadaPor !== user.username)
      throw new ForbiddenException('No tienes permiso para corregir tramos en esta solicitud.');

    const fechaDate = new Date(dto.fecha + 'T00:00:00.000Z');
    const lectura = await this.prisma.lecturaHorometro.findUnique({
      where: { solicitudId_equipoId_fecha: { solicitudId, equipoId: dto.equipoId, fecha: fechaDate } },
    });

    if (!lectura)
      throw new NotFoundException('No se encontró la lectura de este día.');
    if (lectura.horometroFin5pm != null)
      throw new ConflictException('Este día ya está cerrado; no se puede deshacer un cambio de complemento.');

    const tramosActuales = (lectura.tramos ?? []) as unknown as TramoHorometro[];
    if (tramosActuales.length === 0)
      throw new ConflictException('No hay cambios de complemento registrados en este día.');

    const ultimoTramo = tramosActuales[tramosActuales.length - 1];
    const tramos       = tramosActuales.slice(0, -1);

    const actualizada = await this.prisma.lecturaHorometro.update({
      where: { id: lectura.id },
      data: {
        tramos:                  tramos as unknown as Prisma.InputJsonValue,
        complementoActivoId:     ultimoTramo.extraId,
        complementoActivoNombre: ultimoTramo.extraNombre,
      },
    });

    return this.serializeLectura(actualizada);
  }

  /** Resuelve la tarifa Q/hora y el nombre del complemento para un estado dado (null = sin complemento). */
  private resolverTarifa(
    tarifaBase: number,
    extraId:    string | null,
    extras:     ExtraSeleccionadoSnapshot[],
  ): { tarifa: number; nombre: string | null } {
    if (extraId == null) return { tarifa: tarifaBase, nombre: null };
    const extra = extras.find(e => e.tipoExtraId === extraId);
    if (!extra) throw new BadRequestException('El complemento activo ya no está disponible para este equipo.');
    return { tarifa: tarifaBase + extra.rentaHora, nombre: extra.nombre };
  }

  /**
   * Construye los tramos de la noche entre el cierre de un día y el inicio del siguiente, a partir
   * de los puntos de corte indicados por el usuario. Sin cortes, es un solo tramo con el complemento
   * heredado del cierre — mismo comportamiento que antes de existir esta granularidad.
   */
  private construirTramosNocturnos(
    finAnterior:           number,
    horometroInicio:       number,
    cortes:                CorteNocturnoInput[] | undefined,
    complementoHeredadoId: string | null,
    tarifaEfectiva:        number,
    extras:                ExtraSeleccionadoSnapshot[],
  ): TramoHorometro[] {
    const puntos = [...(cortes ?? [])].sort((a, b) => a.horometroCorte - b.horometroCorte);

    for (const c of puntos) {
      if (c.horometroCorte <= finAnterior || c.horometroCorte >= horometroInicio)
        throw new BadRequestException(
          `El punto de corte (${c.horometroCorte} hrs) debe ser mayor a ${finAnterior} hrs (cierre de ayer) y menor a ${horometroInicio} hrs (inicio de hoy).`,
        );
    }
    for (let i = 1; i < puntos.length; i++) {
      if (puntos[i].horometroCorte === puntos[i - 1].horometroCorte)
        throw new BadRequestException('No puede haber dos puntos de corte con el mismo horómetro.');
    }

    const bordes  = [finAnterior, ...puntos.map(c => c.horometroCorte), horometroInicio];
    const activos = [complementoHeredadoId, ...puntos.map(c => c.extraId)];

    for (let i = 1; i < activos.length; i++) {
      if (activos[i] === activos[i - 1])
        throw new BadRequestException('Selecciona un complemento distinto al del tramo anterior en cada punto de corte.');
    }

    return activos.map((extraId, i) => {
      const desde = bordes[i];
      const hasta = bordes[i + 1];
      const horas = this.calc.diffHorometro(desde, hasta);
      const { tarifa: tarifaResuelta, nombre } = this.resolverTarifa(tarifaEfectiva, extraId, extras);
      const tarifa = tarifaResuelta + RECARGO_NOCTURNO;
      return {
        horometroDesde: desde,
        horometroHasta: hasta,
        horas,
        extraId,
        extraNombre: nombre,
        tarifa,
        costo: horas * tarifa,
      };
    });
  }

  private async registrarInicio(
    solicitudId:                   string,
    equipoId:                      string,
    fecha:                         Date,
    horometroInicio:               number,
    item:                          ItemPesadaSnapshot,
    extraIdInicial:                string | null | undefined,
    complementoNocturnoInicialId:  string | null | undefined,
    cortesNocturnos:               CorteNocturnoInput[] | undefined,
    username:                      string,
  ) {
    const tarifaEfectiva = item.tarifaEfectiva;

    // Buscar el día anterior para detectar horas nocturnas y heredar el complemento activo
    const fechaAnterior = new Date(fecha);
    fechaAnterior.setUTCDate(fechaAnterior.getUTCDate() - 1);

    const lecturaAnterior = await this.prisma.lecturaHorometro.findUnique({
      where: { solicitudId_equipoId_fecha: { solicitudId, equipoId, fecha: fechaAnterior } },
    });

    // Detectar horas nocturnas del día anterior — se facturan en sus propios tramos nocturnos
    if (lecturaAnterior?.horometroFin5pm != null) {
      const finAnterior    = parseFloat(lecturaAnterior.horometroFin5pm.toString());
      const horasNocturnas = this.calc.diffHorometro(finAnterior, horometroInicio);

      if (horasNocturnas > 0) {
        const tramosAnteriores       = (lecturaAnterior.tramos ?? []) as unknown as TramoHorometro[];
        const complementoPrimerTramo = complementoNocturnoInicialId !== undefined
          ? complementoNocturnoInicialId
          : (lecturaAnterior.complementoActivoId ?? null);
        const tramosNocturnos        = this.construirTramosNocturnos(
          finAnterior, horometroInicio, cortesNocturnos,
          complementoPrimerTramo, tarifaEfectiva, item.extras,
        );

        const costos        = this.calc.calcularCostoDia(tramosAnteriores, tramosNocturnos, tarifaEfectiva);
        const costoAnterior = lecturaAnterior.costoTotal != null
          ? parseFloat(lecturaAnterior.costoTotal.toString())
          : 0;
        const delta = costos.costoTotal - costoAnterior;

        await this.prisma.$transaction([
          this.prisma.lecturaHorometro.update({
            where: { id: lecturaAnterior.id },
            data: {
              horasNocturnas:         costos.horasNocturnas,
              horasDiurnasRaw:        costos.horasDiurnasRaw,
              horasDiurnasFacturadas: costos.horasDiurnasFacturadas,
              ajusteMinimo:           costos.ajusteMinimo,
              tarifaEfectiva,
              tramosNocturnos:        tramosNocturnos as unknown as Prisma.InputJsonValue,
              costoDiurno:            costos.costoDiurno,
              costoNocturno:          costos.costoNocturno,
              costoTotal:             costos.costoTotal,
            },
          }),
          this.prisma.solicitud.update({
            where: { id: solicitudId },
            data: { costoAcumuladoPesada: { increment: delta } },
          }),
        ]);
      } else if (cortesNocturnos != null && cortesNocturnos.length > 0) {
        throw new BadRequestException('No se detectaron horas nocturnas; no hay nada que dividir en tramos.');
      }
    }

    // Resolver el complemento inicial del día: override explícito > herencia del día anterior > ninguno
    let complementoActivoId: string | null = null;
    let complementoActivoNombre: string | null = null;
    let aplicarComplementoInicial = extraIdInicial !== undefined;

    if (extraIdInicial !== undefined) {
      if (extraIdInicial != null) {
        const extra = item.extras.find(e => e.tipoExtraId === extraIdInicial);
        if (!extra)
          throw new BadRequestException('El complemento indicado no está disponible para este equipo.');
        complementoActivoId     = extraIdInicial;
        complementoActivoNombre = extra.nombre;
      }

      const lecturaExistente = await this.prisma.lecturaHorometro.findUnique({
        where: { solicitudId_equipoId_fecha: { solicitudId, equipoId, fecha } },
      });
      const tramosExistentes = (lecturaExistente?.tramos ?? []) as unknown as TramoHorometro[];
      if (tramosExistentes.length > 0)
        throw new BadRequestException(
          'No se puede cambiar el complemento inicial porque ya hay tramos registrados este día. Usa "Registrar cambio de complemento" en su lugar.',
        );
    } else if (lecturaAnterior?.horometroFin5pm != null) {
      complementoActivoId     = lecturaAnterior.complementoActivoId ?? null;
      complementoActivoNombre = lecturaAnterior.complementoActivoNombre ?? null;
    }

    // Crear o actualizar el registro del día actual
    return this.prisma.lecturaHorometro.upsert({
      where:  { solicitudId_equipoId_fecha: { solicitudId, equipoId, fecha } },
      create: {
        solicitudId,
        equipoId,
        fecha,
        horometroInicio,
        tarifaEfectiva,
        registradoInicioBy: username,
        complementoActivoId,
        complementoActivoNombre,
      },
      update: {
        horometroInicio,
        registradoInicioBy: username,
        ...(aplicarComplementoInicial ? { complementoActivoId, complementoActivoNombre } : {}),
      },
    });
  }

  private async registrarFin5pm(
    solicitudId:     string,
    equipoId:        string,
    fecha:           Date,
    horometroFin5pm: number,
    item:            ItemPesadaSnapshot,
    username:        string,
  ) {
    const lectura = await this.prisma.lecturaHorometro.findUnique({
      where: { solicitudId_equipoId_fecha: { solicitudId, equipoId, fecha } },
    });

    if (!lectura)
      throw new NotFoundException(
        'No se encontró la lectura de inicio para esta fecha. Registra primero el horómetro inicial del día.',
      );
    if (lectura.horometroInicio == null)
      throw new ConflictException('El horómetro de inicio del día no está registrado.');

    const tramosActuales   = (lectura.tramos ?? []) as unknown as TramoHorometro[];
    const ultimaReferencia = tramosActuales.length > 0
      ? tramosActuales[tramosActuales.length - 1].horometroHasta
      : parseFloat(lectura.horometroInicio.toString());

    if (horometroFin5pm <= ultimaReferencia)
      throw new BadRequestException(
        `El horómetro de cierre (${horometroFin5pm} hrs) debe ser mayor al último registrado en el día (${ultimaReferencia} hrs).`,
      );

    const horas               = this.calc.diffHorometro(ultimaReferencia, horometroFin5pm);
    const { tarifa, nombre }  = this.resolverTarifa(item.tarifaEfectiva, lectura.complementoActivoId ?? null, item.extras);
    const tramoFinal: TramoHorometro = {
      horometroDesde: ultimaReferencia,
      horometroHasta: horometroFin5pm,
      horas,
      extraId:        lectura.complementoActivoId ?? null,
      extraNombre:    nombre,
      tarifa,
      costo:          horas * tarifa,
    };
    const tramos = [...tramosActuales, tramoFinal];

    // Costos provisionales (nocturnas aún desconocidas → sin tramos nocturnos)
    const costos        = this.calc.calcularCostoDia(tramos, [], item.tarifaEfectiva);
    const costoAnterior = lectura.costoTotal != null ? parseFloat(lectura.costoTotal.toString()) : 0;
    const delta         = costos.costoTotal - costoAnterior;

    const [updatedLectura] = await this.prisma.$transaction([
      this.prisma.lecturaHorometro.update({
        where: { id: lectura.id },
        data: {
          horometroFin5pm,
          tramos:                 tramos as unknown as Prisma.InputJsonValue,
          horasDiurnasRaw:        costos.horasDiurnasRaw,
          horasDiurnasFacturadas: costos.horasDiurnasFacturadas,
          ajusteMinimo:           costos.ajusteMinimo,
          horasNocturnas:         0,
          tarifaEfectiva:         item.tarifaEfectiva,
          costoDiurno:            costos.costoDiurno,
          costoNocturno:          0,
          costoTotal:             costos.costoTotal,
          registradoFinBy:        username,
        },
      }),
      this.prisma.solicitud.update({
        where: { id: solicitudId },
        data: { costoAcumuladoPesada: { increment: delta } },
      }),
    ]);

    return updatedLectura;
  }

  // ── Consulta de lecturas ─────────────────────────────────────────────────────

  async getLecturas(solicitudId: string, user: AuthenticatedUser) {
    const solicitud = await this.prisma.solicitud.findUnique({ where: { id: solicitudId } });

    if (!solicitud)
      throw new NotFoundException('Solicitud no encontrada.');
    if (!solicitud.esPesada)
      throw new BadRequestException('Esta solicitud no es de maquinaria pesada.');
    if (!tieneAccesoGlobal(user) && solicitud.creadaPor !== user.username && solicitud.gestionadaPor !== user.username)
      throw new ForbiddenException('No tienes acceso a esta solicitud.');

    const lecturas = await this.prisma.lecturaHorometro.findMany({
      where:   { solicitudId },
      orderBy: [{ equipoId: 'asc' }, { fecha: 'asc' }],
    });

    return lecturas.map(l => this.serializeLectura(l));
  }

  /** Resumen final por equipo (horómetros, horas y desglose de complementos) — disponible también para rentas ya cerradas. */
  async getResumenHorometro(solicitudId: string, user: AuthenticatedUser) {
    const solicitud = await this.prisma.solicitud.findUnique({ where: { id: solicitudId } });

    if (!solicitud)
      throw new NotFoundException('Solicitud no encontrada.');
    if (!solicitud.esPesada)
      throw new BadRequestException('Esta solicitud no es de maquinaria pesada.');
    if (!tieneAccesoGlobal(user) && solicitud.creadaPor !== user.username && solicitud.gestionadaPor !== user.username)
      throw new ForbiddenException('No tienes acceso a esta solicitud.');

    const items = solicitud.items as unknown as ItemPesadaSnapshot[];

    const resumenItems = await this.prisma.resumenItem.findMany({
      where:   { solicitudId, tipoItem: 'pesada' },
      include: { horometro: true },
    });

    const toNum = (v: any) => v != null ? parseFloat(v.toString()) : null;

    return resumenItems.map(ri => {
      const item = items.find(i => i.equipoId === ri.itemRef);
      return {
        equipoId:             ri.itemRef,
        numeracion:           item?.numeracion ?? null,
        descripcion:          item?.descripcion ?? null,
        horometroEntrega:     toNum(ri.horometro?.horometroEntrega),
        horometroDevolucion:  toNum(ri.horometro?.horometroDevolucion),
        horasDiurnasTotal:    toNum(ri.horometro?.horasDiurnasTotal),
        ajusteMinimoTotal:    toNum(ri.horometro?.ajusteMinimoTotal),
        horasNocturnas:       toNum(ri.horometro?.horasNocturnas),
        costoFinal:           toNum(ri.costoFinal),
        desgloseComplementos: (ri.horometro?.desgloseComplementos ?? []) as unknown as DesgloseComplemento[],
      };
    });
  }

  // ── Devolución pesada ────────────────────────────────────────────────────────

  async registrarDevolucionPesada(
    solicitudId: string,
    dto:         RegistrarDevolucionPesadaDto,
    user:        AuthenticatedUser,
  ) {
    const solicitud = await this.prisma.solicitud.findUnique({ where: { id: solicitudId } });

    if (!solicitud)
      throw new NotFoundException('Solicitud no encontrada.');
    if (!solicitud.esPesada)
      throw new BadRequestException('Esta solicitud no es de maquinaria pesada.');
    if (!tieneAccesoGlobal(user) && solicitud.creadaPor !== user.username && solicitud.gestionadaPor !== user.username)
      throw new ForbiddenException('Solo el encargado asignado puede registrar la devolución.');
    if (solicitud.estado !== 'ACTIVA')
      throw new ConflictException('Solo se puede registrar la devolución de rentas activas.');

    const snapshotItems  = solicitud.items as unknown as ItemPesadaSnapshot[];
    const devolucionesViejas = (solicitud.devolucionesParciales ?? []) as unknown as DevolucionEntry[];
    const yaDevueltosRefs = new Set<string>(
      devolucionesViejas.flatMap(d => d.items.map(i => i.itemRef)),
    );

    const itemsPendientes = snapshotItems.filter(i => !yaDevueltosRefs.has(i.equipoId));

    if (itemsPendientes.length === 0)
      throw new ConflictException('Todos los ítems de esta solicitud ya fueron devueltos.');

    const refsADevolver = dto.items && dto.items.length > 0
      ? new Set(dto.items.map(i => i.equipoId))
      : new Set(itemsPendientes.map(i => i.equipoId));

    const itemsADevolver = itemsPendientes.filter(i => refsADevolver.has(i.equipoId));

    if (itemsADevolver.length === 0)
      throw new BadRequestException('Ninguno de los ítems indicados está pendiente de devolución.');

    // Validar que el horómetro de devolución no sea menor al último fin 5PM registrado
    for (const item of itemsADevolver) {
      const devItem = dto.items?.find(d => d.equipoId === item.equipoId);
      if (devItem?.horometroDevolucion == null) continue;

      const ultimaLectura = await this.prisma.lecturaHorometro.findFirst({
        where:   { solicitudId, equipoId: item.equipoId },
        orderBy: { fecha: 'desc' },
      });

      if (ultimaLectura?.horometroFin5pm != null) {
        const finAnterior = parseFloat(ultimaLectura.horometroFin5pm.toString());
        if (devItem.horometroDevolucion < finAnterior) {
          throw new BadRequestException(
            `El horómetro de devolución del equipo #${item.numeracion} (${devItem.horometroDevolucion} hrs) no puede ser menor al último cierre registrado (${finAnterior} hrs).`,
          );
        }
      }
    }

    const fechaDevolucion = new Date();

    const actualizada = await this.prisma.$transaction(async (tx) => {
      const devolucionItems: DevolucionItemEntry[] = [];

      for (const item of itemsADevolver) {
        const devItem             = dto.items?.find(d => d.equipoId === item.equipoId);
        const horometroDevolucion = devItem?.horometroDevolucion ?? null;

        // Obtener última lectura del equipo
        const ultimaLectura = await tx.lecturaHorometro.findFirst({
          where:   { solicitudId, equipoId: item.equipoId },
          orderBy: { fecha: 'desc' },
        });

        // Finalizar el último día con horas nocturnas del horómetro de devolución
        if (horometroDevolucion != null && horometroDevolucion > 0 && ultimaLectura?.horometroFin5pm != null) {
          const finAnterior    = parseFloat(ultimaLectura.horometroFin5pm.toString());
          const horasNocturnas = this.calc.diffHorometro(finAnterior, horometroDevolucion);

          if (horasNocturnas > 0) {
            const tramosAnteriores = (ultimaLectura.tramos ?? []) as unknown as TramoHorometro[];
            // Devolución: no hay UI para dividir esta noche en tramos, se factura como uno solo
            // con el complemento heredado del cierre (mismo comportamiento que antes).
            const tramosNocturnos = this.construirTramosNocturnos(
              finAnterior, horometroDevolucion, undefined,
              ultimaLectura.complementoActivoId ?? null, item.tarifaEfectiva, item.extras,
            );

            const costos        = this.calc.calcularCostoDia(tramosAnteriores, tramosNocturnos, item.tarifaEfectiva);
            const costoAnterior = ultimaLectura.costoTotal != null
              ? parseFloat(ultimaLectura.costoTotal.toString())
              : 0;
            const delta = costos.costoTotal - costoAnterior;

            await tx.lecturaHorometro.update({
              where: { id: ultimaLectura.id },
              data: {
                horasNocturnas:         costos.horasNocturnas,
                horasDiurnasRaw:        costos.horasDiurnasRaw,
                horasDiurnasFacturadas: costos.horasDiurnasFacturadas,
                ajusteMinimo:           costos.ajusteMinimo,
                tarifaEfectiva:         item.tarifaEfectiva,
                tramosNocturnos:        tramosNocturnos as unknown as Prisma.InputJsonValue,
                costoDiurno:            costos.costoDiurno,
                costoNocturno:          costos.costoNocturno,
                costoTotal:             costos.costoTotal,
              },
            });

            if (delta !== 0) {
              await tx.solicitud.update({
                where: { id: solicitudId },
                data: { costoAcumuladoPesada: { increment: delta } },
              });
            }
          }
        }

        // Sumar todos los costos de las lecturas de este equipo (ya incluye nocturnas si se actualizaron)
        const todasLasLecturas = await tx.lecturaHorometro.findMany({
          where: { solicitudId, equipoId: item.equipoId },
        });

        const costoReal = todasLasLecturas.reduce(
          (sum, l) => sum + (l.costoTotal != null ? parseFloat(l.costoTotal.toString()) : 0),
          0,
        );

        // Completar ResumenItem + DetalleHorometro (creados al confirmar entrega)
        const horoDev           = horometroDevolucion != null && horometroDevolucion > 0 ? horometroDevolucion : null;
        const horasDiurnasTotal = todasLasLecturas.reduce((s, l) => s + (l.horasDiurnasFacturadas != null ? parseFloat(l.horasDiurnasFacturadas.toString()) : 0), 0);
        const ajusteMinimoTotal = todasLasLecturas.reduce((s, l) => s + (l.ajusteMinimo         != null ? parseFloat(l.ajusteMinimo.toString())          : 0), 0);
        const horasNoctTotal    = todasLasLecturas.reduce((s, l) => s + (l.horasNocturnas        != null ? parseFloat(l.horasNocturnas.toString())         : 0), 0);
        const desgloseComplementos = this.calcularDesgloseComplementos(todasLasLecturas);

        const resumenItem = await tx.resumenItem.findUnique({
          where: { solicitudId_itemRef: { solicitudId, itemRef: item.equipoId } },
        });

        if (resumenItem) {
          await tx.resumenItem.update({
            where: { id: resumenItem.id },
            data: { fechaDevolucion, diasCobrados: todasLasLecturas.length, costoFinal: costoReal },
          });
          await tx.detalleHorometro.update({
            where: { resumenItemId: resumenItem.id },
            data: {
              horometroDevolucion: horoDev,
              horasDiurnasTotal,
              ajusteMinimoTotal,
              horasNocturnas: horasNoctTotal,
              desgloseComplementos: desgloseComplementos as unknown as Prisma.InputJsonValue,
            },
          });
        }

        devolucionItems.push({
          itemRef:       item.equipoId,
          kind:          'pesada' as any,
          diasCobrados:  todasLasLecturas.length,
          costoReal,
          recargoTiempo: 0,
        });
      }

      const recargosAdicionales: CargoAdicional[] = (dto.recargosAdicionales ?? []).map(c => ({
        descripcion: c.descripcion,
        monto:       c.monto,
      }));

      const subtotalItems       = devolucionItems.reduce((s, i) => s + i.costoReal, 0);
      const subtotalAdicionales = recargosAdicionales.reduce((s, c) => s + c.monto, 0);
      const subtotalLote        = subtotalItems + subtotalAdicionales;

      let descuentoAplicado: DescuentoAplicado | undefined;
      if (dto.descuento) {
        const { tipo, valor } = dto.descuento;
        if (tipo === 'monto_fijo') {
          if (valor >= subtotalLote)
            throw new BadRequestException('El monto fijo de descuento debe ser menor al total calculado.');
          descuentoAplicado = { tipo, valor, montoOriginal: subtotalLote, montoFinal: valor };
        } else {
          if (valor <= 0 || valor >= 100)
            throw new BadRequestException('El porcentaje de descuento debe ser entre 0 y 100.');
          descuentoAplicado = { tipo, valor, montoOriginal: subtotalLote, montoFinal: subtotalLote * (1 - valor / 100) };
        }
      }

      const totalLote = descuentoAplicado?.montoFinal ?? subtotalLote;
      const esParcial = itemsADevolver.length < itemsPendientes.length;

      const nuevaEntrada: DevolucionEntry = {
        fechaDevolucion:     fechaDevolucion.toISOString(),
        registradoPor:       user.nombre,
        esParcial,
        tipoDevolucion:      'A_TIEMPO',
        items:               devolucionItems,
        recargosAdicionales,
        descuento:           descuentoAplicado,
        totalLote,
        liquidacionKey:      null,
      };

      const todasLasDevoluciones = [...devolucionesViejas, nuevaEntrada];
      const devolucionCompleta   = !esParcial;

      const updateData: Prisma.SolicitudUpdateInput = {
        devolucionesParciales: todasLasDevoluciones as object[],
        fechaUltimaDevolucion: fechaDevolucion,
      };

      let totalFinalPesada = 0;
      if (devolucionCompleta) {
        totalFinalPesada           = todasLasDevoluciones.reduce((s, d) => s + d.totalLote, 0);
        updateData.estado          = 'DEVUELTA';
        updateData.fechaDevolucion = fechaDevolucion;
        updateData.recargoTotal    = 0;
        updateData.totalFinal      = totalFinalPesada;
      } else {
        const refsDevueltosAhora = new Set([...yaDevueltosRefs, ...devolucionItems.map(i => i.itemRef)]);
        const itemsRestantes     = snapshotItems.filter(i => !refsDevueltosAhora.has(i.equipoId));
        if (itemsRestantes.length > 0 && solicitud.fechaInicioRenta) {
          const maxDias       = Math.max(...itemsRestantes.map(i => i.diasSolicitados ?? 1), 1);
          const nuevaFechaFin = new Date(solicitud.fechaInicioRenta.getTime() + maxDias * 86_400_000);
          updateData.fechaFinEstimada = nuevaFechaFin;
        }
      }

      const s = await tx.solicitud.update({
        where:   { id: solicitudId },
        data:    updateData,
        include: { cliente: true },
      });

      if (devolucionCompleta) {
        const anio = fechaDevolucion.getFullYear();
        const mes  = fechaDevolucion.getMonth() + 1;
        await tx.recaudacionMensual.upsert({
          where:  { encargado_anio_mes: { encargado: solicitud.gestionadaPor ?? solicitud.creadaPor, anio, mes } },
          create: { encargado: solicitud.gestionadaPor ?? solicitud.creadaPor, anio, mes, pesada: totalFinalPesada },
          update: { pesada: { increment: totalFinalPesada } },
        });
      }

      return s;
    });

    return actualizada;
  }

  // ── Helpers ─────────────────────────────────────────────────────────────────

  /**
   * Suma horas/costo de todos los tramos (diurnos y nocturnos) de todas las lecturas, agrupados
   * por complemento. Para lecturas anteriores a esta funcionalidad (sin tramosNocturnos guardados
   * pero con horasNocturnas > 0), se usa como respaldo el complemento con el que cerró ese día.
   */
  private calcularDesgloseComplementos(
    lecturas: {
      tramos: unknown; tramosNocturnos: unknown; horasNocturnas: unknown; costoNocturno: unknown;
      complementoActivoId: string | null; complementoActivoNombre: string | null;
    }[],
  ): DesgloseComplemento[] {
    const porComplemento = new Map<string, DesgloseComplemento>();
    const toNum = (v: unknown) => v != null ? parseFloat((v as any).toString()) : 0;

    const acumular = (extraId: string | null, extraNombre: string | null, horas: number, costo: number) => {
      if (horas === 0 && costo === 0) return;
      const clave = extraId ?? '__ninguno__';
      const acumulado = porComplemento.get(clave) ?? { extraId, extraNombre, horas: 0, costo: 0 };
      acumulado.horas += horas;
      acumulado.costo += costo;
      porComplemento.set(clave, acumulado);
    };

    for (const lectura of lecturas) {
      const tramos = (lectura.tramos ?? []) as unknown as TramoHorometro[];
      for (const t of tramos) acumular(t.extraId, t.extraNombre, t.horas, t.costo);

      const tramosNocturnos = (lectura.tramosNocturnos ?? []) as unknown as TramoHorometro[];
      if (tramosNocturnos.length > 0) {
        for (const t of tramosNocturnos) acumular(t.extraId, t.extraNombre, t.horas, t.costo);
      } else {
        // Respaldo para lecturas anteriores a tramosNocturnos.
        const horasNocturnas = toNum(lectura.horasNocturnas);
        const costoNocturno  = toNum(lectura.costoNocturno);
        if (horasNocturnas > 0) acumular(lectura.complementoActivoId ?? null, lectura.complementoActivoNombre ?? null, horasNocturnas, costoNocturno);
      }
    }

    return Array.from(porComplemento.values());
  }

  private serializeLectura(l: any) {
    const toNum = (v: any) => v != null ? parseFloat(v.toString()) : null;
    return {
      id:                    l.id,
      solicitudId:           l.solicitudId,
      equipoId:              l.equipoId,
      fecha:                 l.fecha instanceof Date ? l.fecha.toISOString().substring(0, 10) : l.fecha,
      horometroInicio:       toNum(l.horometroInicio),
      horometroFin5pm:       toNum(l.horometroFin5pm),
      horasNocturnas:        toNum(l.horasNocturnas),
      horasDiurnasRaw:       toNum(l.horasDiurnasRaw),
      horasDiurnasFacturadas: toNum(l.horasDiurnasFacturadas),
      ajusteMinimo:          toNum(l.ajusteMinimo),
      tarifaEfectiva:        toNum(l.tarifaEfectiva),
      costoDiurno:           toNum(l.costoDiurno),
      costoNocturno:         toNum(l.costoNocturno),
      costoTotal:            toNum(l.costoTotal),
      tramos:                  (l.tramos ?? []) as TramoHorometro[],
      tramosNocturnos:         (l.tramosNocturnos ?? []) as TramoHorometro[],
      complementoActivoId:     l.complementoActivoId ?? null,
      complementoActivoNombre: l.complementoActivoNombre ?? null,
      registradoInicioBy:    l.registradoInicioBy,
      registradoFinBy:       l.registradoFinBy,
      createdAt:             l.createdAt,
      updatedAt:             l.updatedAt,
    };
  }
}
