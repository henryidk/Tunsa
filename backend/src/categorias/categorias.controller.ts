import {
  Controller, Get, Post, Patch, Delete,
  Query, Param, Body, HttpCode, HttpStatus, UseGuards,
} from '@nestjs/common';
import { CategoriasService } from './categorias.service';
import { CreateCategoriaDto } from './dto/create-categoria.dto';
import { UpdateCategoriaDto } from './dto/update-categoria.dto';
import { CreateTipoDto } from './dto/create-tipo.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { MustChangePasswordGuard } from '../auth/guards/must-change-password.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import type { AuthenticatedUser } from '../auth/interfaces/jwt-payload.interface';

@Controller('categorias')
@UseGuards(JwtAuthGuard, RolesGuard, MustChangePasswordGuard)
export class CategoriasController {
  constructor(private readonly categoriasService: CategoriasService) {}

  /** POST /categorias/tipos — crea un nuevo tipo */
  @Post('tipos')
  @Roles('admin', 'secretaria')
  createTipo(@Body() dto: CreateTipoDto, @CurrentUser() user: AuthenticatedUser) {
    return this.categoriasService.createTipo(dto, user.username);
  }

  /** GET /categorias/tipos — para formularios de equipo (sin conteo) */
  @Get('tipos')
  findTipos() {
    return this.categoriasService.findTipos();
  }

  /** PATCH /categorias/tipos/:id — renombra un tipo */
  @Patch('tipos/:id')
  @Roles('admin', 'secretaria')
  updateTipo(
    @Param('id') id: string,
    @Body('nombre') nombre: string,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.categoriasService.updateTipo(id, nombre, user.username);
  }

  /** DELETE /categorias/tipos/:id — elimina un tipo si no tiene equipos */
  @Delete('tipos/:id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @Roles('admin', 'secretaria')
  removeTipo(@Param('id') id: string, @CurrentUser() user: AuthenticatedUser) {
    return this.categoriasService.removeTipo(id, user.username);
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
  @Roles('admin', 'secretaria')
  create(@Body() dto: CreateCategoriaDto, @CurrentUser() user: AuthenticatedUser) {
    return this.categoriasService.create(dto, user.username);
  }

  /** PATCH /categorias/:id */
  @Patch(':id')
  @Roles('admin', 'secretaria')
  update(
    @Param('id') id: string,
    @Body() dto: UpdateCategoriaDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.categoriasService.update(id, dto, user.username);
  }

  /** DELETE /categorias/:id */
  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @Roles('admin', 'secretaria')
  remove(@Param('id') id: string, @CurrentUser() user: AuthenticatedUser) {
    return this.categoriasService.remove(id, user.username);
  }
}
