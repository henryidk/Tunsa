import { IsString, IsNotEmpty, IsInt, IsNumber, IsOptional, IsDateString, MaxLength, Min } from 'class-validator';
import { Type } from 'class-transformer';

export class CreatePuntalDto {
  @IsString()
  @IsNotEmpty({ message: 'La descripción es requerida' })
  @MaxLength(300)
  descripcion: string;

  @IsInt({ message: 'La cantidad debe ser un número entero' })
  @Min(1, { message: 'La cantidad debe ser al menos 1' })
  @Type(() => Number)
  cantidad: number;

  @IsNumber({}, { message: 'El precio unitario debe ser un número' })
  @Min(0, { message: 'El precio unitario no puede ser negativo' })
  @Type(() => Number)
  precioUnitario: number;

  @IsOptional()
  @IsDateString({}, { message: 'La fecha de compra debe ser una fecha válida' })
  fechaCompra?: string;

  @IsOptional()
  @IsString()
  @MaxLength(200)
  ubicacion?: string;
}
