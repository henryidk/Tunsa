import { Controller, Get, Post, Patch, Param, Body, Query, UseGuards } from '@nestjs/common';
import { EquiposService } from './equipos.service';
import { CreateEquipoDto } from './dto/create-equipo.dto';
import { UpdateEquipoDto } from './dto/update-equipo.dto';
import { BajaEquipoDto } from './dto/baja-equipo.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { MustChangePasswordGuard } from '../auth/guards/must-change-password.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import type { AuthenticatedUser } from '../auth/interfaces/jwt-payload.interface';

@Controller('equipos')
@UseGuards(JwtAuthGuard, RolesGuard, MustChangePasswordGuard)
export class EquiposController {
  constructor(private readonly equiposService: EquiposService) {}

  @Get()
  findAll(
    @Query('page')     page?:     string,
    @Query('pageSize') pageSize?: string,
  ) {
    return this.equiposService.findAll(
      page     ? parseInt(page)     : 1,
      pageSize ? parseInt(pageSize) : 200,
    );
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.equiposService.findById(id);
  }

  @Post()
  @Roles('admin', 'secretaria')
  create(@Body() dto: CreateEquipoDto) {
    return this.equiposService.create(dto);
  }

  @Patch(':id')
  @Roles('admin', 'secretaria')
  update(
    @Param('id') id: string,
    @Body() dto: UpdateEquipoDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.equiposService.update(id, dto, user.username);
  }

  @Patch(':id/baja')
  @Roles('admin', 'secretaria')
  darDeBaja(@Param('id') id: string, @Body() dto: BajaEquipoDto) {
    return this.equiposService.darDeBaja(id, dto);
  }

  @Patch(':id/reactivar')
  @Roles('admin', 'secretaria')
  reactivar(@Param('id') id: string) {
    return this.equiposService.reactivar(id);
  }
}
