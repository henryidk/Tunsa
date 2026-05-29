import { Module } from '@nestjs/common';
import { GranelController } from './granel.controller';
import { GranelService } from './granel.service';
import { PrismaModule } from '../prisma/prisma.module';

@Module({
  imports:     [PrismaModule],
  controllers: [GranelController],
  providers:   [GranelService],
  exports:     [GranelService],
})
export class GranelModule {}
