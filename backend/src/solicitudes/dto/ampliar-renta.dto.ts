import {
  IsString, IsIn, IsInt, Min, IsArray, ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';

export class ExtensionItemDto {
  /** equipoId para maquinaria; nombre del tipo ('PUNTAL', 'ANDAMIO_SIMPLE'…) para granel. */
  @IsString()
  itemRef: string;

  @IsString()
  @IsIn(['maquinaria', 'granel'])
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
}
