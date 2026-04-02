import { Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { UsersService } from '../../users/users.service';
import { UserCacheService } from '../../redis/user-cache.service';
import type { JwtPayload, AuthenticatedUser } from '../interfaces/jwt-payload.interface';

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(
    private readonly usersService: UsersService,
    private readonly userCache: UserCacheService,
    configService: ConfigService,
  ) {
    const secret = configService.get<string>('JWT_SECRET');
    if (!secret) {
      throw new Error('JWT_SECRET no está definido en las variables de entorno');
    }
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: secret,
    });
  }

  async validate(payload: JwtPayload): Promise<AuthenticatedUser> {
    // 1. Cache hit — sin query a DB
    const cached = await this.userCache.get(payload.sub);
    if (cached) return cached;

    // 2. Cache miss — consultar DB
    const user = await this.usersService.findById(payload.sub);
    if (!user || !user.isActive) {
      throw new UnauthorizedException('Usuario no encontrado o inactivo');
    }

    const authenticatedUser: AuthenticatedUser = {
      id:                 user.id,
      username:           user.username,
      role:               user.role.nombre,
      mustChangePassword: user.mustChangePassword,
    };

    // 3. Guardar en cache — solo usuarios activos y validados
    await this.userCache.set(authenticatedUser);

    return authenticatedUser;
  }
}
