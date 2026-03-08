import { IsString, IsNotEmpty, IsOptional, IsNumber, IsEnum, IsDateString, MaxLength, Min } from 'class-validator';
import { Type } from 'class-transformer';
import { TipoMaquinaria } from '@prisma/client';

export class CreateEquipoDto {
  @IsString()
  @IsNotEmpty({ message: 'La numeración es requerida' })
  @MaxLength(20, { message: 'La numeración no puede exceder 20 caracteres' })
  numeracion: string;

  @IsString()
  @IsNotEmpty({ message: 'La descripción es requerida' })
  @MaxLength(500, { message: 'La descripción no puede exceder 500 caracteres' })
  descripcion: string;

  @IsString()
  @IsNotEmpty({ message: 'La categoría es requerida' })
  @MaxLength(100, { message: 'La categoría no puede exceder 100 caracteres' })
  categoria: string;

  @IsOptional()
  @IsString()
  @MaxLength(300, { message: 'La serie no puede exceder 300 caracteres' })
  serie?: string;

  @IsDateString({}, { message: 'La fecha de compra debe ser una fecha válida' })
  fechaCompra: string;

  @IsNumber({}, { message: 'El monto de compra debe ser un número' })
  @Min(0, { message: 'El monto de compra no puede ser negativo' })
  @Type(() => Number)
  montoCompra: number;

  @IsOptional()
  @IsNumber({}, { message: 'La cantidad debe ser un número' })
  @Min(1, { message: 'La cantidad debe ser al menos 1' })
  @Type(() => Number)
  cantidad?: number;

  @IsEnum(TipoMaquinaria, { message: 'Tipo de maquinaria no válido' })
  tipo: TipoMaquinaria;

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
