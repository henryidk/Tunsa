import { Controller, Get, Post, Patch, Body, Param, Query, UseGuards } from '@nestjs/common';
import { SolicitudesService } from './solicitudes.service';
import { SolicitudesGateway } from './solicitudes.gateway';
import { CreateSolicitudDto } from './dto/create-solicitud.dto';
import { QueryRechazadasDto } from './dto/query-rechazadas.dto';
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

  /**
   * IDs de equipos que están bloqueados en solicitudes PENDIENTE o APROBADA.
   * El encargado lo usa para ocultar equipos no disponibles en el formulario.
   * Debe declararse antes de @Get('mias') para que NestJS no lo interprete como param.
   */
  @Get('equipos-reservados')
  @Roles('encargado_maquinas', 'admin', 'secretaria')
  getEquiposReservados() {
    return this.solicitudesService.getEquiposReservados();
  }

  @Get('mias')
  @Roles('encargado_maquinas')
  findMias(@CurrentUser() user: AuthenticatedUser) {
    return this.solicitudesService.findMias(user.username);
  }

  @Get('rechazadas')
  @Roles('admin', 'secretaria')
  findRechazadas(@Query() query: QueryRechazadasDto) {
    return this.solicitudesService.findRechazadas({
      fechaDesde: new Date(query.fechaDesde),
      fechaHasta: new Date(query.fechaHasta),
      cursor:     query.cursor,
    });
  }

  @Get('historial-mias')
  @Roles('encargado_maquinas')
  findHistorialMias(@CurrentUser() user: AuthenticatedUser) {
    return this.solicitudesService.findHistorialMias(user.username);
  }

  @Patch(':id/rechazar')
  @Roles('admin', 'secretaria')
  async rechazar(@Param('id') id: string) {
    const solicitud = await this.solicitudesService.rechazar(id);
    this.solicitudesGateway.emitSolicitudRechazada(solicitud, solicitud.creadaPor);
    return solicitud;
  }
}
