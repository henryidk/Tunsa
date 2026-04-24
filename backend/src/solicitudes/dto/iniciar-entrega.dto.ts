import { Type } from 'class-transformer';
import { IsArray, IsNumber, IsOptional, IsString, ValidateNested } from 'class-validator';

class HorometroInicialItem {
  @IsString()
  equipoId: string;

  @IsNumber()
  valor: number;
}

export class IniciarEntregaDto {
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => HorometroInicialItem)
  horometrosIniciales?: HorometroInicialItem[];
}
