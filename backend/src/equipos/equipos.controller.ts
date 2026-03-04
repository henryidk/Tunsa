import { Controller, Get, Post, Patch, Param, Body, UseGuards } from '@nestjs/common';
import { EquiposService } from './equipos.service';
import { CreateEquipoDto } from './dto/create-equipo.dto';
import { UpdateEquipoDto } from './dto/update-equipo.dto';
import { BajaEquipoDto } from './dto/baja-equipo.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { MustChangePasswordGuard } from '../auth/guards/must-change-password.guard';
import { Roles } from '../auth/decorators/roles.decorator';

@Controller('equipos')
@UseGuards(JwtAuthGuard, RolesGuard, MustChangePasswordGuard)
export class EquiposController {
  constructor(private readonly equiposService: EquiposService) {}

  /** Cualquier usuario autenticado puede listar equipos */
  @Get()
  findAll() {
    return this.equiposService.findAll();
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.equiposService.findById(id);
  }

  @Post()
  @Roles('admin')
  create(@Body() dto: CreateEquipoDto) {
    return this.equiposService.create(dto);
  }

  @Patch(':id')
  @Roles('admin')
  update(@Param('id') id: string, @Body() dto: UpdateEquipoDto) {
    return this.equiposService.update(id, dto);
  }

  @Patch(':id/baja')
  @Roles('admin')
  darDeBaja(@Param('id') id: string, @Body() dto: BajaEquipoDto) {
    return this.equiposService.darDeBaja(id, dto);
  }

  @Patch(':id/reactivar')
  @Roles('admin')
  reactivar(@Param('id') id: string) {
    return this.equiposService.reactivar(id);
  }
}
