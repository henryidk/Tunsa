import {
  Controller, Get, Post, Patch, Delete,
  Param, Body, Query, UseGuards,
  UseInterceptors, UploadedFile, ParseFilePipe,
  MaxFileSizeValidator, FileTypeValidator,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { ClientesService } from './clientes.service';
import { CreateClienteDto } from './dto/create-cliente.dto';
import { UpdateClienteDto } from './dto/update-cliente.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { MustChangePasswordGuard } from '../auth/guards/must-change-password.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import type { AuthenticatedUser } from '../auth/interfaces/jwt-payload.interface';

const MAX_PDF_SIZE = 10 * 1024 * 1024; // 10 MB

@Controller('clientes')
@UseGuards(JwtAuthGuard, RolesGuard, MustChangePasswordGuard)
@Roles('admin', 'secretaria', 'encargado_maquinas')
export class ClientesController {
  constructor(private readonly clientesService: ClientesService) {}

  @Post()
  @Roles('admin', 'secretaria', 'encargado_maquinas')
  create(
    @Body() dto: CreateClienteDto,
    @CurrentUser() currentUser: AuthenticatedUser,
  ) {
    return this.clientesService.create(dto, currentUser.username);
  }

  @Get()
  findAll(
    @Query('page')     page?:     string,
    @Query('pageSize') pageSize?: string,
  ) {
    return this.clientesService.findAll(
      page     ? parseInt(page)     : 1,
      pageSize ? parseInt(pageSize) : 200,
    );
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.clientesService.findOne(id);
  }

  @Patch(':id')
  @Roles('admin', 'secretaria')
  update(
    @Param('id') id: string,
    @Body() dto: UpdateClienteDto,
    @CurrentUser() currentUser: AuthenticatedUser,
  ) {
    return this.clientesService.update(id, dto, currentUser.username);
  }

  @Delete(':id')
  @Roles('admin')
  remove(@Param('id') id: string) {
    return this.clientesService.remove(id);
  }

  // ── Documento PDF ──────────────────────────────────────────────────────────

  @Post(':id/documento')
  @Roles('admin', 'secretaria', 'encargado_maquinas')
  @UseInterceptors(FileInterceptor('file', { limits: { fileSize: MAX_PDF_SIZE } }))
  uploadDocumento(
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
    @CurrentUser() currentUser: AuthenticatedUser,
  ) {
    return this.clientesService.uploadDocumento(id, file.buffer, file.mimetype, currentUser.username);
  }

  @Get(':id/documento')
  @Roles('admin', 'secretaria', 'encargado_maquinas')
  getDocumento(@Param('id') id: string) {
    return this.clientesService.getDocumentoUrl(id);
  }
}
