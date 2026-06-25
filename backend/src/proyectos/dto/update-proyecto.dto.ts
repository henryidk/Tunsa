import { IsString, IsNotEmpty, IsOptional, MaxLength } from 'class-validator';

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
}
