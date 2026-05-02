import { IsString, IsOptional, MaxLength } from 'class-validator';

export class UpdateTipoExtraDto {
  @IsOptional()
  @IsString()
  @MaxLength(60)
  nombre?: string;

  @IsOptional()
  @IsString()
  @MaxLength(200)
  descripcion?: string;
}
