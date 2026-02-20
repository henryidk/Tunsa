import { Injectable, ConflictException, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { UpdateUserDto } from './dto/update-user.dto';

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
      select: {
        id: true,
        username: true,
        nombre: true,
        telefono: true,
        isActive: true,
        roleId: true,
        role: true,
        createdAt: true,
        updatedAt: true,
      },
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
      select: {
        id: true,
        username: true,
        nombre: true,
        telefono: true,
        isActive: true,
        roleId: true,
        role: true,
        createdAt: true,
        updatedAt: true,
      },
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
        ...(data.nombre !== undefined && { nombre: data.nombre }),
        ...(data.username !== undefined && { username: data.username }),
        ...(data.telefono !== undefined && { telefono: data.telefono || null }),
      },
      select: {
        id: true,
        username: true,
        nombre: true,
        telefono: true,
        isActive: true,
        roleId: true,
        role: true,
        createdAt: true,
        updatedAt: true,
      },
    });
  }

  async create(data: {
    username: string;
    password: string;
    nombre: string;
    telefono?: string;
    roleId: string;
  }) {
    return this.prisma.usuario.create({
      data,
      include: { role: true },
    });
  }
}
