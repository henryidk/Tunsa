import { Controller, Get, Post, Patch, Delete, Param, Body, UseGuards, HttpCode } from '@nestjs/common';
import { ExtrasService } from './extras.service';
import { CreateTipoExtraDto } from './dto/create-tipo-extra.dto';
import { UpdateTipoExtraDto } from './dto/update-tipo-extra.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { MustChangePasswordGuard } from '../auth/guards/must-change-password.guard';
import { Roles } from '../auth/decorators/roles.decorator';

@Controller('extras')
@UseGuards(JwtAuthGuard, RolesGuard, MustChangePasswordGuard)
export class ExtrasController {
  constructor(private readonly extrasService: ExtrasService) {}

  @Get()
  findAll() {
    return this.extrasService.findAll();
  }

  @Post()
  @Roles('admin')
  create(@Body() dto: CreateTipoExtraDto) {
    return this.extrasService.create(dto);
  }

  @Patch(':id')
  @Roles('admin')
  update(@Param('id') id: string, @Body() dto: UpdateTipoExtraDto) {
    return this.extrasService.update(id, dto);
  }

  @Delete(':id')
  @Roles('admin')
  @HttpCode(204)
  remove(@Param('id') id: string) {
    return this.extrasService.remove(id);
  }
}
