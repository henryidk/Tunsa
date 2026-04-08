import {
  IsArray, IsBoolean, IsEnum, IsIn, IsNumber,
  IsOptional, IsString, Min, ValidateNested, ArrayMinSize,
} from 'class-validator';
import { Type } from 'class-transformer';
import { ModalidadPago } from '@prisma/client';

export class ItemSolicitudDto {
  @IsIn(['maquinaria', 'granel'])
  kind: 'maquinaria' | 'granel';

  // Maquinaria
  @IsOptional() @IsString() equipoId?: string;
  @IsOptional() @IsString() numeracion?: string;
  @IsOptional() @IsString() descripcion?: string;

  // Granel
  @IsOptional() @IsString() tipo?: string;
  @IsOptional() @IsString() tipoLabel?: string;
  @IsOptional() @IsNumber() @Min(1) cantidad?: number;
  @IsOptional() @IsBoolean() conMadera?: boolean;

  // Común
  @IsString() fechaInicio: string;
  @IsNumber() @Min(1) duracion: number;
  @IsIn(['dias', 'semanas', 'meses']) unidad: string;
  @IsOptional() @IsNumber() tarifa?: number | null;
  @IsNumber() @Min(0) subtotal: number;
}

export class CreateSolicitudDto {
  @IsString()
  clienteId: string;

  @IsEnum(ModalidadPago)
  modalidad: ModalidadPago;

  @IsString()
  notas: string;

  @IsNumber()
  @Min(0)
  @Type(() => Number)
  totalEstimado: number;

  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => ItemSolicitudDto)
  items: ItemSolicitudDto[];
}
