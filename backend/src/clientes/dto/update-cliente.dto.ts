import { IsString, IsOptional, Length } from 'class-validator';

export class UpdateClienteDto {
  @IsOptional()
  @IsString()
  nombre?: string;

  @IsOptional()
  @IsString()
  @Length(13, 13, { message: 'El DPI debe tener exactamente 13 dígitos' })
  dpi?: string;

  @IsOptional()
  @IsString()
  @Length(8, 8, { message: 'El teléfono debe tener exactamente 8 dígitos' })
  telefono?: string;
}
