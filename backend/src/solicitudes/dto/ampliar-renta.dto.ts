import {
  IsString, IsIn, IsInt, Min, IsArray, ValidateNested, IsBoolean, IsOptional,
} from 'class-validator';
import { Type } from 'class-transformer';

export class ExtensionItemDto {
  /** equipoId para maquinaria; nombre del tipo ('PUNTAL', 'ANDAMIO_SIMPLE'…) para granel. */
  @IsString()
  itemRef: string;

  @IsString()
  @IsIn(['maquinaria', 'granel', 'pesada'])
  kind: string;

  @IsInt()
  @Min(1)
  duracion: number;

  @IsString()
  @IsIn(['horas', 'dias', 'semanas', 'meses'])
  unidad: string;
}

export class AmpliacionRentaDto {
  /** Al menos un ítem debe extenderse. */
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => ExtensionItemDto)
  items: ExtensionItemDto[];

  /** Si true, las extensiones se marcan como gracia (sin costo y no afectan ampliaciones futuras). */
  @IsOptional()
  @IsBoolean()
  esGracia?: boolean;
}
