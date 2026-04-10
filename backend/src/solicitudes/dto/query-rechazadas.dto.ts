import { IsDateString, IsOptional, IsString } from 'class-validator';

export class QueryRechazadasDto {
  @IsDateString()
  fechaDesde: string;

  @IsDateString()
  fechaHasta: string;

  @IsOptional()
  @IsString()
  cursor?: string;
}
