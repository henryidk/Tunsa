import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

const PAGE_SIZE = 50;

export interface BitacoraPageParams {
  cursor?:  string;  // id del último registro recibido
  modulo?:  string;
  search?:  string;
}

export interface BitacoraStatsResult {
  total:       number;
  hoy:         number;
  porModulo:   Record<string, number>;
}

export interface BitacoraPageResult {
  data:       any[];
  nextCursor: string | null;  // null = no hay más páginas
}

@Injectable()
export class BitacorasService {
  constructor(private prisma: PrismaService) {}

  /** GET /bitacoras/stats — conteos globales sin cargar registros */
  async getStats(): Promise<BitacoraStatsResult> {
    const hoyStart = new Date();
    hoyStart.setHours(0, 0, 0, 0);

    const [total, hoy, grupos] = await Promise.all([
      this.prisma.bitacora.count(),
      this.prisma.bitacora.count({ where: { createdAt: { gte: hoyStart } } }),
      this.prisma.bitacora.groupBy({
        by:      ['modulo'],
        _count:  { _all: true },
      }),
    ]);

    const porModulo = grupos.reduce<Record<string, number>>((acc, g) => {
      acc[g.modulo] = g._count._all;
      return acc;
    }, {});

    return { total, hoy, porModulo };
  }

  /** GET /bitacoras — paginación cursor-based */
  async findAll(params: BitacoraPageParams): Promise<BitacoraPageResult> {
    const { cursor, modulo, search } = params;

    const where: any = {};

    if (modulo) {
      where.modulo = modulo;
    }

    if (search) {
      const q = search.trim();
      where.OR = [
        { entidadNombre: { contains: q, mode: 'insensitive' } },
        { campo:         { contains: q, mode: 'insensitive' } },
        { realizadoPor:  { contains: q, mode: 'insensitive' } },
        { valorAnterior: { contains: q, mode: 'insensitive' } },
        { valorNuevo:    { contains: q, mode: 'insensitive' } },
      ];
    }

    // Tomamos PAGE_SIZE + 1 para saber si existe una página siguiente
    const rows = await this.prisma.bitacora.findMany({
      take:    PAGE_SIZE + 1,
      cursor:  cursor ? { id: cursor } : undefined,
      skip:    cursor ? 1 : 0,        // omitir el propio registro cursor
      where,
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }], // coincide con @@index([createdAt, id])
    });

    const hasNextPage = rows.length > PAGE_SIZE;
    const data        = hasNextPage ? rows.slice(0, PAGE_SIZE) : rows;
    const nextCursor  = hasNextPage ? data[data.length - 1].id : null;

    return { data, nextCursor };
  }
}
