import { Injectable, ConflictException, NotFoundException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { R2Service } from '../r2/r2.service';
import { CreateClienteDto } from './dto/create-cliente.dto';
import { UpdateClienteDto } from './dto/update-cliente.dto';

const PDF_MAGIC_BYTES = Buffer.from([0x25, 0x50, 0x44, 0x46]); // %PDF

@Injectable()
export class ClientesService {
  constructor(
    private readonly prisma:  PrismaService,
    private readonly r2:      R2Service,
  ) {}

  private async generarCodigo(): Promise<string> {
    const ultimo = await this.prisma.cliente.findFirst({
      orderBy: { id: 'desc' },
      select:  { id: true },
    });

    let siguiente = 1;
    if (ultimo) {
      const match = ultimo.id.match(/^CLI-(\d+)$/);
      if (match) siguiente = parseInt(match[1], 10) + 1;
    }

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

  private buildDocumentoKey(clienteId: string): string {
    return `clientes/${clienteId}/documento.pdf`;
  }

  private validatePdfBuffer(buffer: Buffer): void {
    // Validar magic bytes: los primeros 4 bytes deben ser %PDF (25 50 44 46)
    if (buffer.length < 4 || !buffer.slice(0, 4).equals(PDF_MAGIC_BYTES)) {
      throw new BadRequestException('El archivo no es un PDF válido.');
    }
  }

  async create(dto: CreateClienteDto) {
    const dpiExiste = await this.prisma.cliente.findUnique({ where: { dpi: dto.dpi } });
    if (dpiExiste) throw new ConflictException('Ya existe un cliente registrado con ese DPI.');

    const id = await this.generarCodigo();
    return this.prisma.cliente.create({ data: { id, ...dto } });
  }

  async uploadDocumento(clienteId: string, buffer: Buffer, mimetype: string): Promise<{ documentoKey: string }> {
    // Validar mimetype
    if (mimetype !== 'application/pdf') {
      throw new BadRequestException('Solo se permiten archivos PDF.');
    }

    // Validar magic bytes (doble verificación — mimetype puede ser falsificado)
    this.validatePdfBuffer(buffer);

    await this.findOne(clienteId);

    const key = this.buildDocumentoKey(clienteId);
    await this.r2.uploadFile(key, buffer, 'application/pdf');

    await this.prisma.cliente.update({
      where: { id: clienteId },
      data:  { documentoKey: key },
    });

    return { documentoKey: key };
  }

  async getDocumentoUrl(clienteId: string): Promise<{ url: string }> {
    const cliente = await this.findOne(clienteId);

    if (!cliente.documentoKey) {
      throw new NotFoundException('Este cliente no tiene documento registrado.');
    }

    const url = await this.r2.getPresignedUrl(cliente.documentoKey);
    return { url };
  }

  async findAll(page = 1, pageSize = 200) {
    const skip = (page - 1) * pageSize;
    const [clientes, total] = await Promise.all([
      this.prisma.cliente.findMany({
        orderBy: { createdAt: 'desc' },
        skip,
        take: pageSize,
      }),
      this.prisma.cliente.count(),
    ]);
    return {
      data:       clientes,
      total,
      page,
      pageSize,
      totalPages: Math.ceil(total / pageSize),
    };
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
      if (dpiExiste) throw new ConflictException('Ya existe otro cliente con ese DPI.');
    }

    return this.prisma.cliente.update({ where: { id }, data: dto });
  }

  async remove(id: string) {
    const cliente = await this.findOne(id);

    // Si tiene documento en R2, eliminarlo
    if (cliente.documentoKey) {
      await this.r2.deleteFile(cliente.documentoKey);
    }

    return this.prisma.cliente.delete({ where: { id } });
  }
}
