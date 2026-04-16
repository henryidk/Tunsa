import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { PrismaModule } from '../prisma/prisma.module';
import { SolicitudesService } from './solicitudes.service';
import { SolicitudesGateway } from './solicitudes.gateway';
import { SolicitudesController } from './solicitudes.controller';
import { RentaVencimientoScheduler } from './renta-vencimiento.scheduler';

@Module({
  imports: [
    PrismaModule,
    JwtModule.registerAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        secret: config.get<string>('JWT_SECRET'),
      }),
    }),
  ],
  controllers: [SolicitudesController],
  providers: [SolicitudesService, SolicitudesGateway, RentaVencimientoScheduler],
})
export class SolicitudesModule {}
