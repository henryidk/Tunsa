import { IsString, IsOptional, IsBoolean, Matches } from 'class-validator';

export class UpdateClienteDto {
  @IsOptional()
  @IsString()
  nombre?: string;

  @IsOptional()
  @IsString()
  @Matches(/^\d{13}$/, { message: 'El DPI debe tener exactamente 13 dígitos numéricos' })
  dpi?: string;

  @IsOptional()
  @IsString()
  @Matches(/^\d{8}$/, { message: 'El teléfono debe tener exactamente 8 dígitos numéricos' })
  telefono?: string;

  @IsOptional()
  @IsBoolean()
  esEspecial?: boolean;
}
