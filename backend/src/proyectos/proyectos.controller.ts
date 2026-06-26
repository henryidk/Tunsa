import {
  Controller, Get, Post, Patch, Delete, Param, Body, Query,
  UseGuards,
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
import { AsignarEncargadoDto } from './dto/asignar-encargado.dto';

@Controller('proyectos')
@UseGuards(JwtAuthGuard, RolesGuard, MustChangePasswordGuard)
@Roles('admin', 'secretaria', 'encargado_maquinas')
export class ProyectosController {
  constructor(private readonly proyectosService: ProyectosService) {}

  @Get()
  findAll(
    @CurrentUser() user: AuthenticatedUser,
    @Query('clienteId') clienteId?: string,
    @Query('estado')    estado?:    string,
  ) {
    return this.proyectosService.findAll(user, {
      clienteId: clienteId || undefined,
      estado:    estado as EstadoProyecto | undefined,
    });
  }

  // Debe declararse antes de ':id' para evitar conflictos de ruta
  @Get('mis-proyectos')
  getMisProyectos(@CurrentUser() user: AuthenticatedUser) {
    return this.proyectosService.getMisProyectos(user);
  }

  @Get('por-cliente/:clienteId')
  @Roles('admin', 'secretaria')
  findByCliente(@Param('clienteId') clienteId: string) {
    return this.proyectosService.findByCliente(clienteId);
  }

  @Get(':id')
  findOne(@Param('id') id: string, @CurrentUser() user: AuthenticatedUser) {
    return this.proyectosService.findOneConAcceso(id, user);
  }

  @Get(':id/solicitudes')
  async findSolicitudesDeProyecto(@Param('id') id: string, @CurrentUser() user: AuthenticatedUser) {
    const raw = await this.proyectosService.findSolicitudesDeProyecto(id, user);
    const s = (arr: SolicitudConCliente[]) => arr.map(x => serializeSolicitud(x));
    return {
      enProceso: s(raw.enProceso as SolicitudConCliente[]),
      activas:   s(raw.activas   as SolicitudConCliente[]),
      vencidas:  s(raw.vencidas  as SolicitudConCliente[]),
      devueltas: s(raw.devueltas as SolicitudConCliente[]),
    };
  }

  @Get(':id/encargados')
  getEncargados(@Param('id') id: string) {
    return this.proyectosService.getEncargados(id);
  }

  @Post()
  create(
    @Body() dto: CreateProyectoDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.proyectosService.create(dto, user.id, user.nombre, user);
  }

  @Patch(':id')
  update(
    @Param('id') id: string,
    @Body() dto: UpdateProyectoDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.proyectosService.update(id, dto, user);
  }

  @Post(':id/finalizar')
  finalizar(@Param('id') id: string, @CurrentUser() user: AuthenticatedUser) {
    return this.proyectosService.finalizar(id, user);
  }

  @Post(':id/reactivar')
  @Roles('admin', 'secretaria')
  reactivar(@Param('id') id: string) {
    return this.proyectosService.reactivar(id);
  }

  @Post(':id/encargados')
  @Roles('admin', 'secretaria')
  agregarEncargado(
    @Param('id') proyectoId: string,
    @Body() dto: AsignarEncargadoDto,
  ) {
    return this.proyectosService.agregarEncargado(proyectoId, dto.usuarioId);
  }

  @Delete(':id/encargados/:usuarioId')
  @Roles('admin', 'secretaria')
  quitarEncargado(
    @Param('id') proyectoId: string,
    @Param('usuarioId') usuarioId: string,
  ) {
    return this.proyectosService.quitarEncargado(proyectoId, usuarioId);
  }
}
