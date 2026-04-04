import { Controller, Get, Post, Patch, Param, Body, UseGuards } from '@nestjs/common';
import { PuntalesService } from './puntales.service';
import { CreatePuntalDto } from './dto/create-puntal.dto';
import { UpdatePuntalDto } from './dto/update-puntal.dto';
import { UpdatePuntalesConfigDto } from './dto/update-config.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { MustChangePasswordGuard } from '../auth/guards/must-change-password.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import type { AuthenticatedUser } from '../auth/interfaces/jwt-payload.interface';

@Controller('puntales')
@UseGuards(JwtAuthGuard, RolesGuard, MustChangePasswordGuard)
@Roles('admin', 'secretaria', 'encargado_maquinas')
export class PuntalesController {
  constructor(private readonly puntalesService: PuntalesService) {}

  @Get()
  getAll() {
    return this.puntalesService.getAll();
  }

  @Post()
  @Roles('admin')
  create(
    @Body() dto: CreatePuntalDto,
    @CurrentUser() currentUser: AuthenticatedUser,
  ) {
    return this.puntalesService.create(dto, currentUser.username);
  }

  // Declarado antes de :id para que NestJS no lo trate como parámetro
  @Patch('config')
  @Roles('admin')
  updateConfig(
    @Body() dto: UpdatePuntalesConfigDto,
    @CurrentUser() currentUser: AuthenticatedUser,
  ) {
    return this.puntalesService.updateConfig(dto, currentUser.username);
  }

  @Patch(':id')
  @Roles('admin')
  update(
    @Param('id') id: string,
    @Body() dto: UpdatePuntalDto,
    @CurrentUser() currentUser: AuthenticatedUser,
  ) {
    return this.puntalesService.update(id, dto, currentUser.username);
  }

  @Patch(':id/baja')
  @Roles('admin')
  darDeBaja(
    @Param('id') id: string,
    @CurrentUser() currentUser: AuthenticatedUser,
  ) {
    return this.puntalesService.darDeBaja(id, currentUser.username);
  }
}
