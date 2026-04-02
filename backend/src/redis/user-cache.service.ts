import { Injectable, Logger } from '@nestjs/common';
import { RedisService } from './redis.service';
import type { AuthenticatedUser } from '../auth/interfaces/jwt-payload.interface';

// TTL menor al access token (15min) — el cache nunca sobrevive al token
const CACHE_TTL_SECONDS = 5 * 60; // 5 minutos
const CACHE_PREFIX = 'auth:user:';

@Injectable()
export class UserCacheService {
  private readonly logger = new Logger(UserCacheService.name);

  constructor(private readonly redis: RedisService) {}

  private key(userId: string): string {
    return `${CACHE_PREFIX}${userId}`;
  }

  /** Retorna el usuario cacheado, o null si no existe o Redis falla */
  async get(userId: string): Promise<AuthenticatedUser | null> {
    try {
      const raw = await this.redis.get(this.key(userId));
      if (!raw) return null;
      return JSON.parse(raw) as AuthenticatedUser;
    } catch (err: any) {
      this.logger.warn(`Cache read falló para usuario ${userId}: ${err.message}`);
      return null; // Redis caído — fallback a DB
    }
  }

  /** Guarda el usuario en cache. Solo llamar con usuarios activos y validados */
  async set(user: AuthenticatedUser): Promise<void> {
    try {
      await this.redis.set(this.key(user.id), JSON.stringify(user), CACHE_TTL_SECONDS);
    } catch (err: any) {
      this.logger.warn(`Cache write falló para usuario ${user.id}: ${err.message}`);
      // Redis caído — el sistema sigue funcionando, solo sin cache
    }
  }

  /** Elimina el usuario del cache. Llamar en cualquier cambio de estado del usuario */
  async invalidate(userId: string): Promise<void> {
    try {
      await this.redis.del(this.key(userId));
    } catch (err: any) {
      this.logger.warn(`Cache invalidation falló para usuario ${userId}: ${err.message}`);
    }
  }
}
