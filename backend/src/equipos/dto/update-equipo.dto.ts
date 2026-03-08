import { IsString, IsOptional, IsNumber, IsEnum, IsDateString, MaxLength, Min } from 'class-validator';
import { Type } from 'class-transformer';
import { TipoMaquinaria } from '@prisma/client';

export class UpdateEquipoDto {
  @IsOptional()
  @IsString()
  @MaxLength(20)
  numeracion?: string;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  descripcion?: string;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  categoria?: string;

  @IsOptional()
  @IsString()
  @MaxLength(300)
  serie?: string;

  @IsOptional()
  @IsNumber()
  @Min(1)
  @Type(() => Number)
  cantidad?: number;

  @IsOptional()
  @IsDateString()
  fechaCompra?: string;

  @IsOptional()
  @IsNumber()
  @Min(0)
  @Type(() => Number)
  montoCompra?: number;

  @IsOptional()
  @IsEnum(TipoMaquinaria)
  tipo?: TipoMaquinaria;

  @IsOptional()
  @IsNumber()
  @Min(0)
  @Type(() => Number)
  rentaDia?: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  @Type(() => Number)
  rentaSemana?: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  @Type(() => Number)
  rentaMes?: number;
}
