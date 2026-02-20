import { Injectable, CanActivate, ExecutionContext, ForbiddenException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { SKIP_MUST_CHANGE_PASSWORD_KEY } from '../decorators/skip-must-change-password.decorator';
import type { AuthenticatedUser } from '../interfaces/jwt-payload.interface';

@Injectable()
export class MustChangePasswordGuard implements CanActivate {
  constructor(private reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const skip = this.reflector.getAllAndOverride<boolean>(SKIP_MUST_CHANGE_PASSWORD_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);

    if (skip) return true;

    const { user } = context.switchToHttp().getRequest<{ user: AuthenticatedUser }>();

    // Si no hay usuario (ruta pública sin JwtAuthGuard), dejar pasar
    if (!user) return true;

    if (user.mustChangePassword) {
      throw new ForbiddenException(
        'Debes cambiar tu contraseña temporal antes de continuar',
      );
    }

    return true;
  }
}
