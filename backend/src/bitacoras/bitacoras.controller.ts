import { Controller, Get, UseGuards } from '@nestjs/common';
import { BitacorasService } from './bitacoras.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { MustChangePasswordGuard } from '../auth/guards/must-change-password.guard';
import { Roles } from '../auth/decorators/roles.decorator';

@Controller('bitacoras')
@UseGuards(JwtAuthGuard, RolesGuard, MustChangePasswordGuard)
export class BitacorasController {
  constructor(private readonly bitacorasService: BitacorasService) {}

  @Get()
  @Roles('admin')
  findAll() {
    return this.bitacorasService.findAll();
  }
}
