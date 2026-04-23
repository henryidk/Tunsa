import {
  Injectable, BadRequestException, ForbiddenException,
  NotFoundException, ConflictException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { HorometroCalcService } from './horometro-calc.service';
import { RegistrarLecturaDto } from './dto/lectura-horometro.dto';
import { RegistrarDevolucionPesadaDto } from './dto/registrar-devolucion-pesada.dto';
import type { AuthenticatedUser } from '../auth/interfaces/jwt-payload.interface';
import type { DevolucionEntry, DevolucionItemEntry, CargoAdicional } from './recargo.util';

const ROLES_CON_ACCESO_GLOBAL = new Set(['admin', 'secretaria']);

function tieneAccesoGlobal(user: AuthenticatedUser): boolean {
  return ROLES_CON_ACCESO_GLOBAL.has(user.role);
}

/** Shape mínima del item pesada en el JSON de solicitud. */
interface ItemPesadaSnapshot {
  kind:          'pesada';
  equipoId:      string;
  numeracion:    string;
  descripcion:   string;
  conMartillo:   boolean;
  tarifaEfectiva: number;
  diasSolicitados: number;
  duracion:       number;
  unidad:         string;
  subtotal:       number;
}

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
    if (solicitud.creadaPor !== user.username)
      throw new ForbiddenException('Solo el encargado que creó la solicitud puede registrar lecturas.');

    const items = solicitud.items as unknown as ItemPesadaSnapshot[];
    const item  = items.find(i => i.equipoId === dto.equipoId);
    if (!item)
      throw new BadRequestException(`El equipo ${dto.equipoId} no pertenece a esta solicitud.`);

    const fechaDate = new Date(dto.fecha + 'T00:00:00.000Z');

    if (dto.tipo === 'inicio') {
      return this.registrarInicio(solicitudId, dto.equipoId, fechaDate, dto.valor, item.tarifaEfectiva, user.username);
    }
    return this.registrarFin5pm(solicitudId, dto.equipoId, fechaDate, dto.valor, item.tarifaEfectiva, user.username);
  }

  private async registrarInicio(
    solicitudId:     string,
    equipoId:        string,
    fecha:           Date,
    horometroInicio: number,
    tarifaEfectiva:  number,
    username:        string,
  ) {
    // Buscar el día anterior para detectar horas nocturnas
    const fechaAnterior = new Date(fecha);
    fechaAnterior.setUTCDate(fechaAnterior.getUTCDate() - 1);

    const lecturaAnterior = await this.prisma.lecturaHorometro.findUnique({
      where: { solicitudId_equipoId_fecha: { solicitudId, equipoId, fecha: fechaAnterior } },
    });

    // Detectar horas nocturnas del día anterior
    if (lecturaAnterior?.horometroFin5pm != null) {
      const finAnterior     = parseFloat(lecturaAnterior.horometroFin5pm.toString());
      const horasNocturnas  = this.calc.diffHorometro(finAnterior, horometroInicio);

      if (horasNocturnas > 0) {
        const diurnas  = lecturaAnterior.horometroInicio != null
          ? this.calc.diffHorometro(
              parseFloat(lecturaAnterior.horometroInicio.toString()),
              finAnterior,
            )
          : 0;

        const costos = this.calc.calcularCostoDia(diurnas, horasNocturnas, tarifaEfectiva);

        await this.prisma.lecturaHorometro.update({
          where: { id: lecturaAnterior.id },
          data: {
            horasNocturnas:         costos.horasNocturnas,
            horasDiurnasRaw:        costos.horasDiurnasRaw,
            horasDiurnasFacturadas: costos.horasDiurnasFacturadas,
            ajusteMinimo:           costos.ajusteMinimo,
            tarifaEfectiva,
            costoDiurno:            costos.costoDiurno,
            costoNocturno:          costos.costoNocturno,
            costoTotal:             costos.costoTotal,
          },
        });
      }
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
      },
      update: {
        horometroInicio,
        registradoInicioBy: username,
      },
    });
  }

  private async registrarFin5pm(
    solicitudId:    string,
    equipoId:       string,
    fecha:          Date,
    horometroFin5pm: number,
    tarifaEfectiva: number,
    username:       string,
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

    const horometroInicioNum = parseFloat(lectura.horometroInicio.toString());
    const horasDiurnasRaw    = this.calc.diffHorometro(horometroInicioNum, horometroFin5pm);

    // Costos provisionales (nocturnas aún desconocidas → 0)
    const costos = this.calc.calcularCostoDia(horasDiurnasRaw, 0, tarifaEfectiva);

    return this.prisma.lecturaHorometro.update({
      where: { id: lectura.id },
      data: {
        horometroFin5pm,
        horasDiurnasRaw:        costos.horasDiurnasRaw,
        horasDiurnasFacturadas: costos.horasDiurnasFacturadas,
        ajusteMinimo:           costos.ajusteMinimo,
        horasNocturnas:         0,
        tarifaEfectiva,
        costoDiurno:            costos.costoDiurno,
        costoNocturno:          0,
        costoTotal:             costos.costoTotal,
        registradoFinBy:        username,
      },
    });
  }

  // ── Consulta de lecturas ─────────────────────────────────────────────────────

  async getLecturas(solicitudId: string, user: AuthenticatedUser) {
    const solicitud = await this.prisma.solicitud.findUnique({ where: { id: solicitudId } });

    if (!solicitud)
      throw new NotFoundException('Solicitud no encontrada.');
    if (!solicitud.esPesada)
      throw new BadRequestException('Esta solicitud no es de maquinaria pesada.');
    if (!tieneAccesoGlobal(user) && solicitud.creadaPor !== user.username)
      throw new ForbiddenException('No tienes acceso a esta solicitud.');

    const lecturas = await this.prisma.lecturaHorometro.findMany({
      where:   { solicitudId },
      orderBy: [{ equipoId: 'asc' }, { fecha: 'asc' }],
    });

    return lecturas.map(l => this.serializeLectura(l));
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
    if (!tieneAccesoGlobal(user) && solicitud.creadaPor !== user.username)
      throw new ForbiddenException('Solo el encargado que creó la solicitud puede registrar la devolución.');
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

    const fechaDevolucion = new Date();
    const devolucionItems: DevolucionItemEntry[] = [];

    for (const item of itemsADevolver) {
      // Buscar el horometro de devolucion para este equipo
      const devItem = dto.items?.find(d => d.equipoId === item.equipoId);
      const horometroDevolucion = devItem?.horometroDevolucion;

      // Obtener última lectura del equipo
      const ultimaLectura = await this.prisma.lecturaHorometro.findFirst({
        where:   { solicitudId, equipoId: item.equipoId },
        orderBy: { fecha: 'desc' },
      });

      // Finalizar el último día con el horómetro de devolución
      if (horometroDevolucion != null && ultimaLectura?.horometroFin5pm != null) {
        const finAnterior    = parseFloat(ultimaLectura.horometroFin5pm.toString());
        const horasNocturnas = this.calc.diffHorometro(finAnterior, horometroDevolucion);

        if (horasNocturnas > 0) {
          const diurnas = ultimaLectura.horometroInicio != null
            ? this.calc.diffHorometro(
                parseFloat(ultimaLectura.horometroInicio.toString()),
                finAnterior,
              )
            : 0;

          const costos = this.calc.calcularCostoDia(diurnas, horasNocturnas, item.tarifaEfectiva);

          await this.prisma.lecturaHorometro.update({
            where: { id: ultimaLectura.id },
            data: {
              horasNocturnas:         costos.horasNocturnas,
              horasDiurnasRaw:        costos.horasDiurnasRaw,
              horasDiurnasFacturadas: costos.horasDiurnasFacturadas,
              ajusteMinimo:           costos.ajusteMinimo,
              tarifaEfectiva:         item.tarifaEfectiva,
              costoDiurno:            costos.costoDiurno,
              costoNocturno:          costos.costoNocturno,
              costoTotal:             costos.costoTotal,
            },
          });
        }
      }

      // Sumar todos los costos de las lecturas de este equipo
      const todasLasLecturas = await this.prisma.lecturaHorometro.findMany({
        where: { solicitudId, equipoId: item.equipoId },
      });

      const costoReal = todasLasLecturas.reduce(
        (sum, l) => sum + (l.costoTotal != null ? parseFloat(l.costoTotal.toString()) : 0),
        0,
      );

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

    const subtotalItems      = devolucionItems.reduce((s, i) => s + i.costoReal,     0);
    const subtotalAdicionales = recargosAdicionales.reduce((s, c) => s + c.monto,    0);
    const totalLote          = subtotalItems + subtotalAdicionales;

    const esParcial = itemsADevolver.length < itemsPendientes.length;

    const nuevaEntrada: DevolucionEntry = {
      fechaDevolucion:     fechaDevolucion.toISOString(),
      registradoPor:       user.username,
      esParcial,
      tipoDevolucion:      'A_TIEMPO',
      items:               devolucionItems,
      recargosAdicionales,
      totalLote,
      liquidacionKey:      null,
    };

    const todasLasDevoluciones = [...devolucionesViejas, nuevaEntrada];
    const devolucionCompleta   = !esParcial;

    const updateData: Prisma.SolicitudUpdateInput = {
      devolucionesParciales:  todasLasDevoluciones as object[],
      fechaUltimaDevolucion:  fechaDevolucion,
    };

    if (devolucionCompleta) {
      const totalFinal = todasLasDevoluciones.reduce((s, d) => s + d.totalLote, 0);
      updateData.estado          = 'DEVUELTA';
      updateData.fechaDevolucion = fechaDevolucion;
      updateData.recargoTotal    = 0;
      updateData.totalFinal      = totalFinal;
    } else {
      const refsDevueltosAhora = new Set([
        ...yaDevueltosRefs,
        ...devolucionItems.map(i => i.itemRef),
      ]);
      const itemsRestantes = snapshotItems.filter(i => !refsDevueltosAhora.has(i.equipoId));
      // Para pesada, fechaFinEstimada se mantiene como estaba (no recalculamos por horómetro)
      if (itemsRestantes.length > 0 && solicitud.fechaInicioRenta) {
        const maxDias = Math.max(...itemsRestantes.map(i => i.diasSolicitados));
        const nuevaFechaFin = new Date(
          solicitud.fechaInicioRenta.getTime() + maxDias * 86_400_000,
        );
        updateData.fechaFinEstimada = nuevaFechaFin;
      }
    }

    const actualizada = await this.prisma.solicitud.update({
      where:   { id: solicitudId },
      data:    updateData,
      include: { cliente: true },
    });

    return actualizada;
  }

  // ── Helpers ─────────────────────────────────────────────────────────────────

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
      registradoInicioBy:    l.registradoInicioBy,
      registradoFinBy:       l.registradoFinBy,
      createdAt:             l.createdAt,
      updatedAt:             l.updatedAt,
    };
  }
}
