import { Controller, Get, Post, Patch, Param, Body, UseGuards, Ip, Headers } from '@nestjs/common';
import { UsersService } from './users.service';
import { CreateUserDto } from './dto/create-user.dto';
import { UpdateUserDto } from './dto/update-user.dto';
import { ChangePasswordDto } from './dto/change-password.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { MustChangePasswordGuard } from '../auth/guards/must-change-password.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { SkipMustChangePassword } from '../auth/decorators/skip-must-change-password.decorator';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import type { AuthenticatedUser } from '../auth/interfaces/jwt-payload.interface';

@Controller('users')
@UseGuards(JwtAuthGuard, RolesGuard, MustChangePasswordGuard)
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  @Get()
  @Roles('admin')
  findAll() {
    return this.usersService.findAll();
  }

  @Post()
  @Roles('admin')
  create(@Body() createUserDto: CreateUserDto) {
    return this.usersService.create(createUserDto);
  }

  /**
   * Permite a cualquier usuario autenticado cambiar su propia contraseña.
   * @SkipMustChangePassword() es necesario para que usuarios con
   * mustChangePassword = true puedan acceder a este endpoint.
   */
  @Patch('change-password')
  @SkipMustChangePassword()
  changePassword(
    @Body() dto: ChangePasswordDto,
    @CurrentUser() currentUser: AuthenticatedUser,
  ) {
    return this.usersService.changePassword(currentUser.id, dto.newPassword);
  }

  @Patch(':id')
  @Roles('admin')
  update(@Param('id') id: string, @Body() updateUserDto: UpdateUserDto) {
    return this.usersService.update(id, updateUserDto);
  }

  @Patch(':id/reset-password')
  @Roles('admin')
  resetPassword(
    @Param('id') id: string,
    @CurrentUser() currentUser: AuthenticatedUser,
    @Ip() ipAddress: string,
    @Headers('user-agent') userAgent: string,
  ) {
    return this.usersService.resetPassword(id, currentUser.id, ipAddress, userAgent);
  }

  @Patch(':id/deactivate')
  @Roles('admin')
  deactivate(@Param('id') id: string, @CurrentUser() currentUser: AuthenticatedUser) {
    return this.usersService.setActive(id, false, currentUser.id);
  }

  @Patch(':id/activate')
  @Roles('admin')
  activate(@Param('id') id: string, @CurrentUser() currentUser: AuthenticatedUser) {
    return this.usersService.setActive(id, true, currentUser.id);
  }
}
