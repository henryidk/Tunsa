import { Module } from '@nestjs/common';
import { UsersController } from './users.controller';
import { UsersService } from './users.service';
import { MustChangePasswordGuard } from '../auth/guards/must-change-password.guard';

@Module({
  controllers: [UsersController],
  providers: [UsersService, MustChangePasswordGuard],
  exports: [UsersService],
})
export class UsersModule {}
