import { Injectable, CanActivate, ExecutionContext, ForbiddenException } from '@nestjs/common';
import { tieneAccesoGlobal } from '../../auth/utils/roles.util';

@Injectable()
export class EspecialClienteGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const { body, user } = context.switchToHttp().getRequest();

    if (!body?.esEspecial) return true;

    if (!tieneAccesoGlobal(user)) {
      throw new ForbiddenException('Solo admin y secretaria pueden registrar clientes especiales.');
    }

    return true;
  }
}
