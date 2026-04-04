import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreatePuntalDto } from './dto/create-puntal.dto';
import { UpdatePuntalDto } from './dto/update-puntal.dto';
import { UpdatePuntalesConfigDto } from './dto/update-config.dto';

@Injectable()
export class PuntalesService {
  constructor(private readonly prisma: PrismaService) {}

  private serialize(p: any) {
    return {
      ...p,
      precioUnitario: p.precioUnitario != null ? parseFloat(p.precioUnitario.toString()) : null,
    };
  }

  private serializeConfig(c: any) {
    return {
      ...c,
      rentaDia:    parseFloat(c.rentaDia.toString()),
      rentaSemana: parseFloat(c.rentaSemana.toString()),
      rentaMes:    parseFloat(c.rentaMes.toString()),
    };
  }

  async getAll() {
    const [lotes, aggregate, config] = await Promise.all([
      this.prisma.puntal.findMany({
        where:   { isActive: true },
        orderBy: { createdAt: 'asc' },
      }),
      this.prisma.puntal.aggregate({
        where: { isActive: true },
        _sum:  { cantidad: true },
      }),
      this.prisma.puntalesConfig.findUnique({ where: { id: 1 } }),
    ]);

    return {
      lotes:      lotes.map(p => this.serialize(p)),
      stockTotal: aggregate._sum.cantidad ?? 0,
      config:     config ? this.serializeConfig(config) : null,
    };
  }

  async create(dto: CreatePuntalDto, requestingUsername: string) {
    const puntal = await this.prisma.puntal.create({
      data: {
        descripcion:    dto.descripcion,
        cantidad:       dto.cantidad,
        precioUnitario: dto.precioUnitario,
        fechaCompra:    dto.fechaCompra ? new Date(dto.fechaCompra) : null,
        ubicacion:      dto.ubicacion ?? null,
      },
    });

    await this.prisma.bitacora.create({
      data: {
        modulo:        'puntal',
        entidadId:     puntal.id,
        entidadNombre: puntal.descripcion,
        campo:         'crear',
        valorAnterior: null,
        valorNuevo:    `${puntal.cantidad} unidades`,
        realizadoPor:  requestingUsername,
      },
    });

    return this.serialize(puntal);
  }

  async update(id: string, dto: UpdatePuntalDto, requestingUsername: string) {
    const anterior = await this.prisma.puntal.findUnique({ where: { id } });
    if (!anterior) throw new NotFoundException('Lote de puntales no encontrado');

    const actualizado = await this.prisma.puntal.update({
      where: { id },
      data: {
        ...(dto.descripcion    !== undefined && { descripcion:    dto.descripcion }),
        ...(dto.cantidad       !== undefined && { cantidad:       dto.cantidad }),
        ...(dto.precioUnitario !== undefined && { precioUnitario: dto.precioUnitario }),
        ...(dto.fechaCompra    !== undefined && { fechaCompra:    new Date(dto.fechaCompra) }),
        ...(dto.ubicacion      !== undefined && { ubicacion:      dto.ubicacion || null }),
      },
    });

    const fmt = (v: any) => (v != null ? String(v) : null);
    const changes: { campo: string; va: string | null; vn: string | null }[] = [];

    if (dto.descripcion    !== undefined && dto.descripcion    !== anterior.descripcion)
      changes.push({ campo: 'descripcion',    va: fmt(anterior.descripcion),                  vn: fmt(dto.descripcion) });
    if (dto.cantidad       !== undefined && dto.cantidad       !== anterior.cantidad)
      changes.push({ campo: 'cantidad',       va: fmt(anterior.cantidad),                     vn: fmt(dto.cantidad) });
    if (dto.precioUnitario !== undefined && parseFloat(dto.precioUnitario.toString()) !== parseFloat(anterior.precioUnitario.toString()))
      changes.push({ campo: 'precioUnitario', va: fmt(parseFloat(anterior.precioUnitario.toString())), vn: fmt(dto.precioUnitario) });
    if (dto.ubicacion !== undefined && (dto.ubicacion || null) !== anterior.ubicacion)
      changes.push({ campo: 'ubicacion',      va: anterior.ubicacion,                         vn: dto.ubicacion || null });

    if (changes.length > 0) {
      await this.prisma.bitacora.createMany({
        data: changes.map(c => ({
          modulo:        'puntal',
          entidadId:     id,
          entidadNombre: actualizado.descripcion,
          campo:         c.campo,
          valorAnterior: c.va,
          valorNuevo:    c.vn,
          realizadoPor:  requestingUsername,
        })),
      });
    }

    return this.serialize(actualizado);
  }

  async darDeBaja(id: string, requestingUsername: string) {
    const puntal = await this.prisma.puntal.findUnique({ where: { id } });
    if (!puntal) throw new NotFoundException('Lote de puntales no encontrado');

    const actualizado = await this.prisma.puntal.update({
      where: { id },
      data:  { isActive: false },
    });

    await this.prisma.bitacora.create({
      data: {
        modulo:        'puntal',
        entidadId:     id,
        entidadNombre: puntal.descripcion,
        campo:         'baja',
        valorAnterior: `${puntal.cantidad} unidades activas`,
        valorNuevo:    null,
        realizadoPor:  requestingUsername,
      },
    });

    return this.serialize(actualizado);
  }

  async updateConfig(dto: UpdatePuntalesConfigDto, requestingUsername: string) {
    const config = await this.prisma.puntalesConfig.upsert({
      where:  { id: 1 },
      update: { rentaDia: dto.rentaDia, rentaSemana: dto.rentaSemana, rentaMes: dto.rentaMes },
      create: { id: 1, rentaDia: dto.rentaDia, rentaSemana: dto.rentaSemana, rentaMes: dto.rentaMes },
    });

    await this.prisma.bitacora.create({
      data: {
        modulo:        'puntal',
        entidadId:     'config',
        entidadNombre: 'Configuración de precios',
        campo:         'precios_renta',
        valorAnterior: null,
        valorNuevo:    `Q${dto.rentaDia}/día · Q${dto.rentaSemana}/semana · Q${dto.rentaMes}/mes`,
        realizadoPor:  requestingUsername,
      },
    });

    return this.serializeConfig(config);
  }
}
