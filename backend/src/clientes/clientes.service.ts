import { Injectable, ConflictException, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateClienteDto } from './dto/create-cliente.dto';
import { UpdateClienteDto } from './dto/update-cliente.dto';

@Injectable()
export class ClientesService {
  constructor(private readonly prisma: PrismaService) {}

  private async generarCodigo(): Promise<string> {
    // Obtener el último CLI para extraer el número más alto
    const ultimo = await this.prisma.cliente.findFirst({
      orderBy: { id: 'desc' },
      select: { id: true },
    });

    let siguiente = 1;
    if (ultimo) {
      const match = ultimo.id.match(/^CLI-(\d+)$/);
      if (match) {
        siguiente = parseInt(match[1], 10) + 1;
      }
    }

    // Garantizar unicidad (por si hay huecos o concurrencia)
    let codigo: string;
    let intentos = 0;
    do {
      codigo = `CLI-${String(siguiente).padStart(4, '0')}`;
      const existe = await this.prisma.cliente.findUnique({ where: { id: codigo } });
      if (!existe) break;
      siguiente++;
      intentos++;
    } while (intentos < 100);

    return codigo;
  }

  async create(dto: CreateClienteDto) {
    // Verificar DPI duplicado
    const dpiExiste = await this.prisma.cliente.findUnique({ where: { dpi: dto.dpi } });
    if (dpiExiste) {
      throw new ConflictException('Ya existe un cliente registrado con ese DPI.');
    }

    const id = await this.generarCodigo();

    return this.prisma.cliente.create({
      data: { id, ...dto },
    });
  }

  async findAll() {
    return this.prisma.cliente.findMany({
      orderBy: { createdAt: 'desc' },
    });
  }

  async findOne(id: string) {
    const cliente = await this.prisma.cliente.findUnique({ where: { id } });
    if (!cliente) throw new NotFoundException(`Cliente ${id} no encontrado.`);
    return cliente;
  }

  async update(id: string, dto: UpdateClienteDto) {
    await this.findOne(id);

    if (dto.dpi) {
      const dpiExiste = await this.prisma.cliente.findFirst({
        where: { dpi: dto.dpi, NOT: { id } },
      });
      if (dpiExiste) {
        throw new ConflictException('Ya existe otro cliente con ese DPI.');
      }
    }

    return this.prisma.cliente.update({ where: { id }, data: dto });
  }

  async remove(id: string) {
    await this.findOne(id);
    return this.prisma.cliente.delete({ where: { id } });
  }
}
