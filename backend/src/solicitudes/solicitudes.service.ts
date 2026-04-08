import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { CreateSolicitudDto } from './dto/create-solicitud.dto';

type SolicitudConCliente = Prisma.SolicitudGetPayload<{ include: { cliente: true } }>;

@Injectable()
export class SolicitudesService {
  constructor(private readonly prisma: PrismaService) {}

  async create(dto: CreateSolicitudDto, username: string) {
    const solicitud = await this.prisma.solicitud.create({
      data: {
        clienteId:     dto.clienteId,
        items:         dto.items as object[],
        modalidad:     dto.modalidad,
        notas:         dto.notas,
        totalEstimado: dto.totalEstimado,
        creadaPor:     username,
      },
      include: { cliente: true },
    });
    return this.serialize(solicitud);
  }

  async findAll() {
    const solicitudes = await this.prisma.solicitud.findMany({
      include: { cliente: true },
      orderBy: { createdAt: 'desc' },
    });
    return solicitudes.map(s => this.serialize(s));
  }

  private serialize(s: SolicitudConCliente) {
    return {
      ...s,
      totalEstimado: parseFloat(s.totalEstimado.toString()),
    };
  }
}
