import { Module } from '@nestjs/common';
import { ExtrasController } from './extras.controller';
import { ExtrasService } from './extras.service';
import { PrismaModule } from '../prisma/prisma.module';

@Module({
  imports:     [PrismaModule],
  controllers: [ExtrasController],
  providers:   [ExtrasService],
  exports:     [ExtrasService],
})
export class ExtrasModule {}
