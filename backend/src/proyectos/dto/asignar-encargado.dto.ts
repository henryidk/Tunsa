import { IsString, IsNotEmpty } from 'class-validator';

export class AsignarEncargadoDto {
  @IsString()
  @IsNotEmpty()
  usuarioId: string;
}
