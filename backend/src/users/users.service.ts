import { Injectable, ConflictException, NotFoundException, BadRequestException } from '@nestjs/common';
import { randomInt } from 'crypto';
import * as bcrypt from 'bcrypt';
import { PrismaService } from '../prisma/prisma.service';
import { UserCacheService } from '../redis/user-cache.service';
import { CreateUserDto } from './dto/create-user.dto';
import { UpdateUserDto } from './dto/update-user.dto';

function generateSecurePassword(): string {
  const upper   = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
  const lower   = 'abcdefghijklmnopqrstuvwxyz';
  const digits  = '0123456789';
  const special = '!@#$%&*';
  const all     = upper + lower + digits + special;

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
  constructor(
    private readonly prisma: PrismaService,
    private readonly userCache: UserCacheService,
  ) {}

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

  async setActive(id: string, isActive: boolean, requestingUserId: string, requestingUsername: string) {
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

    const updated = await this.prisma.usuario.update({
      where: { id },
      data: { isActive },
      select: userSelect,
    });

    // Invalidar cache — el estado activo/inactivo debe reflejarse en el próximo request
    await this.userCache.invalidate(id);

    await this.prisma.bitacora.create({
      data: {
        modulo:        'usuario',
        entidadId:     id,
        entidadNombre: `${usuario.nombre} (@${usuario.username})`,
        campo:         isActive ? 'activar' : 'desactivar',
        valorAnterior: isActive ? 'Inactivo' : 'Activo',
        valorNuevo:    isActive ? 'Activo'   : 'Inactivo',
        realizadoPor:  requestingUsername,
      },
    });

    return updated;
  }

  async update(id: string, data: UpdateUserDto, requestingUsername: string) {
    const usuario = await this.prisma.usuario.findUnique({ where: { id } });
    if (!usuario) throw new NotFoundException('Usuario no encontrado');

    if (data.username && data.username !== usuario.username) {
      const taken = await this.prisma.usuario.findUnique({ where: { username: data.username } });
      if (taken) throw new ConflictException('El nombre de usuario ya está en uso');
    }

    const updated = await this.prisma.usuario.update({
      where: { id },
      data: {
        ...(data.nombre   !== undefined && { nombre:   data.nombre }),
        ...(data.username !== undefined && { username: data.username }),
        ...(data.telefono !== undefined && { telefono: data.telefono || null }),
      },
      select: userSelect,
    });

    const changes: { campo: string; valorAnterior: string | null; valorNuevo: string | null }[] = [];

    if (data.nombre !== undefined && data.nombre !== usuario.nombre) {
      changes.push({ campo: 'nombre', valorAnterior: usuario.nombre, valorNuevo: data.nombre });
    }
    if (data.username !== undefined && data.username !== usuario.username) {
      changes.push({ campo: 'username', valorAnterior: usuario.username, valorNuevo: data.username });
    }
    if (data.telefono !== undefined) {
      const prev = usuario.telefono ?? null;
      const next = data.telefono   || null;
      if (prev !== next) {
        changes.push({ campo: 'telefono', valorAnterior: prev, valorNuevo: next });
      }
    }

    // Invalidar cache — username u otros datos pueden haber cambiado
    await this.userCache.invalidate(id);

    if (changes.length > 0) {
      await this.prisma.bitacora.createMany({
        data: changes.map(c => ({
          modulo:        'usuario',
          entidadId:     id,
          entidadNombre: `${updated.nombre} (@${updated.username})`,
          campo:         c.campo,
          valorAnterior: c.valorAnterior,
          valorNuevo:    c.valorNuevo,
          realizadoPor:  requestingUsername,
        })),
      });
    }

    return updated;
  }

  async create(dto: CreateUserDto, requestingUsername: string) {
    const taken = await this.prisma.usuario.findUnique({ where: { username: dto.username } });
    if (taken) throw new ConflictException('El nombre de usuario ya está en uso');

    const role = await this.prisma.role.findUnique({ where: { nombre: dto.rol } });
    if (!role) throw new NotFoundException('Rol no encontrado');

    const plainPassword  = generateSecurePassword();
    const hashedPassword = await bcrypt.hash(plainPassword, 12);

    const usuario = await this.prisma.usuario.create({
      data: {
        nombre:             dto.nombre,
        username:           dto.username,
        telefono:           dto.telefono || null,
        password:           hashedPassword,
        mustChangePassword: true,
        roleId:             role.id,
      },
      select: userSelect,
    });

    await this.prisma.bitacora.create({
      data: {
        modulo:        'usuario',
        entidadId:     usuario.id,
        entidadNombre: `${usuario.nombre} (@${usuario.username})`,
        campo:         'crear',
        valorAnterior: null,
        valorNuevo:    role.nombre,
        realizadoPor:  requestingUsername,
      },
    });

    return { ...usuario, temporaryPassword: plainPassword };
  }

  async resetPassword(id: string, requestingUserId: string, requestingUsername: string, ipAddress?: string, userAgent?: string) {
    if (id === requestingUserId) {
      throw new ConflictException('No puedes resetear tu propia contraseña');
    }

    const usuario = await this.prisma.usuario.findUnique({ where: { id } });
    if (!usuario) throw new NotFoundException('Usuario no encontrado');

    const plainPassword  = generateSecurePassword();
    const hashedPassword = await bcrypt.hash(plainPassword, 12);

    await this.prisma.refreshToken.updateMany({
      where: { userId: id, revoked: false },
      data: { revoked: true, revokedAt: new Date() },
    });

    const updated = await this.prisma.usuario.update({
      where: { id },
      data: { password: hashedPassword, mustChangePassword: true },
      select: userSelect,
    });

    // Invalidar cache — mustChangePassword cambia a true
    await this.userCache.invalidate(id);

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

    await this.prisma.bitacora.create({
      data: {
        modulo:        'usuario',
        entidadId:     id,
        entidadNombre: `${usuario.nombre} (@${usuario.username})`,
        campo:         'reset_password',
        valorAnterior: null,
        valorNuevo:    null,
        realizadoPor:  requestingUsername,
      },
    });

    return { ...updated, temporaryPassword: plainPassword };
  }

  async changePassword(userId: string, newPassword: string) {
    const usuario = await this.prisma.usuario.findUnique({ where: { id: userId } });
    if (!usuario) throw new NotFoundException('Usuario no encontrado');

    const isSamePassword = await bcrypt.compare(newPassword, usuario.password);
    if (isSamePassword) {
      throw new BadRequestException('La nueva contraseña no puede ser igual a la contraseña actual');
    }

    const hashedPassword = await bcrypt.hash(newPassword, 12);

    await this.prisma.refreshToken.updateMany({
      where: { userId, revoked: false },
      data: { revoked: true, revokedAt: new Date() },
    });

    const updated = await this.prisma.usuario.update({
      where: { id: userId },
      data: { password: hashedPassword, mustChangePassword: false },
      select: userSelect,
    });

    // Invalidar cache — mustChangePassword cambia a false
    await this.userCache.invalidate(userId);

    return updated;
  }
}
