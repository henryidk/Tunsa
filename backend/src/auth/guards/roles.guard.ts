import { Injectable, CanActivate, ExecutionContext, ForbiddenException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { ROLES_KEY } from '../decorators/roles.decorator';

@Injectable()
export class RolesGuard implements CanActivate {
  constructor(private reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    // 1. Obtener los roles requeridos de la ruta
    const requiredRoles = this.reflector.getAllAndOverride<string[]>(ROLES_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);

    // Si la ruta no requiere roles específicos, permitir acceso
    if (!requiredRoles) {
      return true;
    }

    // 2. Obtener el usuario del request (puesto por JwtAuthGuard)
    const { user } = context.switchToHttp().getRequest();

    // Denegar si no hay usuario autenticado en el request
    if (!user) return false;

    // 3. Verificar si el usuario tiene el rol requerido
    const hasRole = requiredRoles.includes(user.role);

    if (!hasRole) {
      throw new ForbiddenException(
        `Acceso denegado. Se requiere uno de estos roles: ${requiredRoles.join(', ')}`
      );
    }

    return true;
  }
}
