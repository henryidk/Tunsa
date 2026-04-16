import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { PrismaService } from '../prisma/prisma.service';
import { SolicitudesGateway } from './solicitudes.gateway';
import { SolicitudesService } from './solicitudes.service';

/**
 * Detecta rentas que acaban de vencer (en el último minuto) y notifica
 * al encargado responsable vía WebSocket para que su UI se actualice
 * en tiempo real sin polling.
 */
@Injectable()
export class RentaVencimientoScheduler {
  private readonly logger = new Logger(RentaVencimientoScheduler.name);

  constructor(
    private readonly prisma:    PrismaService,
    private readonly gateway:   SolicitudesGateway,
    private readonly solicitudesService: SolicitudesService,
  ) {}

  @Cron(CronExpression.EVERY_MINUTE)
  async detectarVencimientos(): Promise<void> {
    const ahora     = new Date();
    const haceUnMin = new Date(ahora.getTime() - 60_000);

    const recienVencidas = await this.prisma.solicitud.findMany({
      where: {
        estado:           'ACTIVA',
        fechaFinEstimada: { gte: haceUnMin, lt: ahora },
      },
      include: { cliente: true },
    });

    if (recienVencidas.length === 0) return;

    this.logger.log(`[Scheduler] ${recienVencidas.length} renta(s) recién vencida(s) — notificando encargados`);

    for (const solicitud of recienVencidas) {
      const serializada = this.solicitudesService.serialize(solicitud);
      this.gateway.emitRentaVencida(serializada, solicitud.creadaPor);
    }
  }
}
