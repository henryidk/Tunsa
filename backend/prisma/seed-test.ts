/**
 * Datos de prueba — clientes y rentas activas.
 * NO afecta el seed principal (seed.ts).
 *
 * Uso:
 *   docker exec tunsa_backend npx ts-node prisma/seed-test.ts
 *   (o desde el host: cd backend && npx ts-node prisma/seed-test.ts)
 *
 * Para limpiar los datos de prueba:
 *   docker exec -it tunsa_backend npx prisma studio
 *   (o borra manualmente filtrando por clienteId que empiece en "CLI-T")
 */

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  console.log('Insertando datos de prueba...\n');

  // ── Clientes de prueba ────────────────────────────────────────────────────
  // IDs manuales para no colisionar con los reales (CLI-T001 en lugar de CLI-0001)
  const clientesDatos = [
    { id: 'CLI-T001', nombre: 'Juan Pérez García',       telefono: '55551111', dpi: '1234567890101', esEspecial: false },
    { id: 'CLI-T002', nombre: 'María López Herrera',     telefono: '55552222', dpi: '2345678901202', esEspecial: true  },
    { id: 'CLI-T003', nombre: 'Constructora ABC S.A.',   telefono: '55553333', dpi: null,            esEspecial: true  },
    { id: 'CLI-T004', nombre: 'Roberto Morales Ruiz',    telefono: '55554444', dpi: '3456789012303', esEspecial: false },
    { id: 'CLI-T005', nombre: 'Inversiones XYZ Ltda.',   telefono: '55555555', dpi: null,            esEspecial: false },
  ];

  for (const c of clientesDatos) {
    await prisma.cliente.upsert({
      where:  { id: c.id },
      update: { nombre: c.nombre, esEspecial: c.esEspecial },
      create: c,
    });
  }
  console.log(`  ${clientesDatos.length} clientes de prueba listos`);

  // ── Equipos necesarios para las rentas ────────────────────────────────────
  const bailarina2  = await prisma.equipo.findUnique({ where: { numeracion: '2'    } });
  const bailarina3  = await prisma.equipo.findUnique({ where: { numeracion: '3'    } });
  const martillo22  = await prisma.equipo.findUnique({ where: { numeracion: '22'   } });
  const generador14 = await prisma.equipo.findUnique({ where: { numeracion: '14'   } });
  const mp01        = await prisma.equipo.findUnique({ where: { numeracion: 'MP01' } });
  const mp02        = await prisma.equipo.findUnique({ where: { numeracion: 'MP02' } });

  // Equipos para vencidas (distintos a los de activas)
  const bomba6      = await prisma.equipo.findUnique({ where: { numeracion: '6'    } });
  const bomba40     = await prisma.equipo.findUnique({ where: { numeracion: '40'   } });
  const bomba44     = await prisma.equipo.findUnique({ where: { numeracion: '44'   } });
  const martillo36  = await prisma.equipo.findUnique({ where: { numeracion: '36'   } });
  const martillo70  = await prisma.equipo.findUnique({ where: { numeracion: '70'   } });
  const generador71 = await prisma.equipo.findUnique({ where: { numeracion: '71'   } });
  const mezcladora24= await prisma.equipo.findUnique({ where: { numeracion: '24'   } });
  const mezcladora25= await prisma.equipo.findUnique({ where: { numeracion: '25'   } });
  const cortadora11 = await prisma.equipo.findUnique({ where: { numeracion: '11'   } });
  const vibrador39  = await prisma.equipo.findUnique({ where: { numeracion: '39'   } });

  if (!bailarina2 || !bailarina3 || !martillo22 || !generador14 || !mp01 || !mp02) {
    console.error('  ERROR: Faltan equipos base. Ejecuta primero el seed principal.');
    process.exit(1);
  }
  if (!bomba6 || !bomba40 || !bomba44 || !martillo36 || !martillo70 ||
      !generador71 || !mezcladora24 || !mezcladora25 || !cortadora11 || !vibrador39) {
    console.error('  ERROR: Faltan equipos para vencidas. Ejecuta primero el seed principal.');
    process.exit(1);
  }

  // ── Folios de prueba ──────────────────────────────────────────────────────
  // Usamos prefijo TEST para no colisionar con el contador real de folios.
  const folios = ['TEST-0001', 'TEST-0002', 'TEST-0003', 'TEST-0004', 'TEST-0005'];
  const foliosVencidas = [
    'TEST-V001', 'TEST-V002', 'TEST-V003', 'TEST-V004', 'TEST-V005',
    'TEST-V006', 'TEST-V007', 'TEST-V008', 'TEST-V009', 'TEST-V010',
  ];

  // ── Rentas activas ────────────────────────────────────────────────────────
  const ahora = new Date();
  const hace3dias  = new Date(ahora); hace3dias.setDate(ahora.getDate() - 3);
  const hace7dias  = new Date(ahora); hace7dias.setDate(ahora.getDate() - 7);
  const hace1dia   = new Date(ahora); hace1dia.setDate(ahora.getDate() - 1);
  const en4dias    = new Date(ahora); en4dias.setDate(ahora.getDate() + 4);
  const en14dias   = new Date(ahora); en14dias.setDate(ahora.getDate() + 14);
  const hace2dias  = new Date(ahora); hace2dias.setDate(ahora.getDate() - 2);
  const en5dias    = new Date(ahora); en5dias.setDate(ahora.getDate() + 5);
  const en21dias   = new Date(ahora); en21dias.setDate(ahora.getDate() + 21);

  const rentasData = [
    // ── Renta 1: liviana simple (1 equipo, contado) ─────────────────────────
    {
      folio:          folios[0],
      clienteId:      'CLI-T001',
      creadaPor:      'encargado',
      aprobadaPor:    'admin',
      modalidad:      'CONTADO' as const,
      notas:          'Renta de prueba — bailarina por 7 días',
      totalEstimado:  2800,   // 400/día × 7 días
      estado:         'ACTIVA' as const,
      esPesada:       false,
      fechaDecision:  hace7dias,
      fechaInicioRenta: hace7dias,
      fechaEntrega:   hace7dias,
      fechaFinEstimada: ahora,
      items: [
        {
          kind:        'maquinaria',
          equipoId:    bailarina2.id,
          numeracion:  '2',
          descripcion: bailarina2.descripcion,
          duracion:    7,
          unidad:      'dias',
          tarifa:      400,
          subtotal:    2800,
        },
      ],
    },

    // ── Renta 2: liviana múltiple (2 equipos, crédito) ─────────────────────
    {
      folio:          folios[1],
      clienteId:      'CLI-T002',
      creadaPor:      'encargado',
      aprobadaPor:    'admin',
      modalidad:      'CREDITO' as const,
      notas:          'Renta de prueba — bailarina + generador por 1 semana (crédito)',
      totalEstimado:  3200,   // 1600 + 1600
      estado:         'ACTIVA' as const,
      esPesada:       false,
      fechaDecision:  hace3dias,
      fechaInicioRenta: hace3dias,
      fechaEntrega:   hace3dias,
      fechaFinEstimada: en4dias,
      items: [
        {
          kind:        'maquinaria',
          equipoId:    bailarina3.id,
          numeracion:  '3',
          descripcion: bailarina3.descripcion,
          duracion:    1,
          unidad:      'semanas',
          tarifa:      1600,
          subtotal:    1600,
        },
        {
          kind:        'maquinaria',
          equipoId:    generador14.id,
          numeracion:  '14',
          descripcion: generador14.descripcion,
          duracion:    1,
          unidad:      'semanas',
          tarifa:      1600,
          subtotal:    1600,
        },
      ],
    },

    // ── Renta 3: liviana con granel (martillo + puntales) ──────────────────
    {
      folio:          folios[2],
      clienteId:      'CLI-T003',
      creadaPor:      'encargado',
      aprobadaPor:    'admin',
      modalidad:      'CONTADO' as const,
      notas:          'Renta de prueba — martillo + 50 puntales por 1 mes',
      totalEstimado:  9075,   // 6000 (martillo/mes) + 50×15 (puntales/mes)×1
      estado:         'ACTIVA' as const,
      esPesada:       false,
      fechaDecision:  hace7dias,
      fechaInicioRenta: hace7dias,
      fechaEntrega:   hace7dias,
      fechaFinEstimada: en14dias,
      items: [
        {
          kind:        'maquinaria',
          equipoId:    martillo22.id,
          numeracion:  '22',
          descripcion: martillo22.descripcion,
          duracion:    1,
          unidad:      'meses',
          tarifa:      6000,
          subtotal:    6000,
        },
        {
          kind:        'granel',
          tipo:        'PUNTAL',
          cantidad:    50,
          duracion:    1,
          unidad:      'meses',
          tarifa:      15,
          conMadera:   false,
          subtotal:    750,
        },
        {
          kind:        'granel',
          tipo:        'ANDAMIO_SIMPLE',
          cantidad:    10,
          duracion:    1,
          unidad:      'meses',
          tarifa:      120,
          conMadera:   false,
          subtotal:    1200,
        },
      ],
    },

    // ── Renta 4: pesada (retroexcavadora) ─────────────────────────────────
    {
      folio:          folios[3],
      clienteId:      'CLI-T004',
      creadaPor:      'encargado',
      aprobadaPor:    'admin',
      modalidad:      'CONTADO' as const,
      notas:          'Renta de prueba — retroexcavadora MP01 por ~5 días',
      totalEstimado:  0,   // pesada: se cobra por horómetro, total real se calcula al devolver
      estado:         'ACTIVA' as const,
      esPesada:       true,
      fechaDecision:  hace2dias,
      fechaInicioRenta: hace2dias,
      fechaEntrega:   hace2dias,
      fechaFinEstimada: en5dias,
      items: [
        {
          kind:            'pesada',
          equipoId:        mp01.id,
          numeracion:      'MP01',
          descripcion:     mp01.descripcion,
          extras:          [],
          tarifaEfectiva:  475,
          diasSolicitados: 5,
          duracion:        5,
          unidad:          'dia',
          subtotal:        0,
        },
      ],
    },

    // ── Renta 5: cliente especial (descuento aplica) ───────────────────────
    {
      folio:          folios[4],
      clienteId:      'CLI-T002',    // CLI-T002 tiene esEspecial: true
      creadaPor:      'encargado',
      aprobadaPor:    'admin',
      modalidad:      'CREDITO' as const,
      notas:          'Renta de prueba — cliente especial, andamios con madera por 1 semana',
      totalEstimado:  2000,   // 20 andamios × Q100/semana con madera
      estado:         'ACTIVA' as const,
      esPesada:       false,
      fechaDecision:  hace1dia,
      fechaInicioRenta: hace1dia,
      fechaEntrega:   hace1dia,
      fechaFinEstimada: en21dias,
      items: [
        {
          kind:      'granel',
          tipo:      'ANDAMIO_SIMPLE',
          cantidad:  20,
          duracion:  1,
          unidad:    'semana',
          tarifa:    100,
          conMadera: true,
          subtotal:  2000,
        },
      ],
    },
  ];

  // ── Rentas vencidas — expiraron hoy 26/05 a distintas horas ─────────────
  // "Vencida" = ACTIVA con fechaFinEstimada en el pasado
  const hoy = (h: number, m: number) => new Date(`2026-05-26T${String(h).padStart(2,'0')}:${String(m).padStart(2,'0')}:00.000Z`);
  const hace5dias  = new Date('2026-05-21T12:00:00.000Z');
  const hace3diasV = new Date('2026-05-23T12:00:00.000Z');
  const hace4dias  = new Date('2026-05-22T12:00:00.000Z');

  const rentasVencidas = [
    {
      folio: foliosVencidas[0], clienteId: 'CLI-T001',
      notas: 'Vencida — bomba de agua 3" por 5 días',
      totalEstimado: 2000, modalidad: 'CONTADO' as const, esPesada: false,
      fechaDecision: hace5dias, fechaInicioRenta: hace5dias, fechaEntrega: hace5dias,
      fechaFinEstimada: hoy(10, 0),
      items: [{ kind: 'maquinaria', equipoId: bomba6.id, numeracion: '6', descripcion: bomba6.descripcion, duracion: 5, unidad: 'dias', tarifa: 400, subtotal: 2000 }],
    },
    {
      folio: foliosVencidas[1], clienteId: 'CLI-T002',
      notas: 'Vencida — bomba de agua 40 por 5 días',
      totalEstimado: 2000, modalidad: 'CREDITO' as const, esPesada: false,
      fechaDecision: hace5dias, fechaInicioRenta: hace5dias, fechaEntrega: hace5dias,
      fechaFinEstimada: hoy(10, 30),
      items: [{ kind: 'maquinaria', equipoId: bomba40.id, numeracion: '40', descripcion: bomba40.descripcion, duracion: 5, unidad: 'dias', tarifa: 400, subtotal: 2000 }],
    },
    {
      folio: foliosVencidas[2], clienteId: 'CLI-T003',
      notas: 'Vencida — bomba sólidos 2" por 5 días',
      totalEstimado: 1500, modalidad: 'CONTADO' as const, esPesada: false,
      fechaDecision: hace5dias, fechaInicioRenta: hace5dias, fechaEntrega: hace5dias,
      fechaFinEstimada: hoy(11, 0),
      items: [{ kind: 'maquinaria', equipoId: bomba44.id, numeracion: '44', descripcion: bomba44.descripcion, duracion: 5, unidad: 'dias', tarifa: 300, subtotal: 1500 }],
    },
    {
      folio: foliosVencidas[3], clienteId: 'CLI-T004',
      notas: 'Vencida — martillo demoledor 36 por 5 días',
      totalEstimado: 2500, modalidad: 'CONTADO' as const, esPesada: false,
      fechaDecision: hace5dias, fechaInicioRenta: hace5dias, fechaEntrega: hace5dias,
      fechaFinEstimada: hoy(11, 30),
      items: [{ kind: 'maquinaria', equipoId: martillo36.id, numeracion: '36', descripcion: martillo36.descripcion, duracion: 5, unidad: 'dias', tarifa: 500, subtotal: 2500 }],
    },
    {
      folio: foliosVencidas[4], clienteId: 'CLI-T005',
      notas: 'Vencida — martillo demoledor 70 + puntales por 3 días',
      totalEstimado: 3450, modalidad: 'CREDITO' as const, esPesada: false,
      fechaDecision: hace3diasV, fechaInicioRenta: hace3diasV, fechaEntrega: hace3diasV,
      fechaFinEstimada: hoy(12, 0),
      items: [
        { kind: 'maquinaria', equipoId: martillo70.id, numeracion: '70', descripcion: martillo70.descripcion, duracion: 3, unidad: 'dias', tarifa: 500, subtotal: 1500 },
        { kind: 'granel', tipo: 'PUNTAL', cantidad: 65, duracion: 3, unidad: 'dias', tarifa: 1.5, conMadera: false, subtotal: 292.5 },
      ],
    },
    {
      folio: foliosVencidas[5], clienteId: 'CLI-T001',
      notas: 'Vencida — generador 9500W por 1 semana',
      totalEstimado: 1600, modalidad: 'CONTADO' as const, esPesada: false,
      fechaDecision: hace5dias, fechaInicioRenta: hace5dias, fechaEntrega: hace5dias,
      fechaFinEstimada: hoy(12, 30),
      items: [{ kind: 'maquinaria', equipoId: generador71.id, numeracion: '71', descripcion: generador71.descripcion, duracion: 1, unidad: 'semana', tarifa: 1600, subtotal: 1600 }],
    },
    {
      folio: foliosVencidas[6], clienteId: 'CLI-T002',
      notas: 'Vencida — mezcladora 24 por 1 semana',
      totalEstimado: 1600, modalidad: 'CREDITO' as const, esPesada: false,
      fechaDecision: hace5dias, fechaInicioRenta: hace5dias, fechaEntrega: hace5dias,
      fechaFinEstimada: hoy(13, 0),
      items: [{ kind: 'maquinaria', equipoId: mezcladora24.id, numeracion: '24', descripcion: mezcladora24.descripcion, duracion: 1, unidad: 'semana', tarifa: 1600, subtotal: 1600 }],
    },
    {
      folio: foliosVencidas[7], clienteId: 'CLI-T003',
      notas: 'Vencida — mezcladora 25 + andamios por 4 días',
      totalEstimado: 4200, modalidad: 'CONTADO' as const, esPesada: false,
      fechaDecision: hace4dias, fechaInicioRenta: hace4dias, fechaEntrega: hace4dias,
      fechaFinEstimada: hoy(14, 0),
      items: [
        { kind: 'maquinaria', equipoId: mezcladora25.id, numeracion: '25', descripcion: mezcladora25.descripcion, duracion: 4, unidad: 'dias', tarifa: 400, subtotal: 1600 },
        { kind: 'granel', tipo: 'ANDAMIO_SIMPLE', cantidad: 20, duracion: 4, unidad: 'dias', tarifa: 10, conMadera: false, subtotal: 800 },
      ],
    },
    {
      folio: foliosVencidas[8], clienteId: 'CLI-T004',
      notas: 'Vencida — cortadora de concreto por 3 días',
      totalEstimado: 3000, modalidad: 'CONTADO' as const, esPesada: false,
      fechaDecision: hace3diasV, fechaInicioRenta: hace3diasV, fechaEntrega: hace3diasV,
      fechaFinEstimada: hoy(15, 0),
      items: [{ kind: 'maquinaria', equipoId: cortadora11.id, numeracion: '11', descripcion: cortadora11.descripcion, duracion: 3, unidad: 'dias', tarifa: 1000, subtotal: 3000 }],
    },
    {
      folio: foliosVencidas[9], clienteId: 'CLI-T005',
      notas: 'Vencida — vibrador de concreto por 1 semana',
      totalEstimado: 1400, modalidad: 'CREDITO' as const, esPesada: false,
      fechaDecision: hace5dias, fechaInicioRenta: hace5dias, fechaEntrega: hace5dias,
      fechaFinEstimada: hoy(16, 0),
      items: [{ kind: 'maquinaria', equipoId: vibrador39.id, numeracion: '39', descripcion: vibrador39.descripcion, duracion: 1, unidad: 'semana', tarifa: 1400, subtotal: 1400 }],
    },
  ];

  let creadasV = 0;
  for (const r of rentasVencidas) {
    const existe = await prisma.solicitud.findUnique({ where: { folio: r.folio } });
    if (existe) { console.log(`  Omitido: ${r.folio} ya existe`); continue; }
    await prisma.solicitud.create({
      data: {
        folio: r.folio, clienteId: r.clienteId, creadaPor: 'encargado',
        aprobadaPor: 'admin', modalidad: r.modalidad, notas: r.notas,
        totalEstimado: r.totalEstimado, estado: 'ACTIVA', esPesada: r.esPesada,
        fechaDecision: r.fechaDecision, fechaInicioRenta: r.fechaInicioRenta,
        fechaEntrega: r.fechaEntrega, fechaFinEstimada: r.fechaFinEstimada,
        items: r.items,
      },
    });
    creadasV++;
    console.log(`  + ${r.folio} — vence ${r.fechaFinEstimada.toISOString()} — ${r.notas}`);
  }
  console.log(`\n  ${creadasV} rentas vencidas creadas`);

  let creadas = 0;
  for (const r of rentasData) {
    const existe = await prisma.solicitud.findUnique({ where: { folio: r.folio } });
    if (existe) {
      console.log(`  Omitido: renta ${r.folio} ya existe`);
      continue;
    }
    await prisma.solicitud.create({
      data: {
        folio:            r.folio,
        clienteId:        r.clienteId,
        creadaPor:        r.creadaPor,
        aprobadaPor:      r.aprobadaPor,
        modalidad:        r.modalidad,
        notas:            r.notas,
        totalEstimado:    r.totalEstimado,
        estado:           r.estado,
        esPesada:         r.esPesada,
        fechaDecision:    r.fechaDecision,
        fechaInicioRenta: r.fechaInicioRenta,
        fechaEntrega:     r.fechaEntrega,
        fechaFinEstimada: r.fechaFinEstimada,
        items:            r.items,
      },
    });
    creadas++;
    console.log(`  + ${r.folio} — ${r.clienteId} — ${r.notas}`);
  }

  console.log(`\n  ${creadas} rentas creadas (${rentasData.length - creadas} omitidas por ya existir)`);
  console.log('\nDatos de prueba insertados correctamente.');
}

main()
  .catch((e) => {
    console.error('Error en seed-test:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
