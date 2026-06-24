import { IsString, IsNotEmpty } from 'class-validator';

export class AsignarProyectoDto {
  @IsString()
  @IsNotEmpty()
  proyectoId: string;
}
