import { IsString, IsInt, IsNumber, IsOptional, IsDateString, MaxLength, Min } from 'class-validator';
import { Type } from 'class-transformer';

export class UpdateLoteDto {
  @IsOptional()
  @IsString()
  @MaxLength(300)
  descripcion?: string;

  @IsOptional()
  @IsInt()
  @Min(1)
  @Type(() => Number)
  cantidad?: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  @Type(() => Number)
  precioUnitario?: number;

  @IsOptional()
  @IsDateString()
  fechaCompra?: string;

  @IsOptional()
  @IsString()
  @MaxLength(200)
  ubicacion?: string;
}
