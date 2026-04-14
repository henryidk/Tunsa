import { IsString, IsNotEmpty } from 'class-validator';

export class ConfirmarEntregaDto {
  @IsString()
  @IsNotEmpty()
  firmaCliente: string; // PNG en base64
}
