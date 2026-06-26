import { IsString, IsNotEmpty, IsOptional, IsArray, ArrayMinSize, MaxLength } from 'class-validator';

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

  @IsOptional()
  @IsArray()
  @ArrayMinSize(0)
  @IsString({ each: true })
  encargadoIds?: string[];
}
