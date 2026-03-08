import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class BitacorasService {
  constructor(private prisma: PrismaService) {}

  async findAll() {
    return this.prisma.bitacora.findMany({
      orderBy: { createdAt: 'desc' },
      take: 1000,
    });
  }
}
