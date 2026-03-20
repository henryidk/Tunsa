import { IsString, IsOptional, IsNumber, IsDateString, MaxLength, Min } from 'class-validator';
import { Type } from 'class-transformer';

export class UpdateEquipoDto {
  @IsOptional()
  @IsString()
  @MaxLength(20)
  numeracion?: string;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  descripcion?: string;

  /** Cambiar tipo implica validar que la nueva categoría (si hay) también pertenezca al nuevo tipo. */
  @IsOptional()
  @IsString()
  tipoId?: string;

  /** null explícito desvincula la categoría; undefined la deja sin cambios. */
  @IsOptional()
  @IsString()
  categoriaId?: string | null;

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
