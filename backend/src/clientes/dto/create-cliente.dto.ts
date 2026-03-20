import { IsString, IsNotEmpty, IsOptional, Length } from 'class-validator';

export class CreateClienteDto {
  @IsString()
  @IsNotEmpty()
  nombre: string;

  @IsString()
  @IsNotEmpty()
  @Length(13, 13, { message: 'El DPI debe tener exactamente 13 dígitos' })
  dpi: string;

  @IsOptional()
  @IsString()
  telefono?: string;
}
