import { IsEnum, IsNumber, Min } from 'class-validator';
import { Type } from 'class-transformer';
import { TipoGranel } from '@prisma/client';

export class UpdateConfigGranelDto {
  @IsEnum(TipoGranel, { message: 'El tipo debe ser PUNTAL, ANDAMIO_SIMPLE o ANDAMIO_RUEDAS' })
  tipo: TipoGranel;

  @IsNumber()
  @Min(0)
  @Type(() => Number)
  rentaDia: number;

  @IsNumber()
  @Min(0)
  @Type(() => Number)
  rentaSemana: number;

  @IsNumber()
  @Min(0)
  @Type(() => Number)
  rentaMes: number;
}
