import {
  Injectable,
  ConflictException,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateEquipoDto } from './dto/create-equipo.dto';
import { UpdateEquipoDto } from './dto/update-equipo.dto';
import { BajaEquipoDto } from './dto/baja-equipo.dto';

// Incluir tipo y categoría en todas las consultas
const EQUIPO_INCLUDE = {
  tipo:      { select: { id: true, nombre: true } },
  categoria: { select: { id: true, nombre: true, tipoId: true } },
} as const;

@Injectable()
export class EquiposService {
  constructor(private prisma: PrismaService) {}

  // ── Helpers ─────────────────────────────────────────────────────────────

  private serialize(equipo: any) {
    return {
      ...equipo,
      montoCompra: equipo.montoCompra != null ? parseFloat(equipo.montoCompra.toString()) : null,
      rentaDia:    equipo.rentaDia    != null ? parseFloat(equipo.rentaDia.toString())    : null,
      rentaSemana: equipo.rentaSemana != null ? parseFloat(equipo.rentaSemana.toString()) : null,
      rentaMes:    equipo.rentaMes    != null ? parseFloat(equipo.rentaMes.toString())    : null,
    };
  }

  /**
   * Valida que el TipoEquipo exista y que, si se provee categoriaId,
   * la categoría pertenezca al mismo tipo.
   * La DB ya lo refuerza con FK compuesta, pero esta validación da un mensaje
   * legible antes de llegar al driver.
   */
  private async validarTipoYCategoria(tipoId: string, categoriaId?: string | null) {
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
  }

  private buildChanges(equipo: any, dto: UpdateEquipoDto, categoriaNuevaNombre?: string | null, tipoNuevoNombre?: string) {
    const changes: { campo: string; valorAnterior: string | null; valorNuevo: string | null }[] = [];

    const fmt    = (v: any): string | null => (v != null ? String(v) : null);
    const fmtNum = (v: any): string | null => (v != null ? parseFloat(v.toString()).toString() : null);
    const track  = (campo: string, va: string | null, vn: string | null) => {
      if (va !== vn) changes.push({ campo, valorAnterior: va, valorNuevo: vn });
    };

    if (dto.descripcion !== undefined) track('descripcion', fmt(equipo.descripcion),  fmt(dto.descripcion));
    if (dto.tipoId      !== undefined) track('tipo',        fmt(equipo.tipo?.nombre), tipoNuevoNombre !== undefined ? tipoNuevoNombre : fmt(dto.tipoId));
    if (dto.categoriaId !== undefined) track('categoria',   fmt(equipo.categoria?.nombre), categoriaNuevaNombre !== undefined ? categoriaNuevaNombre : fmt(dto.categoriaId));
    if (dto.serie       !== undefined) track('serie',       fmt(equipo.serie),             fmt(dto.serie || null));
    if (dto.cantidad    !== undefined) track('cantidad',    fmt(equipo.cantidad),          fmt(dto.cantidad));

    if (dto.fechaCompra !== undefined) {
      const va = equipo.fechaCompra instanceof Date
        ? equipo.fechaCompra.toISOString().substring(0, 10)
        : String(equipo.fechaCompra).substring(0, 10);
      track('fechaCompra', va, dto.fechaCompra);
    }

    if (dto.montoCompra !== undefined) track('montoCompra', fmtNum(equipo.montoCompra), fmtNum(dto.montoCompra));
    if (dto.rentaDia    !== undefined) track('rentaDia',    fmtNum(equipo.rentaDia),    fmtNum(dto.rentaDia    ?? null));
    if (dto.rentaSemana !== undefined) track('rentaSemana', fmtNum(equipo.rentaSemana), fmtNum(dto.rentaSemana ?? null));
    if (dto.rentaMes    !== undefined) track('rentaMes',    fmtNum(equipo.rentaMes),    fmtNum(dto.rentaMes    ?? null));

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
    const equipo = await this.prisma.equipo.findUnique({
      where: { id },
      include: EQUIPO_INCLUDE,
    });
    if (!equipo) throw new NotFoundException('Equipo no encontrado');
    return this.serialize(equipo);
  }

  async create(dto: CreateEquipoDto) {
    const taken = await this.prisma.equipo.findUnique({ where: { numeracion: dto.numeracion } });
    if (taken) throw new ConflictException(`Ya existe un equipo con la numeración "${dto.numeracion}"`);

    await this.validarTipoYCategoria(dto.tipoId, dto.categoriaId);

    const equipo = await this.prisma.equipo.create({
      data: {
        numeracion:  dto.numeracion,
        descripcion: dto.descripcion,
        serie:       dto.serie       || null,
        cantidad:    dto.cantidad    ?? 1,
        fechaCompra: new Date(dto.fechaCompra),
        montoCompra: dto.montoCompra,
        tipoId:      dto.tipoId,
        categoriaId: dto.categoriaId ?? null,
        rentaDia:    dto.rentaDia    ?? null,
        rentaSemana: dto.rentaSemana ?? null,
        rentaMes:    dto.rentaMes    ?? null,
      },
      include: EQUIPO_INCLUDE,
    });

    return this.serialize(equipo);
  }

  async update(id: string, dto: UpdateEquipoDto, usuarioNombre: string) {
    const equipo = await this.prisma.equipo.findUnique({
      where: { id },
      include: EQUIPO_INCLUDE,
    });
    if (!equipo) throw new NotFoundException('Equipo no encontrado');

    if (dto.numeracion && dto.numeracion !== equipo.numeracion) {
      const taken = await this.prisma.equipo.findUnique({ where: { numeracion: dto.numeracion } });
      if (taken) throw new ConflictException(`Ya existe un equipo con la numeración "${dto.numeracion}"`);
    }

    const tipoIdEfectivo = dto.tipoId ?? equipo.tipoId;

    // Si cambia el tipo y el equipo tiene categoría, exigir decisión explícita sobre la categoría
    if (dto.tipoId && dto.tipoId !== equipo.tipoId && equipo.categoriaId && dto.categoriaId === undefined) {
      throw new BadRequestException(
        'Al cambiar el tipo debes indicar explícitamente la nueva categoría ' +
        '(o null para desvincularla), ya que la categoría actual no pertenece al nuevo tipo.',
      );
    }

    const categoriaIdEfectiva = dto.categoriaId !== undefined ? dto.categoriaId : equipo.categoriaId;
    if (dto.tipoId !== undefined || dto.categoriaId !== undefined) {
      await this.validarTipoYCategoria(tipoIdEfectivo, categoriaIdEfectiva);
    }

    // Resolver nombres legibles para la bitácora.
    // El frontend solo envía un campo si realmente cambió, así que
    // si dto.tipoId está presente, es un cambio real — siempre resolvemos el nombre.
    let tipoNuevoNombre: string | undefined = undefined;
    if (dto.tipoId !== undefined) {
      const tipo = await this.prisma.tipoEquipo.findUnique({ where: { id: dto.tipoId } });
      tipoNuevoNombre = tipo?.nombre ?? dto.tipoId;
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

    const changes = this.buildChanges(equipo, dto, categoriaNuevaNombre, tipoNuevoNombre);

    const updated = await this.prisma.equipo.update({
      where: { id },
      data: {
        ...(dto.numeracion  !== undefined && { numeracion:  dto.numeracion }),
        ...(dto.descripcion !== undefined && { descripcion: dto.descripcion }),
        ...(dto.tipoId      !== undefined && { tipoId:      dto.tipoId }),
        ...(dto.categoriaId !== undefined && { categoriaId: dto.categoriaId }),
        ...(dto.serie       !== undefined && { serie:       dto.serie       || null }),
        ...(dto.cantidad    !== undefined && { cantidad:    dto.cantidad }),
        ...(dto.fechaCompra !== undefined && { fechaCompra: new Date(dto.fechaCompra) }),
        ...(dto.montoCompra !== undefined && { montoCompra: dto.montoCompra }),
        ...(dto.rentaDia    !== undefined && { rentaDia:    dto.rentaDia    ?? null }),
        ...(dto.rentaSemana !== undefined && { rentaSemana: dto.rentaSemana ?? null }),
        ...(dto.rentaMes    !== undefined && { rentaMes:    dto.rentaMes    ?? null }),
      },
      include: EQUIPO_INCLUDE,
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
      data: { isActive: false, motivoBaja: dto.motivo || null, fechaBaja: new Date() },
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
}
