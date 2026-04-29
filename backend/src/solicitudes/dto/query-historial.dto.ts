import { IsDateString, IsOptional, IsString } from 'class-validator';

export class QueryHistorialDto {
  @IsDateString()
  fechaDesde: string;

  @IsDateString()
  fechaHasta: string;

  @IsOptional()
  @IsString()
  cursor?: string;

  @IsOptional()
  @IsString()
  creadaPor?: string;
}
