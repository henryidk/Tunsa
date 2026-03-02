import { Injectable, ConflictException, NotFoundException, BadRequestException } from '@nestjs/common';
import { randomInt } from 'crypto';
import * as bcrypt from 'bcrypt';
import { PrismaService } from '../prisma/prisma.service';
import { CreateUserDto } from './dto/create-user.dto';
import { UpdateUserDto } from './dto/update-user.dto';

/**
 * Genera una contraseña aleatoria de 8 caracteres usando crypto.randomInt,
 * garantizando al menos un carácter de cada tipo.
 * crypto.randomInt es criptográficamente seguro (CSPRNG).
 */
function generateSecurePassword(): string {
  const upper   = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
  const lower   = 'abcdefghijklmnopqrstuvwxyz';
  const digits  = '0123456789';
  const special = '!@#$%&*';
  const all     = upper + lower + digits + special;

  // Garantizar al menos uno de cada tipo
  const password: string[] = [
    upper  [randomInt(upper.length)],
    lower  [randomInt(lower.length)],
    digits [randomInt(digits.length)],
    special[randomInt(special.length)],
    all[randomInt(all.length)],
    all[randomInt(all.length)],
    all[randomInt(all.length)],
    all[randomInt(all.length)],
  ];

  // Fisher-Yates shuffle con crypto.randomInt
  for (let i = password.length - 1; i > 0; i--) {
    const j = randomInt(i + 1);
    [password[i], password[j]] = [password[j], password[i]];
  }

  return password.join('');
}

const userSelect = {
  id: true,
  username: true,
  nombre: true,
  telefono: true,
  isActive: true,
  mustChangePassword: true,
  roleId: true,
  role: true,
  createdAt: true,
  updatedAt: true,
};

@Injectable()
export class UsersService {
  constructor(private prisma: PrismaService) {}

  async findByUsername(username: string) {
    return this.prisma.usuario.findUnique({
      where: { username },
      include: { role: true },
    });
  }

  async findById(id: string) {
    return this.prisma.usuario.findUnique({
      where: { id },
      include: { role: true },
    });
  }

  async findAll() {
    return this.prisma.usuario.findMany({
      select: userSelect,
      orderBy: { createdAt: 'asc' },
    });
  }

  async setActive(id: string, isActive: boolean, requestingUserId: string) {
    if (id === requestingUserId) {
      throw new ConflictException('No puedes modificar el estado de tu propia cuenta');
    }

    const usuario = await this.prisma.usuario.findUnique({ where: { id } });
    if (!usuario) throw new NotFoundException('Usuario no encontrado');

    if (!isActive) {
      await this.prisma.refreshToken.updateMany({
        where: { userId: id, revoked: false },
        data: { revoked: true, revokedAt: new Date() },
      });
    }

    return this.prisma.usuario.update({
      where: { id },
      data: { isActive },
      select: userSelect,
    });
  }

  async update(id: string, data: UpdateUserDto) {
    const usuario = await this.prisma.usuario.findUnique({ where: { id } });
    if (!usuario) throw new NotFoundException('Usuario no encontrado');

    if (data.username && data.username !== usuario.username) {
      const taken = await this.prisma.usuario.findUnique({ where: { username: data.username } });
      if (taken) throw new ConflictException('El nombre de usuario ya está en uso');
    }

    return this.prisma.usuario.update({
      where: { id },
      data: {
        ...(data.nombre   !== undefined && { nombre:   data.nombre }),
        ...(data.username !== undefined && { username: data.username }),
        ...(data.telefono !== undefined && { telefono: data.telefono || null }),
      },
      select: userSelect,
    });
  }

  async create(dto: CreateUserDto) {
    const taken = await this.prisma.usuario.findUnique({ where: { username: dto.username } });
    if (taken) throw new ConflictException('El nombre de usuario ya está en uso');

    const role = await this.prisma.role.findUnique({ where: { nombre: dto.rol } });
    if (!role) throw new NotFoundException('Rol no encontrado');

    const plainPassword  = generateSecurePassword();
    const hashedPassword = await bcrypt.hash(plainPassword, 12);

    const usuario = await this.prisma.usuario.create({
      data: {
        nombre:            dto.nombre,
        username:          dto.username,
        telefono:          dto.telefono || null,
        password:          hashedPassword,
        mustChangePassword: true,
        roleId:            role.id,
      },
      select: userSelect,
    });

    return { ...usuario, temporaryPassword: plainPassword };
  }

  async resetPassword(id: string, requestingUserId: string, ipAddress?: string, userAgent?: string) {
    if (id === requestingUserId) {
      throw new ConflictException('No puedes resetear tu propia contraseña');
    }

    const usuario = await this.prisma.usuario.findUnique({ where: { id } });
    if (!usuario) throw new NotFoundException('Usuario no encontrado');

    const plainPassword  = generateSecurePassword();
    const hashedPassword = await bcrypt.hash(plainPassword, 12);

    // Revocar todas las sesiones activas del usuario afectado
    await this.prisma.refreshToken.updateMany({
      where: { userId: id, revoked: false },
      data: { revoked: true, revokedAt: new Date() },
    });

    const updated = await this.prisma.usuario.update({
      where: { id },
      data: { password: hashedPassword, mustChangePassword: true },
      select: userSelect,
    });

    // Registrar en audit log — nunca se loguea la contraseña en texto plano
    await this.prisma.auditLog.create({
      data: {
        userId:    requestingUserId,
        action:    'PASSWORD_RESET_BY_ADMIN',
        ipAddress: ipAddress ?? null,
        userAgent: userAgent  ?? null,
        details: {
          targetUserId:   id,
          targetUsername: usuario.username,
        },
      },
    });

    return { ...updated, temporaryPassword: plainPassword };
  }

  async changePassword(userId: string, newPassword: string) {
    const usuario = await this.prisma.usuario.findUnique({ where: { id: userId } });
    if (!usuario) throw new NotFoundException('Usuario no encontrado');

    // Evitar que el usuario reutilice su contraseña actual (incluida la temporal)
    const isSamePassword = await bcrypt.compare(newPassword, usuario.password);
    if (isSamePassword) {
      throw new BadRequestException('La nueva contraseña no puede ser igual a la contraseña actual');
    }

    const hashedPassword = await bcrypt.hash(newPassword, 12);

    // Revocar todos los refresh tokens para invalidar otras sesiones
    await this.prisma.refreshToken.updateMany({
      where: { userId, revoked: false },
      data: { revoked: true, revokedAt: new Date() },
    });

    return this.prisma.usuario.update({
      where: { id: userId },
      data: { password: hashedPassword, mustChangePassword: false },
      select: userSelect,
    });
  }
}
