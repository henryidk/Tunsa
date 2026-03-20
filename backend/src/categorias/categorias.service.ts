import {
  Injectable,
  NotFoundException,
  ConflictException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateCategoriaDto } from './dto/create-categoria.dto';
import { UpdateCategoriaDto } from './dto/update-categoria.dto';

@Injectable()
export class CategoriasService {
  constructor(private prisma: PrismaService) {}

  /** GET /categorias/tipos — tipos con categorías (solo id+nombre). Usado por formularios de equipo. */
  async findTipos() {
    return this.prisma.tipoEquipo.findMany({
      orderBy: { nombre: 'asc' },
      include: {
        categorias: {
          orderBy: { nombre: 'asc' },
          select: { id: true, nombre: true },
        },
      },
    });
  }

  /** GET /categorias/admin — tipos con categorías + conteo de equipos. Usado por el panel de administración. */
  async findTiposAdmin() {
    return this.prisma.tipoEquipo.findMany({
      orderBy: { nombre: 'asc' },
      include: {
        categorias: {
          orderBy: { nombre: 'asc' },
          include: { _count: { select: { equipos: true } } },
        },
      },
    });
  }

  /** GET /categorias */
  async findAll() {
    return this.prisma.categoria.findMany({
      orderBy: [{ tipo: { nombre: 'asc' } }, { nombre: 'asc' }],
      select: {
        id:     true,
        nombre: true,
        tipoId: true,
        tipo:   { select: { id: true, nombre: true } },
      },
    });
  }

  /** GET /categorias?tipoId=xxx */
  async findByTipo(tipoId: string) {
    const tipo = await this.prisma.tipoEquipo.findUnique({ where: { id: tipoId } });
    if (!tipo) throw new NotFoundException(`Tipo no encontrado: "${tipoId}"`);

    return this.prisma.categoria.findMany({
      where:   { tipoId },
      orderBy: { nombre: 'asc' },
      select:  { id: true, nombre: true, tipoId: true },
    });
  }

  /** POST /categorias */
  async create(dto: CreateCategoriaDto) {
    const tipo = await this.prisma.tipoEquipo.findUnique({ where: { id: dto.tipoId } });
    if (!tipo) throw new NotFoundException(`Tipo no encontrado`);

    const existe = await this.prisma.categoria.findUnique({
      where: { nombre_tipoId: { nombre: dto.nombre, tipoId: dto.tipoId } },
    });
    if (existe) throw new ConflictException(`Ya existe la categoría "${dto.nombre}" en este tipo`);

    return this.prisma.categoria.create({
      data:    { nombre: dto.nombre, tipoId: dto.tipoId },
      include: { _count: { select: { equipos: true } } },
    });
  }

  /** PATCH /categorias/:id */
  async update(id: string, dto: UpdateCategoriaDto) {
    const cat = await this.prisma.categoria.findUnique({ where: { id } });
    if (!cat) throw new NotFoundException(`Categoría no encontrada`);

    const duplicado = await this.prisma.categoria.findFirst({
      where: { nombre: dto.nombre, tipoId: cat.tipoId, NOT: { id } },
    });
    if (duplicado) throw new ConflictException(`Ya existe la categoría "${dto.nombre}" en este tipo`);

    return this.prisma.categoria.update({
      where:   { id },
      data:    { nombre: dto.nombre },
      include: { _count: { select: { equipos: true } } },
    });
  }

  /** DELETE /categorias/:id */
  async remove(id: string) {
    const cat = await this.prisma.categoria.findUnique({
      where:   { id },
      include: { _count: { select: { equipos: true } } },
    });
    if (!cat) throw new NotFoundException(`Categoría no encontrada`);

    if (cat._count.equipos > 0) {
      throw new ConflictException(
        `No se puede eliminar: ${cat._count.equipos} equipo(s) usan esta categoría`,
      );
    }

    await this.prisma.categoria.delete({ where: { id } });
  }
}
