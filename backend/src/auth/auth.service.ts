import { Injectable, UnauthorizedException, HttpException, HttpStatus } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { PrismaService } from '../prisma/prisma.service';
import { UsersService } from '../users/users.service';
import { RedisService } from '../redis/redis.service';
import * as bcrypt from 'bcrypt';
import { LoginDto } from './dto/login.dto';
import type { UserWithRole } from './interfaces/jwt-payload.interface';

@Injectable()
export class AuthService {
  private readonly jwtSecret: string;
  private readonly jwtRefreshSecret: string;
  private readonly jwtExpiration: string;
  private readonly jwtRefreshExpiration: string;

  private readonly MAX_ATTEMPTS = 5;
  private readonly LOCKOUT_TTL = 60; // segundos
  private readonly FAILURES_TTL = 120; // segundos sin actividad para limpiar contador

  constructor(
    private prisma: PrismaService,
    private usersService: UsersService,
    private jwtService: JwtService,
    private configService: ConfigService,
    private redis: RedisService,
  ) {
    this.jwtSecret = this.configService.get<string>('JWT_SECRET')!;
    this.jwtRefreshSecret = this.configService.get<string>('JWT_REFRESH_SECRET')!;
    this.jwtExpiration = this.configService.get<string>('JWT_EXPIRATION') || '15m';
    this.jwtRefreshExpiration = this.configService.get<string>('JWT_REFRESH_EXPIRATION') || '7d';

    if (!this.jwtSecret || !this.jwtRefreshSecret) {
      throw new Error('JWT_SECRET y JWT_REFRESH_SECRET deben estar definidos en las variables de entorno');
    }
  }

  private async checkLockout(username: string): Promise<void> {
    const expiresAt = await this.redis.get(`login_lockout:${username}`);
    if (!expiresAt) return;
    const remaining = Math.ceil((parseInt(expiresAt) - Date.now()) / 1000);
    if (remaining > 0) {
      throw new HttpException(
        `Demasiados intentos fallidos. Intenta nuevamente en ${remaining} segundos.`,
        HttpStatus.TOO_MANY_REQUESTS,
      );
    }
    await this.redis.del(`login_lockout:${username}`);
  }

  private async recordFailedAttempt(username: string): Promise<void> {
    const current = await this.redis.get(`login_failures:${username}`);
    const count = current ? parseInt(current) + 1 : 1;
    if (count >= this.MAX_ATTEMPTS) {
      const expiresAt = Date.now() + this.LOCKOUT_TTL * 1000;
      await this.redis.set(`login_lockout:${username}`, String(expiresAt), this.LOCKOUT_TTL);
      await this.redis.del(`login_failures:${username}`);
    } else {
      await this.redis.set(`login_failures:${username}`, String(count), this.FAILURES_TTL);
    }
  }

  private async clearLoginAttempts(username: string): Promise<void> {
    await this.redis.del(`login_failures:${username}`);
    await this.redis.del(`login_lockout:${username}`);
  }

  async login(loginDto: LoginDto, ipAddress?: string, userAgent?: string) {
    // 1. Verificar lockout
    await this.checkLockout(loginDto.username);

    // 2. Buscar usuario
    const user = await this.usersService.findByUsername(loginDto.username);

    if (!user) {
      await this.recordFailedAttempt(loginDto.username);
      await this.logAudit({
        username: loginDto.username,
        action: 'LOGIN_FAILED',
        ipAddress,
        userAgent,
        details: { reason: 'Usuario no encontrado' },
      });
      throw new UnauthorizedException('Credenciales incorrectas');
    }

    // 3. Verificar si está activo
    if (!user.isActive) {
      await this.logAudit({
        userId: user.id,
        username: user.username,
        action: 'LOGIN_FAILED',
        ipAddress,
        userAgent,
        details: { reason: 'Usuario inactivo' },
      });
      throw new UnauthorizedException('Usuario inactivo');
    }

    // 4. Verificar contraseña
    const isPasswordValid = await bcrypt.compare(loginDto.password, user.password);

    if (!isPasswordValid) {
      await this.recordFailedAttempt(loginDto.username);
      await this.logAudit({
        userId: user.id,
        username: user.username,
        action: 'LOGIN_FAILED',
        ipAddress,
        userAgent,
        details: { reason: 'Contraseña incorrecta' },
      });
      throw new UnauthorizedException('Credenciales incorrectas');
    }

    // 5. Login exitoso — limpiar intentos fallidos
    await this.clearLoginAttempts(loginDto.username);

    // 6. Generar tokens
    const tokens = await this.generateTokens(user, ipAddress, userAgent);

    // 7. Registrar login exitoso
    await this.logAudit({
      userId: user.id,
      username: user.username,
      action: 'LOGIN_SUCCESS',
      ipAddress,
      userAgent,
    });

    // 6. Retornar respuesta
    return {
      accessToken: tokens.accessToken,
      refreshToken: tokens.refreshToken,
      mustChangePassword: user.mustChangePassword,
      user: {
        id: user.id,
        username: user.username,
        nombre: user.nombre,
        telefono: user.telefono,
        isActive: user.isActive,
        mustChangePassword: user.mustChangePassword,
        roleId: user.roleId,
        role: user.role,
        createdAt: user.createdAt.toISOString(),
        updatedAt: user.updatedAt.toISOString(),
      },
    };
  }

  async refreshTokens(refreshToken: string) {
    try {
      // 1. Verificar token
      const payload = this.jwtService.verify(refreshToken, {
        secret: this.jwtRefreshSecret,
      });

      // 2. Verificar que no esté revocado
      const tokenRecord = await this.prisma.refreshToken.findFirst({
        where: {
          token: refreshToken,
          revoked: false,
        },
      });

      if (!tokenRecord) {
        throw new UnauthorizedException('Token revocado o inválido');
      }

      // 3. Buscar usuario
      const user = await this.usersService.findById(payload.sub);

      if (!user || !user.isActive) {
        throw new UnauthorizedException('Usuario no encontrado o inactivo');
      }

      // 4. Generar nuevo access token
      const accessToken = this.jwtService.sign(
        {
          sub: user.id,
          username: user.username,
          role: user.role.nombre,
        },
        {
          secret: this.jwtSecret,
          expiresIn: this.jwtExpiration as any,
        },
      );

      return { accessToken };
    } catch (error) {
      throw new UnauthorizedException('Token inválido o expirado');
    }
  }

  async logout(refreshToken: string) {
    await this.prisma.refreshToken.updateMany({
      where: { token: refreshToken },
      data: {
        revoked: true,
        revokedAt: new Date(),
      },
    });

    return { message: 'Logout exitoso' };
  }

  private async generateTokens(user: UserWithRole, ipAddress?: string, userAgent?: string) {
    // Access Token (15 minutos)
    const accessToken = this.jwtService.sign(
      {
        sub: user.id,
        username: user.username,
        role: user.role.nombre,
      },
      {
        secret: this.jwtSecret,
        expiresIn: this.jwtExpiration as any,
      },
    );

    // Refresh Token (7 días)
    const refreshToken = this.jwtService.sign(
      {
        sub: user.id,
        username: user.username,
      },
      {
        secret: this.jwtRefreshSecret,
        expiresIn: this.jwtRefreshExpiration as any,
      },
    );

    // Guardar refresh token en BD
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + 7);

    await this.prisma.refreshToken.create({
      data: {
        token: refreshToken,
        userId: user.id,
        expiresAt,
        ipAddress,
        userAgent,
      },
    });

    return { accessToken, refreshToken };
  }

  private async logAudit(data: {
    userId?: string;
    username?: string;
    action: string;
    ipAddress?: string;
    userAgent?: string;
    details?: any;
  }) {
    await this.prisma.auditLog.create({
      data: {
        userId: data.userId,
        username: data.username,
        action: data.action,
        ipAddress: data.ipAddress,
        userAgent: data.userAgent,
        details: data.details,
      },
    });
  }
}
