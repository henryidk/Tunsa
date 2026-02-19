import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

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
