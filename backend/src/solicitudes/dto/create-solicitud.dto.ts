import {
  IsArray, IsBoolean, IsDateString, IsEnum, IsIn, IsNotEmpty, IsNumber,
  IsOptional, IsString, Min, ValidateIf, ValidateNested, ArrayMinSize,
} from 'class-validator';
import { Type } from 'class-transformer';
import { ModalidadPago } from '@prisma/client';

export class ItemSolicitudDto {
  @IsIn(['maquinaria', 'granel', 'pesada'])
  kind: 'maquinaria' | 'granel' | 'pesada';

  // Maquinaria / Pesada
  @ValidateIf(o => o.kind === 'maquinaria' || o.kind === 'pesada')
  @IsString()
  @IsNotEmpty()
  equipoId?: string;
  @IsOptional() @IsString() numeracion?: string;
  @IsOptional() @IsString() descripcion?: string;

  // Pesada: extras seleccionados y días solicitados
  @IsOptional() @IsArray() extras?: { tipoExtraId: string; nombre: string; rentaHora: number }[];
  @IsOptional() @IsNumber() @Min(1) diasSolicitados?: number;

  // Granel
  @ValidateIf(o => o.kind === 'granel')
  @IsString()
  @IsNotEmpty()
  tipo?: string;
  @IsOptional() @IsString() tipoLabel?: string;
  @IsOptional() @IsNumber() @Min(1) cantidad?: number;
  @IsOptional() @IsBoolean() conMadera?: boolean;

  // Común
  @IsDateString() fechaInicio: string;
  @IsOptional() @IsNumber() @Min(1) duracion?: number;
  @IsOptional() @IsIn(['dias', 'semanas', 'meses']) unidad?: string;
  @IsOptional() @IsNumber() tarifa?: number | null;
  @IsNumber() @Min(0) subtotal: number;
}

export class CreateSolicitudDto {
  @IsString()
  clienteId: string;

  @IsEnum(ModalidadPago)
  modalidad: ModalidadPago;

  @IsString()
  @IsNotEmpty()
  notas: string;

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
