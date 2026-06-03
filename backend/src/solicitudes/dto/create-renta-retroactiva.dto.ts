import {
  IsArray, IsBoolean, IsDateString, IsEnum, IsOptional, IsString,
  IsNumber, Min, ValidateNested, ArrayMinSize,
} from 'class-validator';
import { Type } from 'class-transformer';
import { ModalidadPago } from '@prisma/client';
import { ItemSolicitudDto } from './create-solicitud.dto';

export class CreateRentaRetroactivaDto {
  @IsString()
  clienteId: string;

  @IsDateString()
  fechaInicioRenta: string;

  @IsOptional()
  @IsBoolean()
  esIndefinida?: boolean;

  @IsEnum(ModalidadPago)
  modalidad: ModalidadPago;

  @IsOptional()
  @IsString()
  notas?: string;

  @IsOptional()
  @IsNumber()
  @Min(0)
  @Type(() => Number)
  totalEstimado?: number;

  @IsString()
  gestionadaPor: string;

  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => ItemSolicitudDto)
  items: ItemSolicitudDto[];
}
