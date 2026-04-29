import {
  Controller, Get, Post, Patch, Body, Param, Query,
  UseGuards, UseInterceptors, UploadedFile, ParseFilePipe,
  MaxFileSizeValidator, FileTypeValidator,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { SolicitudesService } from './solicitudes.service';
import { SolicitudesQueryService } from './solicitudes-query.service';
import { SolicitudesGateway } from './solicitudes.gateway';
import { HorometroService } from './horometro.service';
import { CreateSolicitudDto } from './dto/create-solicitud.dto';
import { AmpliacionRentaDto } from './dto/ampliar-renta.dto';
import { RegistrarDevolucionDto } from './dto/registrar-devolucion.dto';
import { RegistrarLecturaDto } from './dto/lectura-horometro.dto';
import { RegistrarDevolucionPesadaDto } from './dto/registrar-devolucion-pesada.dto';
import { QueryRechazadasDto } from './dto/query-rechazadas.dto';
import { RechazarSolicitudDto } from './dto/rechazar-solicitud.dto';
import { IniciarEntregaDto } from './dto/iniciar-entrega.dto';
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
    private readonly solicitudesService:      SolicitudesService,
    private readonly solicitudesQueryService: SolicitudesQueryService,
    private readonly solicitudesGateway:      SolicitudesGateway,
    private readonly horometroService:        HorometroService,
  ) {}

  // ── Escrituras ────────────────────────────────────────────────────────────────

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
    @Body() dto: IniciarEntregaDto,
  ) {
    return this.solicitudesService.iniciarEntrega(id, user.username, dto);
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

  // ── Lecturas (maquinaria pesada) ──────────────────────────────────────────────

  @Post(':id/horometro/lecturas')
  @Roles('encargado_maquinas', 'admin')
  registrarLectura(
    @Param('id') id: string,
    @Body() dto: RegistrarLecturaDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.horometroService.registrarLectura(id, dto, user);
  }

  @Patch(':id/registrar-devolucion-pesada')
  @Roles('encargado_maquinas', 'admin', 'secretaria')
  registrarDevolucionPesada(
    @Param('id') id: string,
    @Body() dto: RegistrarDevolucionPesadaDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.horometroService.registrarDevolucionPesada(id, dto, user);
  }

  // ── Consultas ─────────────────────────────────────────────────────────────────

  @Get()
  @Roles('admin', 'secretaria')
  findAll() {
    return this.solicitudesQueryService.findAll();
  }

  /**
   * Debe declararse antes de @Get('mias') para que NestJS no lo interprete como param.
   */
  @Get('equipos-reservados')
  @Roles('encargado_maquinas', 'admin', 'secretaria')
  getEquiposReservados() {
    return this.solicitudesQueryService.getEquiposReservados();
  }

  @Get('dashboard-stats')
  @Roles('encargado_maquinas')
  getDashboardStats(@CurrentUser() user: AuthenticatedUser) {
    return this.solicitudesQueryService.getDashboardStatsEncargado(user.username);
  }

  @Get('mias')
  @Roles('encargado_maquinas')
  findMias(@CurrentUser() user: AuthenticatedUser) {
    return this.solicitudesQueryService.findMias(user.username);
  }

  @Get('vencidas')
  @Roles('admin', 'secretaria')
  findVencidas() {
    return this.solicitudesQueryService.findVencidas();
  }

  @Get('activas')
  @Roles('admin', 'secretaria')
  findActivas() {
    return this.solicitudesQueryService.findActivas();
  }

  @Get('activas-mias')
  @Roles('encargado_maquinas')
  findActivasMias(@CurrentUser() user: AuthenticatedUser) {
    return this.solicitudesQueryService.findActivasMias(user.username);
  }

  @Get('vencidas-mias')
  @Roles('encargado_maquinas')
  findVencidasMias(@CurrentUser() user: AuthenticatedUser) {
    return this.solicitudesQueryService.findVencidasMias(user.username);
  }

  @Get('rechazadas')
  @Roles('admin', 'secretaria')
  findRechazadas(@Query() query: QueryRechazadasDto) {
    return this.solicitudesQueryService.findRechazadas({
      fechaDesde: new Date(query.fechaDesde),
      fechaHasta: new Date(query.fechaHasta),
      cursor:     query.cursor,
    });
  }

  @Get('historial')
  @Roles('admin', 'secretaria')
  findHistorial(@Query() query: QueryRechazadasDto) {
    return this.solicitudesQueryService.findHistorial({
      fechaDesde: new Date(query.fechaDesde),
      fechaHasta: new Date(query.fechaHasta),
      cursor:     query.cursor,
    });
  }

  @Get('rechazadas-mias')
  @Roles('encargado_maquinas')
  findRechazadasMias(
    @Query() query: QueryRechazadasDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.solicitudesQueryService.findRechazadasMias(user.username, {
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
    return this.solicitudesQueryService.findHistorialMias(user.username, {
      fechaDesde: new Date(query.fechaDesde),
      fechaHasta: new Date(query.fechaHasta),
      cursor:     query.cursor,
    });
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

  @Get(':id/horometro')
  @Roles('encargado_maquinas', 'admin', 'secretaria')
  getLecturas(
    @Param('id') id: string,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.horometroService.getLecturas(id, user);
  }
}
