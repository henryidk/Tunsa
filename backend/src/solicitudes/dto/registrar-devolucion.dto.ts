import {
  IsArray, IsOptional, IsString, IsNumber, Min, ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';

export class CargoAdicionalDto {
  @IsString()
  descripcion: string;

  @IsNumber()
  @Min(0)
  monto: number;
}

/**
 * DTO para registrar la devolución de una renta activa.
 *
 * Todos los campos son opcionales para mantener compatibilidad con la llamada
 * desde VencidasSection (que no envía body). Cuando se omiten:
 *  - itemRefs vacío → se devuelven todos los ítems pendientes.
 *  - recargosAdicionales vacío → no hay cargos adicionales.
 */
export class RegistrarDevolucionDto {
  /** itemRefs de los ítems a devolver. Vacío o ausente = devolución completa. */
  @IsArray()
  @IsOptional()
  @IsString({ each: true })
  itemRefs?: string[];

  /** Cargos adicionales por condición del equipo (daños, faltantes, etc.). */
  @IsArray()
  @IsOptional()
  @ValidateNested({ each: true })
  @Type(() => CargoAdicionalDto)
  recargosAdicionales?: CargoAdicionalDto[];
}
