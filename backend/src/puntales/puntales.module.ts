import { Module } from '@nestjs/common';
import { PuntalesController } from './puntales.controller';
import { PuntalesService } from './puntales.service';
import { PrismaModule } from '../prisma/prisma.module';

@Module({
  imports: [PrismaModule],
  controllers: [PuntalesController],
  providers: [PuntalesService],
  exports: [PuntalesService],
})
export class PuntalesModule {}
