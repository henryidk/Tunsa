import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import * as Joi from 'joi';
import { PrismaModule } from './prisma/prisma.module';
import { RedisModule } from './redis/redis.module';
import { AuthModule } from './auth/auth.module';
import { UsersModule } from './users/users.module';
import { EquiposModule } from './equipos/equipos.module';
import { CategoriasModule } from './categorias/categorias.module';
import { BitacorasModule } from './bitacoras/bitacoras.module';
import { ClientesModule } from './clientes/clientes.module';
import { CleanupModule } from './cleanup/cleanup.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      validationSchema: Joi.object({
        // Database
        DATABASE_URL: Joi.string().uri().required()
          .messages({ 'any.required': 'DATABASE_URL es obligatorio' }),

        // JWT
        JWT_SECRET: Joi.string().min(32).required()
          .messages({
            'any.required': 'JWT_SECRET es obligatorio',
            'string.min': 'JWT_SECRET debe tener al menos 32 caracteres',
          }),
        JWT_REFRESH_SECRET: Joi.string().min(32).required()
          .messages({
            'any.required': 'JWT_REFRESH_SECRET es obligatorio',
            'string.min': 'JWT_REFRESH_SECRET debe tener al menos 32 caracteres',
          }),
        JWT_EXPIRATION: Joi.string().default('15m'),
        JWT_REFRESH_EXPIRATION: Joi.string().default('7d'),

        // Server
        PORT: Joi.number().default(4000),
        NODE_ENV: Joi.string()
          .valid('development', 'production')
          .default('development'),

        // CORS
        FRONTEND_URL: Joi.string().uri().required()
          .messages({ 'any.required': 'FRONTEND_URL es obligatorio' }),

        // Redis
        REDIS_HOST: Joi.string().default('localhost'),
        REDIS_PORT: Joi.number().default(6379),
      }),
      validationOptions: {
        abortEarly: false,
      },
    }),
    PrismaModule,
    RedisModule,
    AuthModule,
    UsersModule,
    EquiposModule,
    CategoriasModule,
    BitacorasModule,
    ClientesModule,
    CleanupModule,
  ],
})
export class AppModule {}
