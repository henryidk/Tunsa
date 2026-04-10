import { IsString, IsNotEmpty, MaxLength } from 'class-validator';

export class RechazarSolicitudDto {
  @IsString()
  @IsNotEmpty({ message: 'El motivo de rechazo es obligatorio.' })
  @MaxLength(500, { message: 'El motivo no puede superar los 500 caracteres.' })
  motivoRechazo: string;
}
