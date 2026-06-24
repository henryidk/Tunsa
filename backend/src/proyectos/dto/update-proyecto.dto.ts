import { IsString, IsNotEmpty, IsOptional, MaxLength, IsDateString } from 'class-validator';

export class UpdateProyectoDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(120)
  @IsOptional()
  nombre?: string;

  @IsString()
  @MaxLength(500)
  @IsOptional()
  descripcion?: string;

  @IsDateString()
  @IsOptional()
  fechaInicio?: string;

  @IsDateString()
  @IsOptional()
  fechaFin?: string;
}
