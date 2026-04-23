import { IsString, IsNotEmpty, IsOptional, IsNumber, IsDateString, MaxLength, Min } from 'class-validator';
import { Type } from 'class-transformer';

export class CreateEquipoDto {
  @IsString()
  @IsNotEmpty({ message: 'La numeración es requerida' })
  @MaxLength(20, { message: 'La numeración no puede exceder 20 caracteres' })
  numeracion: string;

  @IsString()
  @IsNotEmpty({ message: 'La descripción es requerida' })
  @MaxLength(500, { message: 'La descripción no puede exceder 500 caracteres' })
  descripcion: string;

  /** ID del TipoEquipo al que pertenece este equipo (tipos_equipo.id). */
  @IsString()
  @IsNotEmpty({ message: 'El tipo es requerido' })
  tipoId: string;

  /**
   * ID de la Categoria (opcional).
   * Cuando se provee, el servicio valida que categoria.tipoId === tipoId
   * (también reforzado con FK compuesta en la DB).
   */
  @IsOptional()
  @IsString()
  categoriaId?: string;

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
  @IsNumber()
  @Min(0)
  @Type(() => Number)
  rentaHora?: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  @Type(() => Number)
  rentaHoraMartillo?: number;

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
