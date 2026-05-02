import {
  Injectable,
  ConflictException,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateTipoExtraDto } from './dto/create-tipo-extra.dto';
import { UpdateTipoExtraDto } from './dto/update-tipo-extra.dto';

@Injectable()
export class ExtrasService {
  constructor(private prisma: PrismaService) {}

  findAll() {
    return this.prisma.tipoExtra.findMany({
      orderBy: { nombre: 'asc' },
    });
  }

  async create(dto: CreateTipoExtraDto) {
    const taken = await this.prisma.tipoExtra.findUnique({ where: { nombre: dto.nombre } });
    if (taken) throw new ConflictException(`Ya existe un extra con el nombre "${dto.nombre}"`);

    return this.prisma.tipoExtra.create({
      data: { nombre: dto.nombre, descripcion: dto.descripcion ?? null },
    });
  }

  async update(id: string, dto: UpdateTipoExtraDto) {
    const extra = await this.prisma.tipoExtra.findUnique({ where: { id } });
    if (!extra) throw new NotFoundException('Extra no encontrado');

    if (dto.nombre && dto.nombre !== extra.nombre) {
      const taken = await this.prisma.tipoExtra.findUnique({ where: { nombre: dto.nombre } });
      if (taken) throw new ConflictException(`Ya existe un extra con el nombre "${dto.nombre}"`);
    }

    return this.prisma.tipoExtra.update({
      where: { id },
      data: {
        ...(dto.nombre       !== undefined && { nombre:       dto.nombre }),
        ...(dto.descripcion  !== undefined && { descripcion:  dto.descripcion ?? null }),
      },
    });
  }

  async remove(id: string) {
    const extra = await this.prisma.tipoExtra.findUnique({
      where:   { id },
      include: { extras: { take: 1 } },
    });
    if (!extra) throw new NotFoundException('Extra no encontrado');
    if (extra.extras.length > 0) {
      throw new BadRequestException(
        'No se puede eliminar este extra porque está asignado a uno o más equipos.',
      );
    }

    await this.prisma.tipoExtra.delete({ where: { id } });
  }
}
