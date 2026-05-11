import { Type } from 'class-transformer';
import { IsArray, IsNumber, IsOptional, IsString, Min, ValidateNested } from 'class-validator';

class HorometroInicialItem {
  @IsString()
  equipoId: string;

  @IsNumber()
  @Min(0)
  valor: number;
}

export class IniciarEntregaDto {
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => HorometroInicialItem)
  horometrosIniciales?: HorometroInicialItem[];
}
