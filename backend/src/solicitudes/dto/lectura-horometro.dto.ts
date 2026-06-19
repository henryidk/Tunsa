import {
  IsArray, IsDateString, IsIn, IsNumber, IsOptional, IsString, Min, ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';

/** Punto de corte para dividir en tramos la noche entre el cierre de ayer y el inicio de hoy. */
export class CorteNocturnoDto {
  /** Horómetro donde ocurre el cambio de complemento durante la noche. */
  @IsNumber()
  @Min(0)
  @Type(() => Number)
  horometroCorte: number;

  /** Complemento que queda activo a partir de este corte; null/omitido = sin complemento. */
  @IsOptional()
  @IsString()
  extraId?: string | null;
}

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

  /**
   * Complemento del primer tramo de la noche anterior (solo válido con tipo 'inicio', y solo si
   * esa noche tuvo horas nocturnas). Omitido = heredar el complemento con el que cerró ese día.
   */
  @IsOptional()
  @IsString()
  complementoNocturnoInicialId?: string | null;

  /**
   * Puntos de corte para dividir en más de un tramo la noche anterior (solo válido con tipo
   * 'inicio', y solo si esa noche tuvo horas nocturnas). Omitido = un solo tramo nocturno.
   */
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => CorteNocturnoDto)
  tramosNocturnos?: CorteNocturnoDto[];
}
