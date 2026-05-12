import { IsString, IsNotEmpty, IsOptional, IsBoolean, ValidateIf, Matches } from 'class-validator';

export class CreateClienteDto {
  @IsString()
  @IsNotEmpty()
  nombre: string;

  // Requerido solo para clientes regulares
  @ValidateIf(o => !o.esEspecial)
  @IsString()
  @IsNotEmpty({ message: 'El DPI es requerido para clientes regulares' })
  @Matches(/^\d{13}$/, { message: 'El DPI debe tener exactamente 13 dígitos numéricos' })
  dpi?: string;

  @IsString()
  @IsNotEmpty({ message: 'El teléfono es requerido' })
  @Matches(/^\d{8}$/, { message: 'El teléfono debe tener exactamente 8 dígitos numéricos' })
  telefono: string;

  @IsOptional()
  @IsBoolean()
  esEspecial?: boolean;
}
