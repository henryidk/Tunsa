import { IsDateString, IsNumber, IsOptional, IsString, Min } from 'class-validator';
import { Type } from 'class-transformer';

export class RegistrarTramoDto {
  @IsString()
  equipoId: string;

  /** Fecha del día al que pertenece el tramo, en formato ISO "YYYY-MM-DD". */
  @IsDateString()
  fecha: string;

  /** Horómetro en el punto donde se engancha o quita el complemento. */
  @IsNumber()
  @Min(0)
  @Type(() => Number)
  horometro: number;

  /** Complemento que queda activo a partir de este punto; null/omitido = sin complemento. */
  @IsOptional()
  @IsString()
  extraId?: string | null;
}

export class DeshacerTramoDto {
  @IsString()
  equipoId: string;

  /** Fecha del día al que pertenece el tramo a deshacer, en formato ISO "YYYY-MM-DD". */
  @IsDateString()
  fecha: string;
}
