import { Controller, Get, Post, Patch, Param, Body, Query, UseGuards } from '@nestjs/common';
import { GranelService } from './granel.service';
import { CreateLoteDto } from './dto/create-lote.dto';
import { UpdateLoteDto } from './dto/update-lote.dto';
import { UpdateConfigGranelDto } from './dto/update-config.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { MustChangePasswordGuard } from '../auth/guards/must-change-password.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import type { AuthenticatedUser } from '../auth/interfaces/jwt-payload.interface';
import { TipoGranel } from '@prisma/client';

@Controller('granel')
@UseGuards(JwtAuthGuard, RolesGuard, MustChangePasswordGuard)
@Roles('admin', 'secretaria', 'encargado_maquinas')
export class GranelController {
  constructor(private readonly granelService: GranelService) {}

  @Get()
  getAll(@Query('tipo') tipo: TipoGranel) {
    return this.granelService.getAll(tipo);
  }

  @Post()
  @Roles('admin')
  create(
    @Body() dto: CreateLoteDto,
    @CurrentUser() currentUser: AuthenticatedUser,
  ) {
    return this.granelService.create(dto, currentUser.username);
  }

  // Declarado antes de :id para que NestJS no lo trate como parámetro
  @Patch('config')
  @Roles('admin')
  updateConfig(
    @Body() dto: UpdateConfigGranelDto,
    @CurrentUser() currentUser: AuthenticatedUser,
  ) {
    return this.granelService.updateConfig(dto, currentUser.username);
  }

  @Patch(':id')
  @Roles('admin')
  update(
    @Param('id') id: string,
    @Body() dto: UpdateLoteDto,
    @CurrentUser() currentUser: AuthenticatedUser,
  ) {
    return this.granelService.update(id, dto, currentUser.username);
  }

  @Patch(':id/baja')
  @Roles('admin')
  darDeBaja(
    @Param('id') id: string,
    @CurrentUser() currentUser: AuthenticatedUser,
  ) {
    return this.granelService.darDeBaja(id, currentUser.username);
  }
}
