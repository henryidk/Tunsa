import { IsString, IsNotEmpty, IsOptional, MaxLength } from 'class-validator';

export class CreateTipoExtraDto {
  @IsString()
  @IsNotEmpty({ message: 'El nombre es requerido' })
  @MaxLength(60, { message: 'El nombre no puede exceder 60 caracteres' })
  nombre: string;

  @IsOptional()
  @IsString()
  @MaxLength(200)
  descripcion?: string;
}
