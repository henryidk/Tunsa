import {
  IsArray, IsBoolean, IsEnum, IsOptional, IsString,
  IsNumber, Min, ValidateNested, ArrayMinSize,
} from 'class-validator';
import { Type } from 'class-transformer';
import { ModalidadPago } from '@prisma/client';
import { ItemSolicitudDto } from './create-solicitud.dto';

/**
 * DTO para rentas creadas directamente por admin o secretaria.
 * Idéntico a CreateSolicitudDto salvo que `notas` es opcional:
 * en el flujo directo no hay nota interna de encargado.
 */
export class CreateSolicitudDirectaDto {
  @IsString()
  clienteId: string;

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

  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => ItemSolicitudDto)
  items: ItemSolicitudDto[];
}
