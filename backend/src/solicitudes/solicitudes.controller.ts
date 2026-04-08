import { Controller, Get, Post, Body, UseGuards } from '@nestjs/common';
import { SolicitudesService } from './solicitudes.service';
import { SolicitudesGateway } from './solicitudes.gateway';
import { CreateSolicitudDto } from './dto/create-solicitud.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { MustChangePasswordGuard } from '../auth/guards/must-change-password.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import type { AuthenticatedUser } from '../auth/interfaces/jwt-payload.interface';

@Controller('solicitudes')
@UseGuards(JwtAuthGuard, RolesGuard, MustChangePasswordGuard)
export class SolicitudesController {
  constructor(
    private readonly solicitudesService: SolicitudesService,
    private readonly solicitudesGateway: SolicitudesGateway,
  ) {}

  @Post()
  @Roles('encargado_maquinas')
  async create(
    @Body() dto: CreateSolicitudDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    const solicitud = await this.solicitudesService.create(dto, user.username);
    this.solicitudesGateway.emitNuevaSolicitud(solicitud);
    return solicitud;
  }

  @Get()
  @Roles('admin', 'secretaria')
  findAll() {
    return this.solicitudesService.findAll();
  }
}
