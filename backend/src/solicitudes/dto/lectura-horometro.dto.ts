import { IsDateString, IsIn, IsNumber, IsOptional, IsString, Min } from 'class-validator';
import { Type } from 'class-transformer';

export class RegistrarLecturaDto {
  @IsString()
  equipoId: string;

  /** Fecha del día al que pertenece la lectura, en formato ISO "YYYY-MM-DD". */
  @IsDateString()
  fecha: string;

  /** 'inicio' = lectura de inicio del día; 'fin5pm' = lectura de las 5 PM. */
  @IsIn(['inicio', 'fin5pm'])
  tipo: 'inicio' | 'fin5pm';

  @IsNumber()
  @Min(0)
  @Type(() => Number)
  valor: number;

  /** Complemento con el que arranca el día (solo válido con tipo 'inicio'); null/omitido = heredar del día anterior o ninguno. */
  @IsOptional()
  @IsString()
  extraId?: string | null;
}
