import { IsEnum, IsNotEmpty, IsOptional, IsString, MaxLength } from 'class-validator';
import { ModalidadTipo } from '@prisma/client';

export class CreateTipoDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(50)
  nombre: string;

  @IsEnum(ModalidadTipo)
  modalidad: ModalidadTipo;

  @IsOptional()
  @IsString()
  @MaxLength(200)
  descripcion?: string;
}
