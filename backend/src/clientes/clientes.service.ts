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

  async checkDpi(dpi: string): Promise<{ exists: boolean }> {
    const cliente = await this.prisma.cliente.findUnique({ where: { dpi } });
    return { exists: !!cliente };
  }

  async create(dto: CreateClienteDto, requestingUsername: string) {
    const dpiExiste = await this.prisma.cliente.findUnique({ where: { dpi: dto.dpi } });
    if (dpiExiste) throw new ConflictException('Ya existe un cliente registrado con ese DPI.');

    if (dto.telefono) {
      const telExiste = await this.prisma.cliente.findUnique({ where: { telefono: dto.telefono } });
      if (telExiste) throw new ConflictException('Ya existe un cliente registrado con ese número de teléfono.');
    }

    const id      = await this.generarCodigo();
    const cliente = await this.prisma.cliente.create({ data: { id, ...dto } });

    await this.prisma.bitacora.create({
      data: {
        modulo:        'cliente',
        entidadId:     cliente.id,
        entidadNombre: `${cliente.nombre} (${cliente.id})`,
        campo:         'crear',
        valorAnterior: null,
        valorNuevo:    null,
        realizadoPor:  requestingUsername,
      },
    });

    return cliente;
  }

  async uploadDocumento(clienteId: string, buffer: Buffer, mimetype: string, requestingUsername: string): Promise<{ documentoKey: string }> {
    // Validar mimetype
    if (mimetype !== 'application/pdf') {
      throw new BadRequestException('Solo se permiten archivos PDF.');
    }

    // Validar magic bytes (doble verificación — mimetype puede ser falsificado)
    this.validatePdfBuffer(buffer);

    const cliente = await this.findOne(clienteId);

    const key = this.buildDocumentoKey(clienteId);
    await this.r2.uploadFile(key, buffer, 'application/pdf');

    await this.prisma.cliente.update({
      where: { id: clienteId },
      data:  { documentoKey: key },
    });

    await this.prisma.bitacora.create({
      data: {
        modulo:        'cliente',
        entidadId:     clienteId,
        entidadNombre: `${cliente.nombre} (${clienteId})`,
        campo:         'documento',
        valorAnterior: null,
        valorNuevo:    null,
        realizadoPor:  requestingUsername,
      },
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

  async update(id: string, dto: UpdateClienteDto, requestingUsername: string) {
    const anterior = await this.findOne(id);

    if (dto.dpi) {
      const dpiExiste = await this.prisma.cliente.findFirst({
        where: { dpi: dto.dpi, NOT: { id } },
      });
      if (dpiExiste) throw new ConflictException('Ya existe otro cliente con ese DPI.');
    }

    if (dto.telefono) {
      const telExiste = await this.prisma.cliente.findFirst({
        where: { telefono: dto.telefono, NOT: { id } },
      });
      if (telExiste) throw new ConflictException('Ya existe otro cliente con ese número de teléfono.');
    }

    const actualizado = await this.prisma.cliente.update({ where: { id }, data: dto });

    const changes: { campo: string; valorAnterior: string | null; valorNuevo: string | null }[] = [];

    if (dto.nombre !== undefined && dto.nombre !== anterior.nombre) {
      changes.push({ campo: 'nombre', valorAnterior: anterior.nombre, valorNuevo: dto.nombre });
    }
    if (dto.dpi !== undefined && dto.dpi !== anterior.dpi) {
      changes.push({ campo: 'dpi', valorAnterior: anterior.dpi, valorNuevo: dto.dpi });
    }
    if (dto.telefono !== undefined) {
      const prev = anterior.telefono ?? null;
      const next = dto.telefono    || null;
      if (prev !== next) {
        changes.push({ campo: 'telefono', valorAnterior: prev, valorNuevo: next });
      }
    }

    if (changes.length > 0) {
      await this.prisma.bitacora.createMany({
        data: changes.map(c => ({
          modulo:        'cliente',
          entidadId:     id,
          entidadNombre: `${actualizado.nombre} (${id})`,
          campo:         c.campo,
          valorAnterior: c.valorAnterior,
          valorNuevo:    c.valorNuevo,
          realizadoPor:  requestingUsername,
        })),
      });
    }

    return actualizado;
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
