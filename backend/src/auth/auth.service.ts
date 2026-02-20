import { Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { PrismaService } from '../prisma/prisma.service';
import { UsersService } from '../users/users.service';
import * as bcrypt from 'bcrypt';
import { LoginDto } from './dto/login.dto';
import type { UserWithRole } from './interfaces/jwt-payload.interface';

@Injectable()
export class AuthService {
  private readonly jwtSecret: string;
  private readonly jwtRefreshSecret: string;
  private readonly jwtExpiration: string;
  private readonly jwtRefreshExpiration: string;

  constructor(
    private prisma: PrismaService,
    private usersService: UsersService,
    private jwtService: JwtService,
    private configService: ConfigService,
  ) {
    this.jwtSecret = this.configService.get<string>('JWT_SECRET')!;
    this.jwtRefreshSecret = this.configService.get<string>('JWT_REFRESH_SECRET')!;
    this.jwtExpiration = this.configService.get<string>('JWT_EXPIRATION') || '15m';
    this.jwtRefreshExpiration = this.configService.get<string>('JWT_REFRESH_EXPIRATION') || '7d';

    if (!this.jwtSecret || !this.jwtRefreshSecret) {
      throw new Error('JWT_SECRET y JWT_REFRESH_SECRET deben estar definidos en las variables de entorno');
    }
  }

  async login(loginDto: LoginDto, ipAddress?: string, userAgent?: string) {
    // 1. Buscar usuario
    const user = await this.usersService.findByUsername(loginDto.username);

    if (!user) {
      await this.logAudit({
        username: loginDto.username,
        action: 'LOGIN_FAILED',
        ipAddress,
        userAgent,
        details: { reason: 'Usuario no encontrado' },
      });
      throw new UnauthorizedException('Credenciales incorrectas');
    }

    // 2. Verificar si está activo
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

    // 3. Verificar contraseña
    const isPasswordValid = await bcrypt.compare(loginDto.password, user.password);

    if (!isPasswordValid) {
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

    // 4. Generar tokens
    const tokens = await this.generateTokens(user, ipAddress, userAgent);

    // 5. Registrar login exitoso
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
