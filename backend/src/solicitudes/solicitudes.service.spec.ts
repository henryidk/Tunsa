import { Test, TestingModule } from '@nestjs/testing';
import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';
import { SolicitudesService } from './solicitudes.service';
import { PrismaService } from '../prisma/prisma.service';
import { R2Service } from '../r2/r2.service';

// Buffer mínimo con magic bytes válidos de PDF (%PDF-)
const PDF_BUFFER = Buffer.from([0x25, 0x50, 0x44, 0x46, 0x2d, 0x31]);
const NOT_PDF    = Buffer.from([0x00, 0x01, 0x02, 0x03]);

/**
 * Construye un objeto que imita la forma de una Solicitud de Prisma.
 * Solo incluye los campos que usa confirmarEntrega; el resto usa defaults seguros.
 */
function makeSolicitud(overrides: Record<string, unknown> = {}): any {
  return {
    id:                    'sol-123',
    clienteId:             'cli-456',
    folio:                 '202605-0001',
    creadaPor:             'enc1',
    estado:                'APROBADA',
    esPesada:              false,
    items:                 [],
    fechaInicioRenta:      new Date('2026-05-01T08:00:00Z'),
    extensiones:           null,
    devolucionesParciales: null,
    fechaUltimaDevolucion: null,
    // serializeSolicitud necesita que estos campos tengan toString()
    totalEstimado:         { toString: () => '500' },
    recargoTotal:          null,
    totalFinal:            null,
    costoAcumuladoPesada:  { toString: () => '0' },
    cliente: {
      id:       'cli-456',
      nombre:   'Test SA',
      dpi:      null,
      telefono: null,
      email:    null,
    },
    lecturas: [],
    ...overrides,
  };
}

describe('SolicitudesService — confirmarEntrega', () => {
  let service: SolicitudesService;
  let prisma:  any;
  let r2:      any;
  let mockTx:  any;

  beforeEach(async () => {
    mockTx = {
      solicitud:        { update:     jest.fn() },
      resumenItem:      { create:     jest.fn() },
      detalleHorometro: { create:     jest.fn() },
    };

    prisma = {
      solicitud:    { findUnique: jest.fn() },
      $transaction: jest.fn().mockImplementation((fn: (tx: any) => Promise<any>) => fn(mockTx)),
    };

    r2 = {
      uploadFile:      jest.fn().mockResolvedValue(undefined),
      getPresignedUrl: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        SolicitudesService,
        { provide: PrismaService, useValue: prisma },
        { provide: R2Service,     useValue: r2    },
      ],
    }).compile();

    service = module.get<SolicitudesService>(SolicitudesService);
  });

  // ── Validaciones previas ──────────────────────────────────────────────────────

  describe('validaciones', () => {
    it('lanza NotFoundException si la solicitud no existe', async () => {
      prisma.solicitud.findUnique.mockResolvedValue(null);

      await expect(
        service.confirmarEntrega('id-inexistente', PDF_BUFFER, 'application/pdf', 'enc1'),
      ).rejects.toThrow(NotFoundException);
    });

    it('lanza ForbiddenException si el encargado no creó la solicitud', async () => {
      prisma.solicitud.findUnique.mockResolvedValue(
        makeSolicitud({ creadaPor: 'otro-encargado' }),
      );

      await expect(
        service.confirmarEntrega('sol-123', PDF_BUFFER, 'application/pdf', 'enc1'),
      ).rejects.toThrow(ForbiddenException);
    });

    it('lanza ConflictException si el estado no es APROBADA', async () => {
      prisma.solicitud.findUnique.mockResolvedValue(
        makeSolicitud({ estado: 'ACTIVA' }),
      );

      await expect(
        service.confirmarEntrega('sol-123', PDF_BUFFER, 'application/pdf', 'enc1'),
      ).rejects.toThrow(ConflictException);
    });

    it('lanza ConflictException si la solicitud no tiene folio', async () => {
      prisma.solicitud.findUnique.mockResolvedValue(
        makeSolicitud({ folio: null }),
      );

      await expect(
        service.confirmarEntrega('sol-123', PDF_BUFFER, 'application/pdf', 'enc1'),
      ).rejects.toThrow(ConflictException);
    });

    it('lanza BadRequestException si el archivo no es un PDF válido', async () => {
      prisma.solicitud.findUnique.mockResolvedValue(makeSolicitud());

      await expect(
        service.confirmarEntrega('sol-123', NOT_PDF, 'application/pdf', 'enc1'),
      ).rejects.toThrow(BadRequestException);
    });

    it('no llama a $transaction si alguna validación falla', async () => {
      prisma.solicitud.findUnique.mockResolvedValue(null);

      await expect(
        service.confirmarEntrega('sol-123', PDF_BUFFER, 'application/pdf', 'enc1'),
      ).rejects.toThrow();

      expect(prisma.$transaction).not.toHaveBeenCalled();
    });
  });

  // ── Renta liviana / granel ────────────────────────────────────────────────────

  describe('renta liviana', () => {
    const livianaItems = [
      { kind: 'maquinaria', equipoId: 'eq-1', duracion: 3, unidad: 'dias',  tarifa: 150 },
      { kind: 'granel',     tipo: 'PUNTAL',   duracion: 3, unidad: 'dias',  tarifa: 50  },
    ];

    beforeEach(() => {
      const sol = makeSolicitud({ esPesada: false, items: livianaItems });
      prisma.solicitud.findUnique.mockResolvedValue(sol);
      mockTx.solicitud.update.mockResolvedValue({ ...sol, estado: 'ACTIVA' });
      mockTx.resumenItem.create.mockResolvedValue({ id: 'ri-1' });
    });

    it('sube el comprobante a R2 con la key correcta', async () => {
      await service.confirmarEntrega('sol-123', PDF_BUFFER, 'application/pdf', 'enc1');

      expect(r2.uploadFile).toHaveBeenCalledWith(
        'clientes/cli-456/comprobantes/202605-0001.pdf',
        PDF_BUFFER,
        'application/pdf',
      );
    });

    it('actualiza el estado a ACTIVA dentro de la transacción', async () => {
      await service.confirmarEntrega('sol-123', PDF_BUFFER, 'application/pdf', 'enc1');

      expect(mockTx.solicitud.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 'sol-123' },
          data:  expect.objectContaining({
            estado:          'ACTIVA',
            comprobanteKey:  'clientes/cli-456/comprobantes/202605-0001.pdf',
          }),
        }),
      );
    });

    it('crea exactamente un resumenItem por cada ítem liviano', async () => {
      await service.confirmarEntrega('sol-123', PDF_BUFFER, 'application/pdf', 'enc1');

      expect(mockTx.resumenItem.create).toHaveBeenCalledTimes(2);
    });

    it('crea resumenItem de maquinaria con los datos correctos', async () => {
      await service.confirmarEntrega('sol-123', PDF_BUFFER, 'application/pdf', 'enc1');

      expect(mockTx.resumenItem.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            solicitudId:    'sol-123',
            clienteId:      'cli-456',
            equipoId:       'eq-1',
            itemRef:        'eq-1',
            tipoItem:       'maquinaria',
            tarifaEfectiva: 150,
          }),
        }),
      );
    });

    it('crea resumenItem de granel sin equipoId y con itemRef = tipo', async () => {
      await service.confirmarEntrega('sol-123', PDF_BUFFER, 'application/pdf', 'enc1');

      expect(mockTx.resumenItem.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            solicitudId:    'sol-123',
            clienteId:      'cli-456',
            equipoId:       null,
            itemRef:        'PUNTAL',
            tipoItem:       'granel',
            tarifaEfectiva: 50,
          }),
        }),
      );
    });

    it('no crea ningún detalleHorometro para rentas livianas', async () => {
      await service.confirmarEntrega('sol-123', PDF_BUFFER, 'application/pdf', 'enc1');

      expect(mockTx.detalleHorometro.create).not.toHaveBeenCalled();
    });

    it('omite ítems sin equipoId ni tipo al crear resumenItem', async () => {
      const itemsSinRef = [
        { kind: 'maquinaria', equipoId: 'eq-1', duracion: 1, unidad: 'dias', tarifa: 100 },
        { kind: 'granel',     tipo: '',          duracion: 1, unidad: 'dias', tarifa: 30  }, // itemRef vacío
      ];
      const sol = makeSolicitud({ esPesada: false, items: itemsSinRef });
      prisma.solicitud.findUnique.mockResolvedValue(sol);
      mockTx.solicitud.update.mockResolvedValue({ ...sol, estado: 'ACTIVA' });

      await service.confirmarEntrega('sol-123', PDF_BUFFER, 'application/pdf', 'enc1');

      // Solo se crea el de maquinaria; el granel con tipo vacío se omite
      expect(mockTx.resumenItem.create).toHaveBeenCalledTimes(1);
    });
  });

  // ── Renta pesada ──────────────────────────────────────────────────────────────

  describe('renta pesada', () => {
    const pesadaItems = [
      { kind: 'pesada', equipoId: 'eq-p1', tarifaEfectiva: 300, horometroInicial: 1200, diasSolicitados: 5, duracion: 5, unidad: 'dias' },
      { kind: 'pesada', equipoId: 'eq-p2', tarifaEfectiva: 450, horometroInicial: undefined, diasSolicitados: 3, duracion: 3, unidad: 'dias' },
    ];

    beforeEach(() => {
      const sol = makeSolicitud({ esPesada: true, items: pesadaItems });
      prisma.solicitud.findUnique.mockResolvedValue(sol);
      mockTx.solicitud.update.mockResolvedValue({ ...sol, estado: 'ACTIVA' });
      mockTx.resumenItem.create
        .mockResolvedValueOnce({ id: 'ri-p1' })
        .mockResolvedValueOnce({ id: 'ri-p2' });
      mockTx.detalleHorometro.create.mockResolvedValue({});
    });

    it('crea exactamente un resumenItem por cada equipo pesado', async () => {
      await service.confirmarEntrega('sol-123', PDF_BUFFER, 'application/pdf', 'enc1');

      expect(mockTx.resumenItem.create).toHaveBeenCalledTimes(2);
    });

    it('crea resumenItem pesado con tipoItem = pesada y tarifaEfectiva correcta', async () => {
      await service.confirmarEntrega('sol-123', PDF_BUFFER, 'application/pdf', 'enc1');

      expect(mockTx.resumenItem.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            solicitudId:    'sol-123',
            clienteId:      'cli-456',
            equipoId:       'eq-p1',
            itemRef:        'eq-p1',
            tipoItem:       'pesada',
            tarifaEfectiva: 300,
          }),
        }),
      );
    });

    it('crea exactamente un detalleHorometro por cada resumenItem pesado', async () => {
      await service.confirmarEntrega('sol-123', PDF_BUFFER, 'application/pdf', 'enc1');

      expect(mockTx.detalleHorometro.create).toHaveBeenCalledTimes(2);
    });

    it('graba el horometroInicial cuando está presente', async () => {
      await service.confirmarEntrega('sol-123', PDF_BUFFER, 'application/pdf', 'enc1');

      expect(mockTx.detalleHorometro.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            resumenItemId:    'ri-p1',
            horometroEntrega: 1200,
          }),
        }),
      );
    });

    it('graba horometroEntrega = null cuando el horómetro inicial no fue ingresado', async () => {
      await service.confirmarEntrega('sol-123', PDF_BUFFER, 'application/pdf', 'enc1');

      expect(mockTx.detalleHorometro.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            resumenItemId:    'ri-p2',
            horometroEntrega: null,
          }),
        }),
      );
    });

    it('calcula fechaFinEstimada usando el máximo de diasSolicitados', async () => {
      await service.confirmarEntrega('sol-123', PDF_BUFFER, 'application/pdf', 'enc1');

      const updateCall        = mockTx.solicitud.update.mock.calls[0][0];
      const fechaInicio       = new Date('2026-05-01T08:00:00Z');
      const expectedFechaFin  = new Date(fechaInicio.getTime() + 5 * 86_400_000); // max = 5 días

      expect(updateCall.data.fechaFinEstimada).toEqual(expectedFechaFin);
    });

    it('no crea resumenItem de tipo liviano para rentas pesadas', async () => {
      await service.confirmarEntrega('sol-123', PDF_BUFFER, 'application/pdf', 'enc1');

      const createCalls = mockTx.resumenItem.create.mock.calls;
      createCalls.forEach((call: any[]) => {
        expect(call[0].data.tipoItem).toBe('pesada');
      });
    });
  });

  // ── Comportamiento compartido ─────────────────────────────────────────────────

  describe('comportamiento compartido', () => {
    it('usa fechaEntrega como fechaInicio si la solicitud no tiene fechaInicioRenta', async () => {
      const items = [{ kind: 'maquinaria', equipoId: 'eq-1', duracion: 2, unidad: 'dias', tarifa: 100 }];
      const sol   = makeSolicitud({ esPesada: false, items, fechaInicioRenta: null });
      prisma.solicitud.findUnique.mockResolvedValue(sol);
      mockTx.solicitud.update.mockResolvedValue({ ...sol, estado: 'ACTIVA' });
      mockTx.resumenItem.create.mockResolvedValue({ id: 'ri-1' });

      await expect(
        service.confirmarEntrega('sol-123', PDF_BUFFER, 'application/pdf', 'enc1'),
      ).resolves.not.toThrow();

      // fechaFinEstimada debe existir en el update (calculada desde fechaEntrega)
      const updateCall = mockTx.solicitud.update.mock.calls[0][0];
      expect(updateCall.data.fechaFinEstimada).toBeInstanceOf(Date);
    });

    it('el resumenItem recibe la misma fechaEntrega que el update de la solicitud', async () => {
      const items = [{ kind: 'maquinaria', equipoId: 'eq-1', duracion: 1, unidad: 'dias', tarifa: 100 }];
      const sol   = makeSolicitud({ esPesada: false, items });
      prisma.solicitud.findUnique.mockResolvedValue(sol);
      mockTx.solicitud.update.mockResolvedValue({ ...sol, estado: 'ACTIVA' });
      mockTx.resumenItem.create.mockResolvedValue({ id: 'ri-1' });

      await service.confirmarEntrega('sol-123', PDF_BUFFER, 'application/pdf', 'enc1');

      const fechaEnUpdate       = mockTx.solicitud.update.mock.calls[0][0].data.fechaEntrega;
      const fechaEnResumenItem  = mockTx.resumenItem.create.mock.calls[0][0].data.fechaEntrega;

      expect(fechaEnResumenItem).toBe(fechaEnUpdate); // misma referencia, mismo instante
    });
  });
});
