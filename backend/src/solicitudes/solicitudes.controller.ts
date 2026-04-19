import {
  Controller, Get, Post, Patch, Body, Param, Query,
  UseGuards, UseInterceptors, UploadedFile, ParseFilePipe,
  MaxFileSizeValidator, FileTypeValidator,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { SolicitudesService } from './solicitudes.service';
import { SolicitudesGateway } from './solicitudes.gateway';
import { CreateSolicitudDto } from './dto/create-solicitud.dto';
import { AmpliacionRentaDto } from './dto/ampliar-renta.dto';
import { RegistrarDevolucionDto } from './dto/registrar-devolucion.dto';
import { QueryRechazadasDto } from './dto/query-rechazadas.dto';
import { RechazarSolicitudDto } from './dto/rechazar-solicitud.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { MustChangePasswordGuard } from '../auth/guards/must-change-password.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import type { AuthenticatedUser } from '../auth/interfaces/jwt-payload.interface';

const MAX_PDF_SIZE = 10 * 1024 * 1024; // 10 MB

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

  @Get('vencidas')
  @Roles('admin', 'secretaria')
  findVencidas() {
    return this.solicitudesService.findVencidas();
  }

  @Get('activas')
  @Roles('admin', 'secretaria')
  findActivas() {
    return this.solicitudesService.findActivas();
  }

  @Get('activas-mias')
  @Roles('encargado_maquinas')
  findActivasMias(@CurrentUser() user: AuthenticatedUser) {
    return this.solicitudesService.findActivasMias(user.username);
  }

  @Get('vencidas-mias')
  @Roles('encargado_maquinas')
  findVencidasMias(@CurrentUser() user: AuthenticatedUser) {
    return this.solicitudesService.findVencidasMias(user.username);
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

  @Get('historial')
  @Roles('admin', 'secretaria')
  findHistorial(@Query() query: QueryRechazadasDto) {
    return this.solicitudesService.findHistorial({
      fechaDesde: new Date(query.fechaDesde),
      fechaHasta: new Date(query.fechaHasta),
      cursor:     query.cursor,
    });
  }

  @Get('historial-mias')
  @Roles('encargado_maquinas')
  findHistorialMias(
    @Query() query: QueryRechazadasDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.solicitudesService.findHistorialMias(user.username, {
      fechaDesde: new Date(query.fechaDesde),
      fechaHasta: new Date(query.fechaHasta),
      cursor:     query.cursor,
    });
  }

  @Patch(':id/aprobar')
  @Roles('admin', 'secretaria')
  async aprobar(
    @Param('id') id: string,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    const solicitud = await this.solicitudesService.aprobar(id, user.username);
    this.solicitudesGateway.emitSolicitudAprobada(solicitud, solicitud.creadaPor);
    return solicitud;
  }

  @Patch(':id/rechazar')
  @Roles('admin', 'secretaria')
  async rechazar(
    @Param('id') id: string,
    @Body() dto: RechazarSolicitudDto,
  ) {
    const solicitud = await this.solicitudesService.rechazar(id, dto.motivoRechazo);
    this.solicitudesGateway.emitSolicitudRechazada(solicitud, solicitud.creadaPor);
    return solicitud;
  }

  @Patch(':id/iniciar-entrega')
  @Roles('encargado_maquinas')
  iniciarEntrega(
    @Param('id') id: string,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.solicitudesService.iniciarEntrega(id, user.username);
  }

  @Patch(':id/confirmar-entrega')
  @Roles('encargado_maquinas')
  @UseInterceptors(FileInterceptor('comprobante', { limits: { fileSize: MAX_PDF_SIZE } }))
  async confirmarEntrega(
    @Param('id') id: string,
    @UploadedFile(
      new ParseFilePipe({
        validators: [
          new MaxFileSizeValidator({ maxSize: MAX_PDF_SIZE }),
          new FileTypeValidator({ fileType: 'application/pdf' }),
        ],
      }),
    )
    file: Express.Multer.File,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    const solicitud = await this.solicitudesService.confirmarEntrega(
      id, file.buffer, file.mimetype, user.username,
    );
    this.solicitudesGateway.emitRentaActiva(solicitud);
    return solicitud;
  }

  @Patch(':id/ampliar')
  @Roles('encargado_maquinas', 'admin', 'secretaria')
  ampliar(
    @Param('id') id: string,
    @Body() dto: AmpliacionRentaDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.solicitudesService.ampliar(id, dto, user);
  }

  @Patch(':id/registrar-devolucion')
  @Roles('encargado_maquinas', 'admin', 'secretaria')
  registrarDevolucion(
    @Param('id') id: string,
    @Body() dto: RegistrarDevolucionDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.solicitudesService.registrarDevolucion(id, dto, user);
  }

  @Patch(':id/liquidacion')
  @Roles('encargado_maquinas', 'admin', 'secretaria')
  @UseInterceptors(FileInterceptor('liquidacion', { limits: { fileSize: MAX_PDF_SIZE } }))
  subirLiquidacion(
    @Param('id') id: string,
    @UploadedFile(
      new ParseFilePipe({
        validators: [
          new MaxFileSizeValidator({ maxSize: MAX_PDF_SIZE }),
          new FileTypeValidator({ fileType: 'application/pdf' }),
        ],
      }),
    )
    file: Express.Multer.File,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.solicitudesService.subirLiquidacion(id, file.buffer, file.mimetype, user);
  }

  @Get(':id/comprobante')
  @Roles('admin', 'secretaria', 'encargado_maquinas')
  getComprobante(
    @Param('id') id: string,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.solicitudesService.getComprobanteUrl(id, user.username);
  }

  @Get(':id/liquidacion/:loteIndex')
  @Roles('encargado_maquinas', 'admin', 'secretaria')
  getLiquidacion(
    @Param('id') id: string,
    @Param('loteIndex') loteIndex: string,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.solicitudesService.getLiquidacionUrl(id, parseInt(loteIndex, 10), user);
  }
}
