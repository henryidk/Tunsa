import { IsNumber, Min } from 'class-validator';
import { Type } from 'class-transformer';

export class UpdatePuntalesConfigDto {
  @IsNumber()
  @Min(0)
  @Type(() => Number)
  rentaDia: number;

  @IsNumber()
  @Min(0)
  @Type(() => Number)
  rentaSemana: number;

  @IsNumber()
  @Min(0)
  @Type(() => Number)
  rentaMes: number;
}
