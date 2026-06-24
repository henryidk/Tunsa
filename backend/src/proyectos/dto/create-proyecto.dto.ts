import { IsString, IsNotEmpty, IsOptional, MaxLength, IsDateString } from 'class-validator';

export class CreateProyectoDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(120)
  nombre: string;

  @IsString()
  @IsOptional()
  @MaxLength(500)
  descripcion?: string;

  @IsString()
  @IsNotEmpty()
  clienteId: string;

  @IsDateString()
  fechaInicio: string;

  @IsDateString()
  @IsOptional()
  fechaFin?: string;
}
