import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class CategoriasService {
  constructor(private prisma: PrismaService) {}

  async findAll(): Promise<string[]> {
    const rows = await this.prisma.categoria.findMany({
      orderBy: { nombre: 'asc' },
      select: { nombre: true },
    });
    return rows.map(r => r.nombre);
  }
}
