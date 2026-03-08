import { Injectable, ConflictException, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateEquipoDto } from './dto/create-equipo.dto';
import { UpdateEquipoDto } from './dto/update-equipo.dto';
import { BajaEquipoDto } from './dto/baja-equipo.dto';

@Injectable()
export class EquiposService {
  constructor(private prisma: PrismaService) {}

  private serialize(equipo: any) {
    return {
      ...equipo,
      montoCompra: equipo.montoCompra != null ? parseFloat(equipo.montoCompra.toString()) : null,
      rentaDia:    equipo.rentaDia    != null ? parseFloat(equipo.rentaDia.toString())    : null,
      rentaSemana: equipo.rentaSemana != null ? parseFloat(equipo.rentaSemana.toString()) : null,
      rentaMes:    equipo.rentaMes    != null ? parseFloat(equipo.rentaMes.toString())    : null,
    };
  }

  private buildChanges(equipo: any, dto: UpdateEquipoDto) {
    const changes: { campo: string; valorAnterior: string | null; valorNuevo: string | null }[] = [];

    const fmtStr = (v: any): string | null => (v != null ? String(v) : null);
    const fmtNum = (v: any): string | null => (v != null ? parseFloat(v.toString()).toString() : null);

    const track = (campo: string, va: string | null, vn: string | null) => {
      if (va !== vn) changes.push({ campo, valorAnterior: va, valorNuevo: vn });
    };

    if (dto.descripcion !== undefined) track('descripcion', fmtStr(equipo.descripcion), fmtStr(dto.descripcion));
    if (dto.categoria   !== undefined) track('categoria',   fmtStr(equipo.categoria),   fmtStr(dto.categoria));
    if (dto.serie       !== undefined) track('serie',       fmtStr(equipo.serie),        fmtStr(dto.serie || null));
    if (dto.cantidad    !== undefined) track('cantidad',    fmtStr(equipo.cantidad),     fmtStr(dto.cantidad));
    if (dto.tipo        !== undefined) track('tipo',        fmtStr(equipo.tipo),         fmtStr(dto.tipo));

    if (dto.fechaCompra !== undefined) {
      const anteriorFecha = equipo.fechaCompra instanceof Date
        ? equipo.fechaCompra.toISOString().substring(0, 10)
        : String(equipo.fechaCompra).substring(0, 10);
      track('fechaCompra', anteriorFecha, dto.fechaCompra);
    }

    if (dto.montoCompra !== undefined) track('montoCompra', fmtNum(equipo.montoCompra), fmtNum(dto.montoCompra));
    if (dto.rentaDia    !== undefined) track('rentaDia',    fmtNum(equipo.rentaDia),    fmtNum(dto.rentaDia    ?? null));
    if (dto.rentaSemana !== undefined) track('rentaSemana', fmtNum(equipo.rentaSemana), fmtNum(dto.rentaSemana ?? null));
    if (dto.rentaMes    !== undefined) track('rentaMes',    fmtNum(equipo.rentaMes),    fmtNum(dto.rentaMes    ?? null));

    return changes;
  }

  async findAll() {
    const equipos = await this.prisma.equipo.findMany({
      orderBy: [{ isActive: 'desc' }, { createdAt: 'asc' }],
    });
    return equipos.map(e => this.serialize(e));
  }

  async findById(id: string) {
    const equipo = await this.prisma.equipo.findUnique({ where: { id } });
    if (!equipo) throw new NotFoundException('Equipo no encontrado');
    return this.serialize(equipo);
  }

  async create(dto: CreateEquipoDto) {
    const taken = await this.prisma.equipo.findUnique({ where: { numeracion: dto.numeracion } });
    if (taken) throw new ConflictException(`Ya existe un equipo con la numeración "${dto.numeracion}"`);

    const equipo = await this.prisma.equipo.create({
      data: {
        numeracion:  dto.numeracion,
        descripcion: dto.descripcion,
        categoria:   dto.categoria,
        serie:       dto.serie || null,
        cantidad:    dto.cantidad ?? 1,
        fechaCompra: new Date(dto.fechaCompra),
        montoCompra: dto.montoCompra,
        tipo:        dto.tipo,
        rentaDia:    dto.rentaDia    ?? null,
        rentaSemana: dto.rentaSemana ?? null,
        rentaMes:    dto.rentaMes    ?? null,
      },
    });

    return this.serialize(equipo);
  }

  async update(id: string, dto: UpdateEquipoDto, usuarioNombre: string) {
    const equipo = await this.prisma.equipo.findUnique({ where: { id } });
    if (!equipo) throw new NotFoundException('Equipo no encontrado');

    if (dto.numeracion && dto.numeracion !== equipo.numeracion) {
      const taken = await this.prisma.equipo.findUnique({ where: { numeracion: dto.numeracion } });
      if (taken) throw new ConflictException(`Ya existe un equipo con la numeración "${dto.numeracion}"`);
    }

    const changes = this.buildChanges(equipo, dto);

    const updated = await this.prisma.equipo.update({
      where: { id },
      data: {
        ...(dto.numeracion  !== undefined && { numeracion:  dto.numeracion }),
        ...(dto.descripcion !== undefined && { descripcion: dto.descripcion }),
        ...(dto.categoria   !== undefined && { categoria:   dto.categoria }),
        ...(dto.serie       !== undefined && { serie:       dto.serie       || null }),
        ...(dto.cantidad    !== undefined && { cantidad:    dto.cantidad }),
        ...(dto.fechaCompra !== undefined && { fechaCompra: new Date(dto.fechaCompra) }),
        ...(dto.montoCompra !== undefined && { montoCompra: dto.montoCompra }),
        ...(dto.tipo        !== undefined && { tipo:        dto.tipo }),
        ...(dto.rentaDia    !== undefined && { rentaDia:    dto.rentaDia    ?? null }),
        ...(dto.rentaSemana !== undefined && { rentaSemana: dto.rentaSemana ?? null }),
        ...(dto.rentaMes    !== undefined && { rentaMes:    dto.rentaMes    ?? null }),
      },
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
      data: {
        isActive:   false,
        motivoBaja: dto.motivo || null,
        fechaBaja:  new Date(),
      },
    });

    return this.serialize(updated);
  }

  async reactivar(id: string) {
    const equipo = await this.prisma.equipo.findUnique({ where: { id } });
    if (!equipo) throw new NotFoundException('Equipo no encontrado');
    if (equipo.isActive) throw new ConflictException('El equipo ya está activo');

    const updated = await this.prisma.equipo.update({
      where: { id },
      data: {
        isActive:   true,
        motivoBaja: null,
        fechaBaja:  null,
      },
    });

    return this.serialize(updated);
  }
}
