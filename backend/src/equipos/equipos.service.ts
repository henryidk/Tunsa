import { Injectable, ConflictException, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateEquipoDto } from './dto/create-equipo.dto';
import { UpdateEquipoDto } from './dto/update-equipo.dto';
import { BajaEquipoDto } from './dto/baja-equipo.dto';

@Injectable()
export class EquiposService {
  constructor(private prisma: PrismaService) {}

  /** Serializa los campos Decimal a number para que el frontend reciba tipos limpios */
  private serialize(equipo: any) {
    return {
      ...equipo,
      montoCompra: equipo.montoCompra != null ? parseFloat(equipo.montoCompra.toString()) : null,
      rentaDia:    equipo.rentaDia    != null ? parseFloat(equipo.rentaDia.toString())    : null,
      rentaSemana: equipo.rentaSemana != null ? parseFloat(equipo.rentaSemana.toString()) : null,
      rentaMes:    equipo.rentaMes    != null ? parseFloat(equipo.rentaMes.toString())    : null,
    };
  }

  async findAll() {
    const equipos = await this.prisma.equipo.findMany({
      orderBy: [
        { isActive: 'desc' },
        { createdAt: 'asc' },
      ],
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

  async update(id: string, dto: UpdateEquipoDto) {
    const equipo = await this.prisma.equipo.findUnique({ where: { id } });
    if (!equipo) throw new NotFoundException('Equipo no encontrado');

    if (dto.numeracion && dto.numeracion !== equipo.numeracion) {
      const taken = await this.prisma.equipo.findUnique({ where: { numeracion: dto.numeracion } });
      if (taken) throw new ConflictException(`Ya existe un equipo con la numeración "${dto.numeracion}"`);
    }

    const updated = await this.prisma.equipo.update({
      where: { id },
      data: {
        ...(dto.numeracion  !== undefined && { numeracion:  dto.numeracion }),
        ...(dto.descripcion !== undefined && { descripcion: dto.descripcion }),
        ...(dto.categoria   !== undefined && { categoria:   dto.categoria }),
        ...(dto.serie       !== undefined && { serie:       dto.serie       || null }),
        ...(dto.fechaCompra !== undefined && { fechaCompra: new Date(dto.fechaCompra) }),
        ...(dto.montoCompra !== undefined && { montoCompra: dto.montoCompra }),
        ...(dto.tipo        !== undefined && { tipo:        dto.tipo }),
        ...(dto.rentaDia    !== undefined && { rentaDia:    dto.rentaDia    ?? null }),
        ...(dto.rentaSemana !== undefined && { rentaSemana: dto.rentaSemana ?? null }),
        ...(dto.rentaMes    !== undefined && { rentaMes:    dto.rentaMes    ?? null }),
      },
    });

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
