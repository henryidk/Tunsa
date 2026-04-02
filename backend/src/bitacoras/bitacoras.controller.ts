import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { BitacorasService } from './bitacoras.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { MustChangePasswordGuard } from '../auth/guards/must-change-password.guard';
import { Roles } from '../auth/decorators/roles.decorator';

@Controller('bitacoras')
@UseGuards(JwtAuthGuard, RolesGuard, MustChangePasswordGuard)
export class BitacorasController {
  constructor(private readonly bitacorasService: BitacorasService) {}

  /** GET /bitacoras/stats — conteos globales */
  @Get('stats')
  @Roles('admin')
  getStats() {
    return this.bitacorasService.getStats();
  }

  /** GET /bitacoras?cursor=&modulo=&search= */
  @Get()
  @Roles('admin')
  findAll(
    @Query('cursor') cursor?: string,
    @Query('modulo')  modulo?: string,
    @Query('search')  search?: string,
  ) {
    return this.bitacorasService.findAll({ cursor, modulo, search });
  }
}
