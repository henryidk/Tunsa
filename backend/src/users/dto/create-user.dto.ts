import { IsString, IsNotEmpty, IsOptional, MinLength, MaxLength, Matches, IsIn } from 'class-validator';

export class CreateUserDto {
  @IsString()
  @IsNotEmpty({ message: 'El nombre es requerido' })
  @MinLength(2, { message: 'El nombre debe tener al menos 2 caracteres' })
  @MaxLength(100, { message: 'El nombre no puede exceder 100 caracteres' })
  nombre: string;

  @IsString()
  @IsNotEmpty({ message: 'El username es requerido' })
  @MinLength(3, { message: 'El username debe tener al menos 3 caracteres' })
  @MaxLength(30, { message: 'El username no puede exceder 30 caracteres' })
  @Matches(/^[a-z0-9._-]+$/, { message: 'El username solo puede contener letras minúsculas, números, puntos, guiones y guiones bajos' })
  username: string;

  @IsOptional()
  @IsString()
  @MaxLength(20, { message: 'El teléfono no puede exceder 20 caracteres' })
  telefono?: string;

  @IsString()
  @IsNotEmpty({ message: 'El rol es requerido' })
  @IsIn(['admin', 'secretaria', 'colaborador', 'encargado_maquinas'], { message: 'Rol no válido' })
  rol: string;
}
