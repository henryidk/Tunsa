import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { TipoGranel } from '@prisma/client';
import { CreateLoteDto } from './dto/create-lote.dto';
import { UpdateLoteDto } from './dto/update-lote.dto';
import { UpdateConfigGranelDto } from './dto/update-config.dto';

@Injectable()
export class GranelService {
  constructor(private readonly prisma: PrismaService) {}

  private serializeLote(l: any) {
    return {
      ...l,
      precioUnitario: l.precioUnitario != null ? parseFloat(l.precioUnitario.toString()) : null,
    };
  }

  private serializeConfig(c: any) {
    return {
      ...c,
      rentaDia:             parseFloat(c.rentaDia.toString()),
      rentaSemana:          parseFloat(c.rentaSemana.toString()),
      rentaMes:             parseFloat(c.rentaMes.toString()),
      rentaDiaConMadera:    c.rentaDiaConMadera    != null ? parseFloat(c.rentaDiaConMadera.toString())    : null,
      rentaSemanaConMadera: c.rentaSemanaConMadera != null ? parseFloat(c.rentaSemanaConMadera.toString()) : null,
      rentaMesConMadera:    c.rentaMesConMadera    != null ? parseFloat(c.rentaMesConMadera.toString())    : null,
    };
  }

  async getAll(tipo: TipoGranel) {
    const [lotes, aggregate, config] = await Promise.all([
      this.prisma.loteGranel.findMany({
        where:   { tipo, isActive: true },
        orderBy: { createdAt: 'asc' },
      }),
      this.prisma.loteGranel.aggregate({
        where: { tipo, isActive: true },
        _sum:  { cantidad: true },
      }),
      this.prisma.configGranel.findUnique({ where: { tipo } }),
    ]);

    return {
      lotes:      lotes.map(l => this.serializeLote(l)),
      stockTotal: aggregate._sum.cantidad ?? 0,
      config:     config ? this.serializeConfig(config) : null,
    };
  }

  async create(dto: CreateLoteDto, requestingUsername: string) {
    const lote = await this.prisma.loteGranel.create({
      data: {
        tipo:           dto.tipo,
        descripcion:    dto.descripcion,
        cantidad:       dto.cantidad,
        precioUnitario: dto.precioUnitario,
        fechaCompra:    dto.fechaCompra ? new Date(dto.fechaCompra) : null,
        ubicacion:      dto.ubicacion ?? null,
      },
    });

    await this.prisma.bitacora.create({
      data: {
        modulo:        'granel',
        entidadId:     lote.id,
        entidadNombre: `${lote.tipo} — ${lote.descripcion}`,
        campo:         'crear',
        valorAnterior: null,
        valorNuevo:    `${lote.cantidad} unidades`,
        realizadoPor:  requestingUsername,
      },
    });

    return this.serializeLote(lote);
  }

  async update(id: string, dto: UpdateLoteDto, requestingUsername: string) {
    const anterior = await this.prisma.loteGranel.findUnique({ where: { id } });
    if (!anterior) throw new NotFoundException('Lote no encontrado.');

    const actualizado = await this.prisma.loteGranel.update({
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
      changes.push({ campo: 'descripcion',    va: fmt(anterior.descripcion),    vn: fmt(dto.descripcion) });
    if (dto.cantidad       !== undefined && dto.cantidad       !== anterior.cantidad)
      changes.push({ campo: 'cantidad',       va: fmt(anterior.cantidad),       vn: fmt(dto.cantidad) });
    if (dto.precioUnitario !== undefined && parseFloat(dto.precioUnitario.toString()) !== parseFloat(anterior.precioUnitario.toString()))
      changes.push({ campo: 'precioUnitario', va: fmt(parseFloat(anterior.precioUnitario.toString())), vn: fmt(dto.precioUnitario) });
    if (dto.ubicacion      !== undefined && (dto.ubicacion || null) !== anterior.ubicacion)
      changes.push({ campo: 'ubicacion',      va: anterior.ubicacion, vn: dto.ubicacion || null });

    if (changes.length > 0) {
      await this.prisma.bitacora.createMany({
        data: changes.map(c => ({
          modulo:        'granel',
          entidadId:     id,
          entidadNombre: `${actualizado.tipo} — ${actualizado.descripcion}`,
          campo:         c.campo,
          valorAnterior: c.va,
          valorNuevo:    c.vn,
          realizadoPor:  requestingUsername,
        })),
      });
    }

    return this.serializeLote(actualizado);
  }

  async darDeBaja(id: string, requestingUsername: string) {
    const lote = await this.prisma.loteGranel.findUnique({ where: { id } });
    if (!lote) throw new NotFoundException('Lote no encontrado.');

    const actualizado = await this.prisma.loteGranel.update({
      where: { id },
      data:  { isActive: false },
    });

    await this.prisma.bitacora.create({
      data: {
        modulo:        'granel',
        entidadId:     id,
        entidadNombre: `${lote.tipo} — ${lote.descripcion}`,
        campo:         'baja',
        valorAnterior: `${lote.cantidad} unidades activas`,
        valorNuevo:    null,
        realizadoPor:  requestingUsername,
      },
    });

    return this.serializeLote(actualizado);
  }

  async updateConfig(dto: UpdateConfigGranelDto, requestingUsername: string) {
    const maderaFields = dto.tipo === 'ANDAMIO_SIMPLE'
      ? {
          rentaDiaConMadera:    dto.rentaDiaConMadera    ?? null,
          rentaSemanaConMadera: dto.rentaSemanaConMadera ?? null,
          rentaMesConMadera:    dto.rentaMesConMadera    ?? null,
        }
      : {};

    const config = await this.prisma.configGranel.upsert({
      where:  { tipo: dto.tipo },
      update: { rentaDia: dto.rentaDia, rentaSemana: dto.rentaSemana, rentaMes: dto.rentaMes, ...maderaFields },
      create: { tipo: dto.tipo, rentaDia: dto.rentaDia, rentaSemana: dto.rentaSemana, rentaMes: dto.rentaMes, ...maderaFields },
    });

    await this.prisma.bitacora.create({
      data: {
        modulo:        'granel',
        entidadId:     dto.tipo,
        entidadNombre: `Configuración de precios — ${dto.tipo}`,
        campo:         'precios_renta',
        valorAnterior: null,
        valorNuevo:    `Q${dto.rentaDia}/día · Q${dto.rentaSemana}/semana · Q${dto.rentaMes}/mes`,
        realizadoPor:  requestingUsername,
      },
    });

    return this.serializeConfig(config);
  }
}
