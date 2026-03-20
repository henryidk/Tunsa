/**
 * update-inventario.js
 * Elimina todos los equipos y categorías, y los reinserta exactamente
 * según el documento docs/equipos (1).xlsx.
 *
 * Ejecutar desde /backend:  node update-inventario.js
 *
 * NOTA: "PT01" (Carretón doble eje) aparece en el Excel dentro de MAQUINARIA PESADA
 * sin numeración asignada.  Se le asignó PT01 provisionalmente — edítalo si es necesario.
 */

const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

const TIPO_LIVIANA = 'tipo_liviana';
const TIPO_PESADA  = 'tipo_pesada';
const TIPO_USO     = 'tipo_uso';

// ─── Categorías (SOLO Maquinaria Liviana tiene categorías por ahora) ──────────
// Nombre exacto del Excel → rates del encabezado de categoría
const CATEGORIAS_LIVIANA = [
  { nombre: 'Bailarinas',                            rentaDia: 400,  rentaSemana: 1600,  rentaMes: 4800  },
  { nombre: 'Bombas de agua de 2" y 3"',             rentaDia: 400,  rentaSemana: 1600,  rentaMes: 4800  },
  { nombre: 'Bombas para sólidos y semisólidos (2")',rentaDia: 300,  rentaSemana: 1200,  rentaMes: 3600  },
  { nombre: 'Bombas para sólidos (3")',              rentaDia: 400,  rentaSemana: 1600,  rentaMes: 4800  },
  { nombre: 'Cortadoras de concreto',                rentaDia: 1000, rentaSemana: 4000,  rentaMes: 12000 },
  { nombre: 'Generadores eléctricos',                rentaDia: 400,  rentaSemana: 1600,  rentaMes: 4800  },
  { nombre: 'Generadores soldadores',                rentaDia: 650,  rentaSemana: 2600,  rentaMes: 7800  },
  { nombre: 'Martillo demoledor',                    rentaDia: 500,  rentaSemana: 2000,  rentaMes: 6000  },
  { nombre: 'Medidores de presión',                  rentaDia: 200,  rentaSemana: 800,   rentaMes: 2400  },
  { nombre: 'Mezcladoras',                           rentaDia: 400,  rentaSemana: 1600,  rentaMes: 4800  },
  { nombre: 'Planchas alisadoras de concreto',       rentaDia: 100,  rentaSemana: 400,   rentaMes: 1200  },
  { nombre: 'Plato vibratorio',                      rentaDia: 300,  rentaSemana: 1200,  rentaMes: 3600  },
  { nombre: 'Rastrillos',                            rentaDia: 100,  rentaSemana: 400,   rentaMes: 1200  },
  { nombre: 'Compresor',                             rentaDia: 1500, rentaSemana: 6000,  rentaMes: 18000 },
  { nombre: 'Barreno industrial',                    rentaDia: 300,  rentaSemana: 1200,  rentaMes: 3600  },
  { nombre: 'Rodos no tripulados',                   rentaDia: 600,  rentaSemana: 2400,  rentaMes: 7200  },
  { nombre: 'Vibrador de concreto',                  rentaDia: 350,  rentaSemana: 1400,  rentaMes: 4200  },
  { nombre: 'Montacarga manual',                     rentaDia: 150,  rentaSemana: 600,   rentaMes: 1800  },
  { nombre: 'Helicóptero',                           rentaDia: 500,  rentaSemana: 2000,  rentaMes: 6000  },
];

// Helper para construir un equipo LIVIANA
function lv(numeracion, descripcion, serie, fechaCompra, montoCompra, catNombre, { isActive = true, motivoBaja = null, fechaBaja = null } = {}) {
  return { numeracion, descripcion, serie, fechaCompra: new Date(fechaCompra), montoCompra, tipoId: TIPO_LIVIANA, catNombre, isActive, motivoBaja, fechaBaja: fechaBaja ? new Date(fechaBaja) : null };
}

// Helper para PESADA (sin categoría, sin precios de renta por ahora)
function pe(numeracion, descripcion, serie, fechaCompra, montoCompra, { isActive = true, motivoBaja = null, fechaBaja = null } = {}) {
  return { numeracion, descripcion, serie, fechaCompra: new Date(fechaCompra), montoCompra, tipoId: TIPO_PESADA, catNombre: null, isActive, motivoBaja, fechaBaja: fechaBaja ? new Date(fechaBaja) : null };
}

// Helper para USO_PROPIO (sin categoría, sin precios de renta)
function up(numeracion, descripcion, serie, fechaCompra, montoCompra) {
  return { numeracion, descripcion, serie, fechaCompra: new Date(fechaCompra), montoCompra, tipoId: TIPO_USO, catNombre: null, isActive: true, motivoBaja: null, fechaBaja: null };
}

// ─── Datos del inventario ──────────────────────────────────────────────────────
const equiposData = [

  // ══════════════════════════════════════════════════════════════════════════════
  // MAQUINARIA LIVIANA
  // ══════════════════════════════════════════════════════════════════════════════

  // ── BAILARINAS ────────────────────────────────────────────────────────────────
  lv('2',   'Bailarina Hoopt con motor subaru 4.0 EH12',      'RAM 70B 120306115 / J0114213TH122',           '2022-01-28', 12000,     'Bailarinas'),
  lv('3',   'Bailarina Hoopt con motor honda GX 100',         'RAM 70C 18-0803286 / EH122D-J0117171 MARCA SUBARU', '2022-01-28', 10000, 'Bailarinas'),
  lv('100', 'Bailarina WOLKAN con motor honda',               'mod. SW550 662964 serie No. GCCDT2103360',    '2022-01-28', 12500,     'Bailarinas'),
  lv('101', 'Bailarina WOLKAN con motor honda',               'mod. SW600 006625 serie No. GCCDT2104107',    '2022-01-28', 12500,     'Bailarinas'),
  lv('102', 'Bailarina WOLKAN con motor honda',               'mod. SW600 006831 serie No. GCCDT2104073',    '2022-01-28', 12500,     'Bailarinas'),
  lv('108', 'Bailarina HOPPT con motor honda',                'serie No. 181031441-1113078',                 '2022-07-18', 17280,     'Bailarinas'),
  lv('109', 'Bailarina Weber con motor honda',                'serie No. GCCDT-2159036',                     '2022-07-18', 21800,     'Bailarinas'),
  lv('113', 'Bailarina HUSQVARNA con motor honda GXR120',     'serie No. 20213400041',                       '2022-12-02', 21046.30,  'Bailarinas'),
  lv('114', 'Bailarina HUSQVARNA con motor honda GXR120',     'serie No. 20214101660',                       '2022-12-02', 21046.30,  'Bailarinas'),
  lv('115', 'Bailarina HUSQVARNA con motor honda GXR120',     'serie No. 20214101726',                       '2022-12-02', 21046.30,  'Bailarinas'),
  lv('116', 'Bailarín WEBER con motor honda GXR120',          'serie No. 20076183',                          '2022-12-09', 24400,     'Bailarinas'),

  // ── BOMBAS DE AGUA DE 2" Y 3" ─────────────────────────────────────────────────
  lv('6',   'Bomba de agua de 3" marca honda y motor GX-160', 'mod. JH1G8F & serie: GCAAH-3281883',         '2022-01-28', 2000,      'Bombas de agua de 2" y 3"'),
  lv('40',  'Bomba de agua de 3" marca honda y motor GX-160', 'mod. JH168F & serie GCAAH3281663',           '2022-01-28', 2000,      'Bombas de agua de 2" y 3"'),
  lv('41',  'Bomba de agua de 3" marca honda y motor GX-160', 'mod. JH168F & serie GCAAH12103275',          '2022-01-28', 2000,      'Bombas de agua de 2" y 3"'),
  lv('61',  'Bomba de agua de 3", Yamaha MZ 175',             'Q9CE-1012689',                               '2022-01-28', 300,       'Bombas de agua de 2" y 3"'),
  lv('111', 'Bomba de agua de 2", marca EVANS',               null,                                          '2022-10-01', 4759.20,   'Bombas de agua de 2" y 3"'),

  // ── BOMBAS PARA SÓLIDOS Y SEMISÓLIDOS (2") ────────────────────────────────────
  lv('44',  'Bomba p/sólidos de 2" TSURUMI PUMP & manguera de 17 ml', '1918238813',                        '2022-01-28', 1500,      'Bombas para sólidos y semisólidos (2")'),
  lv('96',  'Bomba p/sólidos de 2" TSURUMI PUMP & manguera de 25 ml', 'HS2.4S & serie 20649169509',        '2022-01-28', 2500,      'Bombas para sólidos y semisólidos (2")'),
  lv('127', 'Bomba de agua para Semi-Sólidos de 2" EVANS',    null,                                          '2024-08-16', 4631.70,   'Bombas para sólidos y semisólidos (2")'),
  lv('129', 'Bomba de Sólidos Evans',                          'serie No. 221202729',                        '2025-02-21', 4822.20,   'Bombas para sólidos y semisólidos (2")'),
  lv('140', 'Bomba de sólidos 2" x 2" EVANS AC2MG0750TH',     '221202317',                                  '2026-01-30', 0,         'Bombas para sólidos y semisólidos (2")'),
  lv('141', 'Bomba de sólidos 2" x 2" EVANS AC2MG0750TH',     '2212202610',                                 '2026-01-30', 0,         'Bombas para sólidos y semisólidos (2")'),
  lv('142', 'Bomba de sólidos sumergible HS2.4 S61 1/2 Tsurumi', 'Serie: 25T01827004',                      '2026-02-04', 0,         'Bombas para sólidos y semisólidos (2")'),
  lv('143', 'Bomba de sólidos sumergible HS2.4 S61 1/2 Tsurumi', 'Serie: 25T01827011',                      '2026-02-04', 0,         'Bombas para sólidos y semisólidos (2")'),

  // ── BOMBAS PARA SÓLIDOS (3") ──────────────────────────────────────────────────
  lv('95',  'Bomba p/sólidos de 3" TSURUMI PUMP & manguera de 25 ml', 'NK4-22 & serie 19646217001',        '2022-01-28', 6500,      'Bombas para sólidos (3")'),
  lv('148', 'Bomba de sólidos sumergible 3HP de 3"',           'Serie: 25T02162001',                         '2026-02-18', 0,         'Bombas para sólidos (3")'),

  // ── CORTADORAS DE CONCRETO ────────────────────────────────────────────────────
  lv('11',  'Cortadora de concreto Hoopt con motor honda GX-390', 'GCAFH-1010404',                          '2022-01-28', 12000,     'Cortadoras de concreto'),
  lv('56',  'Cortadora de concreto Hoopt con motor honda GX-390', 'mod. CGVCT1497164',                      '2022-01-28', 12000,     'Cortadoras de concreto'),
  lv('128', 'Cortadora de concreto Hoopt con motor honda GX-390', null,                                      '2024-11-29', 12087,     'Cortadoras de concreto'),

  // ── GENERADORES ELÉCTRICOS ────────────────────────────────────────────────────
  lv('14',  'Generador marca Freedom de 2500 WT',              'T53K00180-80104234',                         '2022-01-28', 1000,      'Generadores eléctricos'),
  lv('71',  'Generador EVANS 9500 watts',                      'mod. MGT4106AE & serie 1812901046',           '2022-01-28', 6000,      'Generadores eléctricos'),
  lv('74',  'Generador EVANS 4000 watts',                      'mod. MGT225G & serie 181203994',              '2022-01-28', 2000,      'Generadores eléctricos'),
  lv('76',  'Generador EVANS 5500 watts',                      'mod. MGT3400 & serie No. 181204215',          '2022-01-28', 3000,      'Generadores eléctricos'),
  lv('81',  'Generador powermate 3000 watts',                  'mod. R210E / serie No. M020000121',           '2022-01-28', 500,       'Generadores eléctricos'),
  lv('130', 'Generador 3500W RGv3500 Robin',                   'serie: 22323V030150',                         '2025-02-21', 3928.50,   'Generadores eléctricos'),
  lv('132', 'Generador Eléctrico Freedom',                     'serie: 1036206346',                           '2025-02-28', 9300,      'Generadores eléctricos'),
  lv('139', 'Generador FR6500 Freedom',                        'T61G0024080150018',                           '2026-01-30', 0,         'Generadores eléctricos'),
  lv('144', 'Generador Portátil 5.5 Kw Trupper',              'Serie: 2510114A0029',                         '2026-02-13', 0,         'Generadores eléctricos'),
  lv('145', 'Generador Portátil 8 Kw Trupper',                'Serie: 2511034A0128',                         '2026-02-13', 0,         'Generadores eléctricos'),
  lv('146', 'Generador Portátil 5.5 Kw Trupper',              'Serie: 2510114A0133',                         '2026-02-16', 0,         'Generadores eléctricos'),
  lv('147', 'Generador Portátil 8Kw Trupper',                 'Serie: 2511034A0129',                         '2026-02-16', 0,         'Generadores eléctricos'),
  lv('149', 'Generador Portátil 8Kw Trupper',                 'Serie: ZS190FE/P-F 2511034A0140',             '2026-02-21', 0,         'Generadores eléctricos'),
  lv('150', 'Generador Portátil 5.5 Kw Motor',                'Serie: ZS188F-2 2510114A0179',                '2026-02-21', 0,         'Generadores eléctricos'),
  lv('151', 'Generador Hyundai Portátil GAS 3.0KW',           'Serie: HYH2500214',                           '2026-02-23', 0,         'Generadores eléctricos'),

  // ── GENERADORES SOLDADORES ────────────────────────────────────────────────────
  lv('13',  'Generador Soldador marca Freedom WG 6500',        'T61E120922180',                               '2022-01-28', 2500,      'Generadores soldadores'),
  lv('20',  'Generador Soldador marca Freedom WG 6500',        '188FT61E14120067574',                         '2022-01-28', 2500,      'Generadores soldadores'),
  lv('35',  'Generador soldador Welder GX390',                 'mod. EDT5 & serie GCAA4180529',               '2022-01-28', 10000,     'Generadores soldadores'),
  lv('75',  'Generador soldador Evans',                        'mod. MGT460GAE & serie 181201130',             '2022-01-28', 7000,      'Generadores soldadores'),
  lv('117', 'Generador Soldador marca EVANS con motor Thunder 18HP', 'serie No. 210408694 & No. W240MG1800THAE', '2022-12-09', 22928.50, 'Generadores soldadores'),

  // ── MARTILLO DEMOLEDOR ────────────────────────────────────────────────────────
  lv('22',  'Martillo demoledor DEWALT de 30 kg',             'mod. 2017-35-11 / 17352668',                  '2022-01-28', 7000,      'Martillo demoledor'),
  lv('36',  'Martillo demoledor DEWALT de 30 kg',             'mod. 2017-35-11 / 19115467',                  '2022-01-28', 7000,      'Martillo demoledor'),
  lv('70',  'Martillo demoledor DEWALT de 30 kg',             'mod. 2017-35-11 / 13350660',                  '2022-01-28', 7000,      'Martillo demoledor'),
  lv('79',  'Martillo demoledor DEWALT de 30 kg',             'mod. 2017-35-11 / 17352736',                  '2022-01-28', 7000,      'Martillo demoledor'),
  lv('106', 'Martillo demoledor DEWALT de 30 kg',             'serie No. 2021-36-11006458',                  '2022-04-23', 15724.80,  'Martillo demoledor'),
  lv('107', 'Martillo demoledor DEWALT de 30 kg',             'serie No. 2021-36-11006459',                  '2022-04-23', 15724.80,  'Martillo demoledor'),
  lv('136', 'Martillo Demoledor Truper 30kg 2000W',           null,                                           '2025-08-27', 6780,      'Martillo demoledor'),

  // ── MEDIDORES DE PRESIÓN ──────────────────────────────────────────────────────
  lv('58',  'Medidor de presión SUPER EGO',                   'mod. RP50-S / serie 12073735',                '2022-01-28', 2500,      'Medidores de presión'),
  lv('135', 'Medidor de presión PRÜFPUMPE',                   null,                                           '2025-08-05', 840,       'Medidores de presión'),

  // ── MEZCLADORAS ───────────────────────────────────────────────────────────────
  lv('24',  'Mezcladora Rockman de 1.5 sacos',                'mod. GX270 / 0303481',                        '2022-01-28', 8000,      'Mezcladoras'),
  lv('25',  'Mezcladora Rockman de 1.5 sacos',                'mod. GX270 / 0336327',                        '2022-01-28', 8000,      'Mezcladoras'),
  lv('26',  'Mezcladora Rockman de 1.5 sacos',                'mod. GX270 / 0157811',                        '2022-01-28', 8000,      'Mezcladoras'),
  lv('34',  'Mezcladora Sirl GX160',                          'mod. JH1G8F & serie: GCAAH-5549003',          '2022-01-28', 8000,      'Mezcladoras'),
  lv('77',  'Mezcladora Sirl GX160',                          'mod. JH168F & serie GCAAH-5296849',           '2022-01-28', 8000,      'Mezcladoras'),
  lv('78',  'Mezcladora Sirl GX160',                          'mod. JH168F & serie GCAAH-5549001',           '2022-01-28', 8000,      'Mezcladoras'),

  // ── PLANCHAS ALISADORAS DE CONCRETO ───────────────────────────────────────────
  lv('55',  'Plancha alizadora de concreto',                   null,                                           '2022-01-28', 100,       'Planchas alisadoras de concreto'),
  lv('72',  'Plancha alizadora de concreto',                   null,                                           '2022-01-28', 100,       'Planchas alisadoras de concreto'),

  // ── PLATO VIBRATORIO ──────────────────────────────────────────────────────────
  lv('125', 'Plato vibratorio HOPPT',                          'serie No. 231220409',                         '2023-05-10', 12963.60,  'Plato vibratorio'),
  // Dado de baja (robado)
  lv('98',  'Plato vibratorio WOLKAN mod. PV1500',             'serie 209546',                                 '2022-01-28', 10000,     'Plato vibratorio', { isActive: false, motivoBaja: 'Dado de baja tras ser robado' }),

  // ── RASTRILLOS ────────────────────────────────────────────────────────────────
  lv('63',  'Rastrío para concreto',                           null,                                           '2022-01-28', 100,       'Rastrillos'),
  lv('73',  'Rastrío para concreto',                           null,                                           '2022-01-28', 100,       'Rastrillos'),
  lv('120', 'Rastrío para concreto',                           null,                                           '2024-01-29', 3073.50,   'Rastrillos'),
  lv('121', 'Rastrío para concreto',                           null,                                           '2024-01-29', 3073.50,   'Rastrillos'),

  // ── COMPRESOR ─────────────────────────────────────────────────────────────────
  lv('123', 'Compresor Euler 185CFM TWT185D-7',               'serie: TWT001127-BNV4316',                    '2024-01-31', 157084.20, 'Compresor'),

  // ── BARRENO INDUSTRIAL ────────────────────────────────────────────────────────
  lv('60',  'Barreno industrial DeWalt de 3/4", 1.19/16"',    'BR2 D2550',                                   '2022-01-28', 4000,      'Barreno industrial'),

  // ── RODOS NO TRIPULADOS ───────────────────────────────────────────────────────
  lv('124', 'Rodo Compactador Hoppt c/m honda 13HP',           'serie: 2312061024-1128831',                   '2024-03-06', 82755.90,  'Rodos no tripulados'),
  lv('126', 'Rodo compactador Hyundai',                        null,                                           '2024-06-29', 50934.96,  'Rodos no tripulados'),
  lv('134', 'Rodo No Tripulado ROL650PH Hoppt c/m Honda 13HP', 'serie: 2312061023-112826',                   '2025-07-09', 82755.90,  'Rodos no tripulados'),
  lv('137', 'Rodo No Tripulado ROL650PH Hoppt c/m Honda 13HP', 'serie: 2503221176-1357700',                  '2025-09-25', 82755.90,  'Rodos no tripulados'),
  lv('152', 'Rodo No Tripulado ROL650PH Hoppt c/m Honda 13HP', 'Serie: 2509251300 - 2398124',                '2026-02-23', 0,         'Rodos no tripulados'),
  // Dado de baja (vendido a Otto Perez)
  lv('131', 'Rodo No Tripulado ROL650PH Hoppt c/m Honda 13HP', 'serie: 2312061025-1165179',                  '2025-02-21', 87261.47,  'Rodos no tripulados', { isActive: false, motivoBaja: 'Vendido a Otto Perez', fechaBaja: '2025-05-15' }),

  // ── VIBRADOR DE CONCRETO ──────────────────────────────────────────────────────
  lv('39',  'Vibrador de concreto GUASUECA con motor honda GX160', 'GCAAH5305643',                           '2022-01-28', 1500,      'Vibrador de concreto'),
  lv('42',  'Vibrador de concreto Weber MT con motor honda GX160',  'GCABT4536120',                          '2022-01-28', 2500,      'Vibrador de concreto'),
  lv('52',  'Vibrador de concreto Weber MT con motor honda GX160',  'GCABT-4342965',                         '2022-01-28', 2500,      'Vibrador de concreto'),
  lv('53',  'Vibrador de concreto Weber MT con motor honda GX160',  'GCABT-4589499',                         '2022-01-28', 2500,      'Vibrador de concreto'),
  lv('54',  'Vibrador de concreto GUASUECA con motor honda GX160', 'JH1G8F-5305649',                         '2022-01-28', 1500,      'Vibrador de concreto'),

  // ── MONTACARGA MANUAL ─────────────────────────────────────────────────────────
  lv('119', 'Montacarga manual marca INGCO',                   null,                                           '2024-01-27', 3800,      'Montacarga manual'),

  // ── HELICÓPTERO ───────────────────────────────────────────────────────────────
  lv('122', 'Helicóptero TOL100GB HOPPT con motor HONDA 5.5HP', 'serie: 18B051159-1027681',                  '2024-01-30', 14137.20,  'Helicóptero'),
  lv('138', 'Helicóptero TOL100GB HOPPT c/m HONDA 5.5HP',      'serie: 24081024-2359840',                   '2025-10-29', 0,         'Helicóptero'),

  // ══════════════════════════════════════════════════════════════════════════════
  // MAQUINARIA PESADA  (sin categorías, sin precios de renta)
  // ══════════════════════════════════════════════════════════════════════════════
  pe('MP01', 'Retroexcavadora CASE 580N',           'serie: JJGN58NRCLC771510 & motor: 1728119',              '2020-12-04', 500000),
  pe('MP02', 'Rodo compactador CASE DV36',           'serie: NHNTV0108 & motor: W7885',                       '2022-02-24', 250000),
  pe('MP04', 'Montacarga',                           null,                                                     '2023-10-04', 327600),
  // PT01: aparece en Excel dentro de PESADA sin numeración asignada — se asignó PT01 provisionalmente
  pe('PT01', 'Carretón doble eje para 10,000 lbs',  'Chasis No. E350011231863-64',                            '2023-11-28', 55000),
  pe('MP05', 'Minicargador CASE SR250B',             'MODELO: SR250B SERIE: JAFSR250VPM446786 & MOTOR: 1025722', '2024-07-04', 472420),
  pe('MP06', 'Minicargador CASE SR220B',             'MODELO: SR220B SERIE: JAFSR220CPM450582 MOTOR: 1035944', '2025-03-25', 429112.20),
  pe('MP07', 'Retroexcavadora Case 580N',            'serie: JJGN58NRJRC787598 No. de Motor: 2194620',        '2025-08-08', 890000),
  // Dado de baja (vendido a Otto Perez) — MP03
  pe('MP03', 'Minicargador CASE SR220B',             'serie: JAFSR220LMM407232 & motor: 614722',              '2022-03-24', 325000, { isActive: false, motivoBaja: 'Vendido a Otto Perez' }),

  // ══════════════════════════════════════════════════════════════════════════════
  // EQUIPO PARA USO PROPIO  (sin categorías, sin precios de renta)
  // ══════════════════════════════════════════════════════════════════════════════
  up('28',  'Motosierra Sthil MS361',               null,                                  '2022-01-28', 1500),
  up('30',  'Motosierra Sthil MS780',               null,                                  '2022-01-28', 4000),
  up('99',  'Hidrolavadora HIDROCAMPO',             'mod. HPWQP750 serie No. DH225090549420', '2022-01-28', 1500),
  up('104', 'Chapeadora trupper DES-63',            null,                                  '2022-01-28', 2000),
  up('105', 'Sopladora marca Truper',               null,                                  '2022-03-05', 1800),
  up('118', 'Compresor de aire lubricado de 50 lbs', null,                                 '2023-01-10', 1560),
  up('133', 'Regla vibratoria',                     'serie: 22102064-7002930',             '2025-05-22', 8596.80),
];

// ─── Main ──────────────────────────────────────────────────────────────────────
async function main() {
  console.log('─'.repeat(60));
  console.log('Iniciando actualización de inventario...');
  console.log('─'.repeat(60));

  // 1. Eliminar todos los equipos (FK hacia categorias, debe ir primero)
  const deletedEquipos = await prisma.equipo.deleteMany({});
  console.log(`✓ ${deletedEquipos.count} equipos eliminados`);

  // 2. Eliminar todas las categorías
  const deletedCats = await prisma.categoria.deleteMany({});
  console.log(`✓ ${deletedCats.count} categorías eliminadas`);

  // 3. Crear categorías de LIVIANA
  console.log('\nCreando categorías de Maquinaria Liviana...');
  const catMap = {}; // nombre → { id, rentaDia, rentaSemana, rentaMes }

  for (const catDef of CATEGORIAS_LIVIANA) {
    const cat = await prisma.categoria.create({
      data: { nombre: catDef.nombre, tipoId: TIPO_LIVIANA },
    });
    catMap[catDef.nombre] = {
      id:          cat.id,
      rentaDia:    catDef.rentaDia,
      rentaSemana: catDef.rentaSemana,
      rentaMes:    catDef.rentaMes,
    };
    console.log(`  + ${catDef.nombre}  (${cat.id})`);
  }

  // 4. Insertar equipos
  console.log(`\nInsertando ${equiposData.length} equipos...`);
  let insertados = 0;
  let errores = 0;

  for (const eq of equiposData) {
    const { catNombre, ...rest } = eq;

    let categoriaId  = null;
    let rentaDia     = null;
    let rentaSemana  = null;
    let rentaMes     = null;

    if (catNombre) {
      const cat = catMap[catNombre];
      if (!cat) {
        console.error(`  ✗ Categoría no encontrada: "${catNombre}" (equipo ${rest.numeracion})`);
        errores++;
        continue;
      }
      categoriaId = cat.id;
      rentaDia    = cat.rentaDia;
      rentaSemana = cat.rentaSemana;
      rentaMes    = cat.rentaMes;
    }

    try {
      await prisma.equipo.create({
        data: {
          ...rest,
          categoriaId,
          rentaDia,
          rentaSemana,
          rentaMes,
        },
      });
      insertados++;
    } catch (err) {
      console.error(`  ✗ Error al insertar equipo #${rest.numeracion}: ${err.message}`);
      errores++;
    }
  }

  // 5. Resumen
  console.log('\n' + '─'.repeat(60));
  console.log('Resumen:');
  const totalLiviana  = await prisma.equipo.count({ where: { tipoId: TIPO_LIVIANA, isActive: true } });
  const totalPesada   = await prisma.equipo.count({ where: { tipoId: TIPO_PESADA,  isActive: true } });
  const totalUso      = await prisma.equipo.count({ where: { tipoId: TIPO_USO,     isActive: true } });
  const totalBaja     = await prisma.equipo.count({ where: { isActive: false } });
  const totalCats     = await prisma.categoria.count();

  console.log(`  Equipos insertados : ${insertados}  (errores: ${errores})`);
  console.log(`  Maq. Liviana activos : ${totalLiviana}`);
  console.log(`  Maq. Pesada activos  : ${totalPesada}`);
  console.log(`  Uso Propio activos   : ${totalUso}`);
  console.log(`  Dados de baja        : ${totalBaja}`);
  console.log(`  Categorías           : ${totalCats}`);
  console.log('─'.repeat(60));

  if (errores > 0) {
    console.warn(`\n⚠  Hubo ${errores} error(es). Revisa los mensajes anteriores.`);
    process.exit(1);
  } else {
    console.log('\n✓ Inventario actualizado correctamente.');
  }
}

main()
  .catch(err => { console.error(err); process.exit(1); })
  .finally(() => prisma.$disconnect());
