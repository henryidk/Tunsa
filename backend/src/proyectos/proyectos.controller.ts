import {
  Controller, Get, Post, Patch, Param, Body,
  Query, UseGuards,
} from '@nestjs/common';
import { ProyectosService } from './proyectos.service';
import { CreateProyectoDto } from './dto/create-proyecto.dto';
import { UpdateProyectoDto } from './dto/update-proyecto.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { MustChangePasswordGuard } from '../auth/guards/must-change-password.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import type { AuthenticatedUser } from '../auth/interfaces/jwt-payload.interface';
import { EstadoProyecto } from '@prisma/client';
import { serializeSolicitud, type SolicitudConCliente } from '../solicitudes/solicitudes.serializer';

@Controller('proyectos')
@UseGuards(JwtAuthGuard, RolesGuard, MustChangePasswordGuard)
@Roles('admin', 'secretaria', 'encargado_maquinas')
export class ProyectosController {
  constructor(private readonly proyectosService: ProyectosService) {}

  @Get()
  findAll(
    @Query('clienteId') clienteId?: string,
    @Query('estado')    estado?:    string,
  ) {
    return this.proyectosService.findAll({
      clienteId: clienteId || undefined,
      estado:    estado as EstadoProyecto | undefined,
    });
  }

  @Get('por-cliente/:clienteId')
  findByCliente(@Param('clienteId') clienteId: string) {
    return this.proyectosService.findByCliente(clienteId);
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.proyectosService.findOne(id);
  }

  @Get(':id/solicitudes')
  async findSolicitudesDeProyecto(@Param('id') id: string) {
    const raw = await this.proyectosService.findSolicitudesDeProyecto(id);
    const s = (arr: SolicitudConCliente[]) => arr.map(x => serializeSolicitud(x));
    return {
      enProceso: s(raw.enProceso as SolicitudConCliente[]),
      activas:   s(raw.activas   as SolicitudConCliente[]),
      vencidas:  s(raw.vencidas  as SolicitudConCliente[]),
      devueltas: s(raw.devueltas as SolicitudConCliente[]),
    };
  }

  @Post()
  create(
    @Body() dto: CreateProyectoDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.proyectosService.create(dto, user.username);
  }

  @Patch(':id')
  update(
    @Param('id') id: string,
    @Body() dto: UpdateProyectoDto,
  ) {
    return this.proyectosService.update(id, dto);
  }

  @Post(':id/finalizar')
  finalizar(@Param('id') id: string) {
    return this.proyectosService.finalizar(id);
  }

  @Post(':id/reactivar')
  reactivar(@Param('id') id: string) {
    return this.proyectosService.reactivar(id);
  }
}
