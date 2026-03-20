import { IsNotEmpty, IsString, MaxLength } from 'class-validator';

export class UpdateCategoriaDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  nombre: string;
}
