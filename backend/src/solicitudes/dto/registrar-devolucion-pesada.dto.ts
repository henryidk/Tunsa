import {
  IsArray, IsNumber, IsOptional, IsString, Min,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';
import { CargoAdicionalDto } from './registrar-devolucion.dto';

export class DevolucionPesadaItemDto {
  @IsString()
  equipoId: string;

  @IsNumber()
  @Min(0)
  @Type(() => Number)
  horometroDevolucion: number;
}

export class RegistrarDevolucionPesadaDto {
  /**
   * Items a devolver con su horómetro de devolución.
   * Si se omite o está vacío, se devuelven todos los ítems pendientes.
   */
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => DevolucionPesadaItemDto)
  items?: DevolucionPesadaItemDto[];

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => CargoAdicionalDto)
  recargosAdicionales?: CargoAdicionalDto[];
}
