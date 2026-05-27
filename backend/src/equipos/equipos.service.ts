import {
  Injectable,
  ConflictException,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import type { ModalidadTipo, Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { CreateEquipoDto, ExtraEquipoDto } from './dto/create-equipo.dto';
import { UpdateEquipoDto } from './dto/update-equipo.dto';
import { BajaEquipoDto } from './dto/baja-equipo.dto';
import { fechaHoyGT } from '../common/utils/date.util';

const EQUIPO_INCLUDE = {
  tipo:      { select: { id: true, nombre: true, modalidad: true } },
  categoria: { select: { id: true, nombre: true, tipoId: true } },
  extras:    { include: { tipoExtra: { select: { id: true, nombre: true, descripcion: true } } } },
} as const;

type EquipoConRelaciones = Prisma.EquipoGetPayload<{ include: typeof EQUIPO_INCLUDE }>;

@Injectable()
export class EquiposService {
  constructor(private prisma: PrismaService) {}

  // ── Helpers ─────────────────────────────────────────────────────────────

  private serialize(equipo: EquipoConRelaciones) {
    return {
      ...equipo,
      fechaCompra: equipo.fechaCompra instanceof Date ? equipo.fechaCompra.toISOString().substring(0, 10) : equipo.fechaCompra,
      fechaBaja:   equipo.fechaBaja   instanceof Date ? equipo.fechaBaja.toISOString().substring(0, 10)   : equipo.fechaBaja,
      montoCompra: equipo.montoCompra != null ? parseFloat(equipo.montoCompra.toString()) : null,
      rentaHora:   equipo.rentaHora   != null ? parseFloat(equipo.rentaHora.toString())   : null,
      rentaDia:    equipo.rentaDia    != null ? parseFloat(equipo.rentaDia.toString())     : null,
      rentaSemana: equipo.rentaSemana != null ? parseFloat(equipo.rentaSemana.toString())  : null,
      rentaMes:    equipo.rentaMes    != null ? parseFloat(equipo.rentaMes.toString())     : null,
      extras: equipo.extras.map(e => ({
        id:          e.id,
        tipoExtraId: e.tipoExtraId,
        nombre:      e.tipoExtra.nombre,
        descripcion: e.tipoExtra.descripcion ?? null,
        rentaHora:   parseFloat(e.rentaHora.toString()),
      })),
    };
  }

  /**
   * Valida que el TipoEquipo exista y que, si se provee categoriaId,
   * la categoría pertenezca al mismo tipo.
   */
  private async validarTipoYCategoria(
    tipoId: string,
    categoriaId?: string | null,
  ): Promise<{ modalidad: ModalidadTipo; nombre: string }> {
    const tipo = await this.prisma.tipoEquipo.findUnique({ where: { id: tipoId } });
    if (!tipo) throw new BadRequestException(`Tipo de equipo no encontrado: "${tipoId}"`);

    if (categoriaId) {
      const cat = await this.prisma.categoria.findUnique({ where: { id: categoriaId } });
      if (!cat) throw new BadRequestException(`Categoría no encontrada: "${categoriaId}"`);
      if (cat.tipoId !== tipoId) {
        throw new BadRequestException(
          `La categoría "${cat.nombre}" pertenece al tipo "${cat.tipoId}", ` +
          `no al tipo "${tipo.nombre}" indicado para este equipo.`,
        );
      }
    }

    return { modalidad: tipo.modalidad, nombre: tipo.nombre };
  }

  /**
   * Aplica las reglas de precio según la modalidad del tipo.
   * Separado del nombre del tipo para que renombrar un tipo no afecte el comportamiento.
   */
  private normalizarPrecios(
    modalidad: ModalidadTipo,
    precios: { rentaHora?: number | null; rentaDia?: number | null; rentaSemana?: number | null; rentaMes?: number | null },
  ) {
    if (modalidad === 'PESADA') {
      return { rentaHora: precios.rentaHora ?? null, rentaDia: null, rentaSemana: null, rentaMes: null };
    }
    if (modalidad === 'LIVIANA') {
      return { rentaHora: null, rentaDia: precios.rentaDia ?? null, rentaSemana: precios.rentaSemana ?? null, rentaMes: precios.rentaMes ?? null };
    }
    // USO_PROPIO
    return { rentaHora: null, rentaDia: null, rentaSemana: null, rentaMes: null };
  }

  /**
   * Valida que todos los tipoExtraId existan.
   * Solo se llaman extras en equipos PESADA, pero la validación de modalidad
   * la hace el llamador.
   */
  private async validarExtras(extras: ExtraEquipoDto[]): Promise<void> {
    if (extras.length === 0) return;
    const ids = extras.map(e => e.tipoExtraId);
    const found = await this.prisma.tipoExtra.findMany({ where: { id: { in: ids } } });
    if (found.length !== ids.length) {
      const foundIds = new Set(found.map(f => f.id));
      const missing  = ids.filter(id => !foundIds.has(id));
      throw new BadRequestException(`TipoExtra no encontrado: ${missing.join(', ')}`);
    }
  }

  private buildChanges(
    equipo: EquipoConRelaciones,
    dto: UpdateEquipoDto,
    categoriaNuevaNombre?: string | null,
    tipoNuevoNombre?: string,
    preciosEfectivos?: { rentaHora: number | null; rentaDia: number | null; rentaSemana: number | null; rentaMes: number | null },
  ) {
    const changes: { campo: string; valorAnterior: string | null; valorNuevo: string | null }[] = [];

    const fmt    = (v: string | null | undefined): string | null => (v != null ? v : null);
    const fmtNum = (v: number | Prisma.Decimal | null | undefined): string | null => (v != null ? parseFloat(v.toString()).toString() : null);
    const track  = (campo: string, va: string | null, vn: string | null) => {
      if (va !== vn) changes.push({ campo, valorAnterior: va, valorNuevo: vn });
    };

    if (dto.descripcion !== undefined) track('descripcion', fmt(equipo.descripcion),  fmt(dto.descripcion));
    if (dto.tipoId      !== undefined) track('tipo',        fmt(equipo.tipo?.nombre), tipoNuevoNombre !== undefined ? tipoNuevoNombre : fmt(dto.tipoId));
    if (dto.categoriaId !== undefined) track('categoria',   fmt(equipo.categoria?.nombre), categoriaNuevaNombre !== undefined ? categoriaNuevaNombre : fmt(dto.categoriaId));
    if (dto.serie       !== undefined) track('serie',       fmt(equipo.serie),             fmt(dto.serie || null));

    if (dto.fechaCompra !== undefined) {
      const va = equipo.fechaCompra instanceof Date
        ? equipo.fechaCompra.toISOString().substring(0, 10)
        : String(equipo.fechaCompra).substring(0, 10);
      track('fechaCompra', va, dto.fechaCompra);
    }

    if (dto.montoCompra !== undefined) track('montoCompra', fmtNum(equipo.montoCompra), fmtNum(dto.montoCompra));

    if (preciosEfectivos) {
      track('rentaHora',   fmtNum(equipo.rentaHora),   fmtNum(preciosEfectivos.rentaHora));
      track('rentaDia',    fmtNum(equipo.rentaDia),    fmtNum(preciosEfectivos.rentaDia));
      track('rentaSemana', fmtNum(equipo.rentaSemana), fmtNum(preciosEfectivos.rentaSemana));
      track('rentaMes',    fmtNum(equipo.rentaMes),    fmtNum(preciosEfectivos.rentaMes));
    } else {
      if (dto.rentaHora   !== undefined) track('rentaHora',   fmtNum(equipo.rentaHora),   fmtNum(dto.rentaHora   ?? null));
      if (dto.rentaDia    !== undefined) track('rentaDia',    fmtNum(equipo.rentaDia),    fmtNum(dto.rentaDia    ?? null));
      if (dto.rentaSemana !== undefined) track('rentaSemana', fmtNum(equipo.rentaSemana), fmtNum(dto.rentaSemana ?? null));
      if (dto.rentaMes    !== undefined) track('rentaMes',    fmtNum(equipo.rentaMes),    fmtNum(dto.rentaMes    ?? null));
    }

    return changes;
  }

  // ── CRUD ─────────────────────────────────────────────────────────────────

  async findAll(page = 1, pageSize = 200) {
    const skip  = (page - 1) * pageSize;
    const [equipos, total] = await Promise.all([
      this.prisma.equipo.findMany({
        include:  EQUIPO_INCLUDE,
        orderBy:  [{ isActive: 'desc' }, { createdAt: 'asc' }],
        skip,
        take: pageSize,
      }),
      this.prisma.equipo.count(),
    ]);
    return {
      data:       equipos.map(e => this.serialize(e)),
      total,
      page,
      pageSize,
      totalPages: Math.ceil(total / pageSize),
    };
  }

  async findById(id: string) {
    const equipo = await this.prisma.equipo.findUnique({ where: { id }, include: EQUIPO_INCLUDE });
    if (!equipo) throw new NotFoundException('Equipo no encontrado');
    return this.serialize(equipo);
  }

  async create(dto: CreateEquipoDto, usuarioNombre: string) {
    const taken = await this.prisma.equipo.findUnique({ where: { numeracion: dto.numeracion } });
    if (taken) throw new ConflictException(`Ya existe un equipo con la numeración "${dto.numeracion}"`);

    const { modalidad } = await this.validarTipoYCategoria(dto.tipoId, dto.categoriaId);
    const precios       = this.normalizarPrecios(modalidad, {
      rentaHora: dto.rentaHora, rentaDia: dto.rentaDia, rentaSemana: dto.rentaSemana, rentaMes: dto.rentaMes,
    });

    const extrasDto = modalidad === 'PESADA' ? (dto.extras ?? []) : [];
    if (extrasDto.length > 0) await this.validarExtras(extrasDto);

    const equipo = await this.prisma.equipo.create({
      data: {
        numeracion:  dto.numeracion,
        descripcion: dto.descripcion,
        serie:       dto.serie       || null,
        fechaCompra: new Date(dto.fechaCompra),
        montoCompra: dto.montoCompra ?? null,
        tipoId:      dto.tipoId,
        categoriaId: dto.categoriaId ?? null,
        ...precios,
        extras: extrasDto.length > 0
          ? { create: extrasDto.map(e => ({ tipoExtraId: e.tipoExtraId, rentaHora: e.rentaHora })) }
          : undefined,
      },
      include: EQUIPO_INCLUDE,
    });

    await this.prisma.bitacora.create({
      data: {
        modulo:        'equipo',
        entidadId:     equipo.id,
        entidadNombre: `#${equipo.numeracion} ${equipo.descripcion}`,
        campo:         'creación',
        valorAnterior: null,
        valorNuevo:    equipo.numeracion,
        realizadoPor:  usuarioNombre,
      },
    });

    return this.serialize(equipo);
  }

  async update(id: string, dto: UpdateEquipoDto, usuarioNombre: string) {
    const equipo = await this.prisma.equipo.findUnique({ where: { id }, include: EQUIPO_INCLUDE });
    if (!equipo) throw new NotFoundException('Equipo no encontrado');

    if (dto.numeracion && dto.numeracion !== equipo.numeracion) {
      const taken = await this.prisma.equipo.findUnique({ where: { numeracion: dto.numeracion } });
      if (taken) throw new ConflictException(`Ya existe un equipo con la numeración "${dto.numeracion}"`);
    }

    const tipoIdEfectivo = dto.tipoId ?? equipo.tipoId;

    if (dto.tipoId && dto.tipoId !== equipo.tipoId && equipo.categoriaId && dto.categoriaId === undefined) {
      throw new BadRequestException(
        'Al cambiar el tipo debes indicar explícitamente la nueva categoría ' +
        '(o null para desvincularla), ya que la categoría actual no pertenece al nuevo tipo.',
      );
    }

    const categoriaIdEfectiva = dto.categoriaId !== undefined ? dto.categoriaId : equipo.categoriaId;
    let modalidadEfectiva: ModalidadTipo;
    let tipoNuevoNombre: string | undefined = undefined;
    if (dto.tipoId !== undefined || dto.categoriaId !== undefined) {
      const tipoValidado = await this.validarTipoYCategoria(tipoIdEfectivo, categoriaIdEfectiva);
      modalidadEfectiva = tipoValidado.modalidad;
      if (dto.tipoId !== undefined) tipoNuevoNombre = tipoValidado.nombre;
    } else {
      modalidadEfectiva = equipo.tipo.modalidad;
    }

    let categoriaNuevaNombre: string | null | undefined = undefined;
    if (dto.categoriaId !== undefined) {
      if (dto.categoriaId === null) {
        categoriaNuevaNombre = null;
      } else {
        const cat = await this.prisma.categoria.findUnique({ where: { id: dto.categoriaId } });
        categoriaNuevaNombre = cat?.nombre ?? null;
      }
    }

    const tipoRealmenteCambia = dto.tipoId !== undefined && dto.tipoId !== equipo.tipoId;
    const algoPrecio = dto.rentaHora !== undefined || dto.rentaDia !== undefined
                    || dto.rentaSemana !== undefined || dto.rentaMes !== undefined
                    || tipoRealmenteCambia;

    const toNum = (v: unknown): number | null => v != null ? parseFloat(String(v)) : null;

    const preciosNormalizados = algoPrecio
      ? this.normalizarPrecios(modalidadEfectiva, {
          rentaHora:   dto.rentaHora   !== undefined ? dto.rentaHora   : toNum(equipo.rentaHora),
          rentaDia:    dto.rentaDia    !== undefined ? dto.rentaDia    : toNum(equipo.rentaDia),
          rentaSemana: dto.rentaSemana !== undefined ? dto.rentaSemana : toNum(equipo.rentaSemana),
          rentaMes:    dto.rentaMes    !== undefined ? dto.rentaMes    : toNum(equipo.rentaMes),
        })
      : null;

    const preciosActualizados = preciosNormalizados ?? {};

    // Actualizar extras si el DTO los incluye (reemplazar completo: borrar + recrear)
    const extrasDto = dto.extras !== undefined ? (dto.extras ?? []) : null;
    const debeActualizarExtras = extrasDto !== null && modalidadEfectiva === 'PESADA';
    const debeVaciarExtras     = extrasDto !== null && modalidadEfectiva !== 'PESADA';

    if (debeActualizarExtras && extrasDto!.length > 0) {
      await this.validarExtras(extrasDto!);
    }

    const changes = this.buildChanges(
      equipo,
      dto,
      categoriaNuevaNombre,
      tipoNuevoNombre,
      preciosNormalizados ?? undefined,
    );

    const updated = await this.prisma.$transaction(async tx => {
      if (debeActualizarExtras || debeVaciarExtras) {
        await tx.extraEquipo.deleteMany({ where: { equipoId: id } });
      }

      return tx.equipo.update({
        where: { id },
        data: {
          ...(dto.numeracion  !== undefined && { numeracion:  dto.numeracion }),
          ...(dto.descripcion !== undefined && { descripcion: dto.descripcion }),
          ...(dto.tipoId      !== undefined && { tipoId:      dto.tipoId }),
          ...(dto.categoriaId !== undefined && { categoriaId: dto.categoriaId }),
          ...(dto.serie       !== undefined && { serie:       dto.serie || null }),
          ...(dto.fechaCompra !== undefined && { fechaCompra: new Date(dto.fechaCompra) }),
          ...(dto.montoCompra !== undefined && { montoCompra: dto.montoCompra }),
          ...preciosActualizados,
          ...(debeActualizarExtras && extrasDto!.length > 0 && {
            extras: { create: extrasDto!.map(e => ({ tipoExtraId: e.tipoExtraId, rentaHora: e.rentaHora })) },
          }),
        },
        include: EQUIPO_INCLUDE,
      });
    });

    if (changes.length > 0) {
      await this.prisma.bitacora.createMany({
        data: changes.map(c => ({
          modulo:        'equipo',
          entidadId:     id,
          entidadNombre: `#${equipo.numeracion} ${equipo.descripcion}`,
          campo:         c.campo,
          valorAnterior: c.valorAnterior,
          valorNuevo:    c.valorNuevo,
          realizadoPor:  usuarioNombre,
        })),
      });
    }

    return this.serialize(updated);
  }

  async darDeBaja(id: string, dto: BajaEquipoDto) {
    const equipo = await this.prisma.equipo.findUnique({ where: { id } });
    if (!equipo) throw new NotFoundException('Equipo no encontrado');
    if (!equipo.isActive) throw new ConflictException('El equipo ya está dado de baja');

    const updated = await this.prisma.equipo.update({
      where: { id },
      data: { isActive: false, motivoBaja: dto.motivo || null, fechaBaja: fechaHoyGT() },
      include: EQUIPO_INCLUDE,
    });
    return this.serialize(updated);
  }

  async reactivar(id: string) {
    const equipo = await this.prisma.equipo.findUnique({ where: { id } });
    if (!equipo) throw new NotFoundException('Equipo no encontrado');
    if (equipo.isActive) throw new ConflictException('El equipo ya está activo');

    const updated = await this.prisma.equipo.update({
      where: { id },
      data: { isActive: true, motivoBaja: null, fechaBaja: null },
      include: EQUIPO_INCLUDE,
    });
    return this.serialize(updated);
  }

  // ── Disponibilidad de flota ───────────────────────────────────────────────

  async getDisponibilidad() {
    const hoyGT = fechaHoyGT();

    const [equipos, itemsEnRenta] = await Promise.all([
      this.prisma.equipo.findMany({
        where:   { isActive: true },
        select: {
          id:          true,
          numeracion:  true,
          descripcion: true,
          tipo:        { select: { modalidad: true } },
          categoria:   { select: { nombre: true } },
        },
        orderBy: { numeracion: 'asc' },
      }),
      this.prisma.resumenItem.findMany({
        where: {
          fechaDevolucion: null,
          equipoId:        { not: null },
          solicitud:       { estado: 'ACTIVA' },
        },
        select: {
          equipoId: true,
          solicitud: {
            select: {
              id:               true,
              folio:            true,
              esPesada:         true,
              fechaFinEstimada: true,
              creadaPor:        true,
              cliente:          { select: { nombre: true } },
            },
          },
        },
      }),
    ]);

    const rentalMap = new Map<string, {
      id:               string;
      folio:            string | null;
      clienteNombre:    string;
      fechaFinEstimada: string | null;
      esPesada:         boolean;
      creadaPor:        string;
    }>();

    for (const item of itemsEnRenta) {
      if (!item.equipoId || rentalMap.has(item.equipoId)) continue;
      rentalMap.set(item.equipoId, {
        id:               item.solicitud.id,
        folio:            item.solicitud.folio,
        clienteNombre:    item.solicitud.cliente.nombre,
        fechaFinEstimada: item.solicitud.fechaFinEstimada
          ? item.solicitud.fechaFinEstimada.toISOString().substring(0, 10)
          : null,
        esPesada:         item.solicitud.esPesada,
        creadaPor:        item.solicitud.creadaPor,
      });
    }

    const items = equipos.map(equipo => {
      const esPesada = equipo.tipo.modalidad === 'PESADA';
      const renta    = rentalMap.get(equipo.id);

      if (!renta) {
        return {
          equipoId:    equipo.id,
          numeracion:  equipo.numeracion,
          descripcion: equipo.descripcion,
          categoria:   equipo.categoria?.nombre ?? null,
          esPesada,
          estado:      'disponible' as const,
        };
      }

      const esVencida = renta.fechaFinEstimada
        ? renta.fechaFinEstimada < hoyGT
        : false;

      return {
        equipoId:    equipo.id,
        numeracion:  equipo.numeracion,
        descripcion: equipo.descripcion,
        categoria:   equipo.categoria?.nombre ?? null,
        esPesada,
        estado:      esVencida ? 'vencida' as const : 'en-renta' as const,
        renta,
      };
    });

    const orden = { 'vencida': 0, 'en-renta': 1, 'disponible': 2 } as const;
    items.sort((a, b) => orden[a.estado] - orden[b.estado] || a.numeracion.localeCompare(b.numeracion));

    return items;
  }
}
