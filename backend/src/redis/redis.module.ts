import { Global, Module } from '@nestjs/common';
import { RedisService } from './redis.service';
import { UserCacheService } from './user-cache.service';

// @Global: RedisService y UserCacheService disponibles en todo el proyecto
// sin necesidad de importar RedisModule en cada módulo que los necesite
@Global()
@Module({
  providers: [RedisService, UserCacheService],
  exports: [RedisService, UserCacheService],
})
export class RedisModule {}
