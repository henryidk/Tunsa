import {
  Controller, Get, Post, Patch, Delete,
  Query, Param, Body, HttpCode, HttpStatus, UseGuards,
} from '@nestjs/common';
import { CategoriasService } from './categorias.service';
import { CreateCategoriaDto } from './dto/create-categoria.dto';
import { UpdateCategoriaDto } from './dto/update-categoria.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { MustChangePasswordGuard } from '../auth/guards/must-change-password.guard';

@Controller('categorias')
@UseGuards(JwtAuthGuard, MustChangePasswordGuard)
export class CategoriasController {
  constructor(private readonly categoriasService: CategoriasService) {}

  /** GET /categorias/tipos — para formularios de equipo (sin conteo) */
  @Get('tipos')
  findTipos() {
    return this.categoriasService.findTipos();
  }

  /** GET /categorias/admin — para panel de administración (con conteo de equipos) */
  @Get('admin')
  findTiposAdmin() {
    return this.categoriasService.findTiposAdmin();
  }

  /** GET /categorias | GET /categorias?tipoId=xxx */
  @Get()
  findAll(@Query('tipoId') tipoId?: string) {
    if (tipoId) return this.categoriasService.findByTipo(tipoId);
    return this.categoriasService.findAll();
  }

  /** POST /categorias */
  @Post()
  create(@Body() dto: CreateCategoriaDto) {
    return this.categoriasService.create(dto);
  }

  /** PATCH /categorias/:id */
  @Patch(':id')
  update(@Param('id') id: string, @Body() dto: UpdateCategoriaDto) {
    return this.categoriasService.update(id, dto);
  }

  /** DELETE /categorias/:id */
  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  remove(@Param('id') id: string) {
    return this.categoriasService.remove(id);
  }
}
