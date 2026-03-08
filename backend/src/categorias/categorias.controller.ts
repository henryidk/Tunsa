import { Controller, Get, UseGuards } from '@nestjs/common';
import { CategoriasService } from './categorias.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { MustChangePasswordGuard } from '../auth/guards/must-change-password.guard';

@Controller('categorias')
@UseGuards(JwtAuthGuard, MustChangePasswordGuard)
export class CategoriasController {
  constructor(private readonly categoriasService: CategoriasService) {}

  @Get()
  findAll(): Promise<string[]> {
    return this.categoriasService.findAll();
  }
}
