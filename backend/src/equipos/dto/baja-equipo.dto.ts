import { IsOptional, IsString, MinLength, MaxLength } from 'class-validator';

export class BajaEquipoDto {
  @IsOptional()
  @IsString()
  @MinLength(3, { message: 'El motivo debe tener al menos 3 caracteres' })
  @MaxLength(300, { message: 'El motivo no puede exceder 300 caracteres' })
  motivo?: string;
}
