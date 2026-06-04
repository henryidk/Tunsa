import { PrismaClient } from '@prisma/client';
import * as bcrypt from 'bcrypt';

const prisma = new PrismaClient();

async function main() {
  const yaEjecutado = await prisma.user.findFirst({ where: { username: 'admin' } });
  if (yaEjecutado) {
    console.log('Seed ya ejecutado anteriormente, omitiendo...');
    return;
  }

  console.log('Iniciando seed del sistema de autenticacion...\n');

  // 1. Crear Roles
  console.log('Creando roles...');
  
  const adminRole = await prisma.role.upsert({
    where: { nombre: 'admin' },
    update: {},
    create: {
      nombre: 'admin',
      descripcion: 'Administrador del sistema - Acceso total',
    },
  });

  await prisma.role.upsert({
    where: { nombre: 'secretaria' },
    update: {},
    create: {
      nombre: 'secretaria',
      descripcion: 'Secretaria - Aprueba solicitudes',
    },
  });

  await prisma.role.upsert({
    where: { nombre: 'encargado_maquinas' },
    update: {},
    create: {
      nombre: 'encargado_maquinas',
      descripcion: 'Encargado de Maquinas - Gestiona rentas',
    },
  });

  console.log('Roles creados\n');

  // 2. Crear usuarios de ejemplo
  console.log('Creando usuarios...');

  // Usuario Admin
  const rawPassword = process.env.ADMIN_SEED_PASSWORD;
  if (!rawPassword) throw new Error('ADMIN_SEED_PASSWORD no está definida en el entorno');
  const adminPassword = await bcrypt.hash(rawPassword, 12);
  await prisma.usuario.upsert({
    where: { username: 'admin' },
    update: {},
    create: {
      username: 'admin',
      password: adminPassword,
      nombre: 'Administrador Sistema',
      telefono: '55551234',
      roleId: adminRole.id,
    },
  });
  console.log('  - Admin creado');

  console.log('\nUsuario creado\n');

  // 3. Mostrar credenciales
  console.log('===========================================');
  console.log('CREDENCIALES DE ACCESO:');
  console.log('===========================================\n');
  
  console.log('ADMINISTRADOR:');
  console.log('   Usuario:    admin');
  console.log('   Contrasena: (ver ADMIN_SEED_PASSWORD en .env)\n');

  console.log('===========================================');

  // 4. Tipos de equipo, categorías y equipos
  // Los tres pasos van juntos porque categorías dependen de tipos, y equipos de ambos.
  console.log('\nCreando tipos, categorías y equipos...');

  interface EquipoSeed {
    numeracion:        string;
    descripcion:       string;
    categoria:         string | null;
    serie:             string | null;
    fechaCompra:       Date;
    montoCompra:       number | null;
    tipo:              string;
    rentaHora?:        number | null;
    rentaDia:          number | null;
    rentaSemana:       number | null;
    rentaMes:          number | null;
    isActive?:         boolean;
    motivoBaja?:       string | null;
    fechaBaja?:        Date | null;
  }

  const equiposData: EquipoSeed[] = [

    // ══════════════════════════════════════════
    //  MAQUINARIA LIVIANA
    // ══════════════════════════════════════════

    // ─── Bailarina  (Q400/día · Q1600/semana · Q4800/mes) ───
    { numeracion: '2',   descripcion: 'Bailarina Hoopt con motor subaru 4.0 EH12',   categoria: 'Bailarina', serie: 'RAM 70B 120306115 / J0114213TH122',              fechaCompra: new Date('2022-01-28'), montoCompra: 12000.00, tipo: 'LIVIANA', rentaDia: 400, rentaSemana: 1600, rentaMes: 4800 },
    { numeracion: '3',   descripcion: 'Bailarina Hoopt con motor honda GX 100',      categoria: 'Bailarina', serie: 'RAM 70C 18-0803286 / EH122D-J0117171 MARCA SUBARU', fechaCompra: new Date('2022-01-28'), montoCompra: 10000.00, tipo: 'LIVIANA', rentaDia: 400, rentaSemana: 1600, rentaMes: 4800 },
    { numeracion: '100', descripcion: 'Bailarina WOLKAN con motor honda',             categoria: 'Bailarina', serie: 'mod. SW550 662964 serie No. GCCDT2103360',        fechaCompra: new Date('2022-01-28'), montoCompra: 12500.00, tipo: 'LIVIANA', rentaDia: 400, rentaSemana: 1600, rentaMes: 4800 },
    { numeracion: '101', descripcion: 'Bailarina WOLKAN con motor honda',             categoria: 'Bailarina', serie: 'mod. SW600 006625 serie No. GCCDT2104107',        fechaCompra: new Date('2022-01-28'), montoCompra: 12500.00, tipo: 'LIVIANA', rentaDia: 400, rentaSemana: 1600, rentaMes: 4800 },
    { numeracion: '102', descripcion: 'Bailarina WOLKAN con motor honda',             categoria: 'Bailarina', serie: 'mod. SW600 006831 serie No. GCCDT2104073',        fechaCompra: new Date('2022-01-28'), montoCompra: 12500.00, tipo: 'LIVIANA', rentaDia: 400, rentaSemana: 1600, rentaMes: 4800 },
    { numeracion: '108', descripcion: 'Bailarina HOPPT con motor honda',              categoria: 'Bailarina', serie: 'serie No. 181031441-1113078',                     fechaCompra: new Date('2022-07-18'), montoCompra: 17280.00, tipo: 'LIVIANA', rentaDia: 400, rentaSemana: 1600, rentaMes: 4800 },
    { numeracion: '109', descripcion: 'Bailarina Weber con motor honda',              categoria: 'Bailarina', serie: 'serie No. GCCDT-2159036',                         fechaCompra: new Date('2022-07-18'), montoCompra: 21800.00, tipo: 'LIVIANA', rentaDia: 400, rentaSemana: 1600, rentaMes: 4800 },
    { numeracion: '113', descripcion: 'Bailarina HUSQVARNA con motor honda GXR120',  categoria: 'Bailarina', serie: 'serie No. 20213400041',                           fechaCompra: new Date('2022-12-02'), montoCompra: 21046.30, tipo: 'LIVIANA', rentaDia: 400, rentaSemana: 1600, rentaMes: 4800 },
    { numeracion: '114', descripcion: 'Bailarina HUSQVARNA con motor honda GXR120',  categoria: 'Bailarina', serie: 'serie No. 20214101660',                           fechaCompra: new Date('2022-12-02'), montoCompra: 21046.30, tipo: 'LIVIANA', rentaDia: 400, rentaSemana: 1600, rentaMes: 4800 },
    { numeracion: '115', descripcion: 'Bailarina HUSQVARNA con motor honda GXR120',  categoria: 'Bailarina', serie: 'serie No. 20214101726',                           fechaCompra: new Date('2022-12-02'), montoCompra: 21046.30, tipo: 'LIVIANA', rentaDia: 400, rentaSemana: 1600, rentaMes: 4800 },
    { numeracion: '116', descripcion: 'Bailarín WEBER con motor honda GXR120',       categoria: 'Bailarina', serie: 'serie No. 20076183',                              fechaCompra: new Date('2022-12-09'), montoCompra: 24400.00, tipo: 'LIVIANA', rentaDia: 400, rentaSemana: 1600, rentaMes: 4800 },

    // ─── Bomba de agua  (Q400/día · Q1600/semana · Q4800/mes) ───
    { numeracion: '6',   descripcion: 'Bomba de agua de 3" marca honda y motor GX-160', categoria: 'Bomba de agua', serie: 'mod. JH1G8F & serie: GCAAH-3281883', fechaCompra: new Date('2022-01-28'), montoCompra: 2000.00, tipo: 'LIVIANA', rentaDia: 400, rentaSemana: 1600, rentaMes: 4800 },
    { numeracion: '40',  descripcion: 'Bomba de agua de 3" marca honda y motor GX-160', categoria: 'Bomba de agua', serie: 'mod. JH168F & serie GCAAH3281663',    fechaCompra: new Date('2022-01-28'), montoCompra: 2000.00, tipo: 'LIVIANA', rentaDia: 400, rentaSemana: 1600, rentaMes: 4800 },
    { numeracion: '41',  descripcion: 'Bomba de agua de 3" marca honda y motor GX-160', categoria: 'Bomba de agua', serie: 'mod. JH168F & serie GCAAH12103275',   fechaCompra: new Date('2022-01-28'), montoCompra: 2000.00, tipo: 'LIVIANA', rentaDia: 400, rentaSemana: 1600, rentaMes: 4800 },
    { numeracion: '61',  descripcion: 'Bomba de agua de 3", Yamaha MZ 175',             categoria: 'Bomba de agua', serie: 'Q9CE-1012689',                        fechaCompra: new Date('2022-01-28'), montoCompra:  300.00, tipo: 'LIVIANA', rentaDia: 400, rentaSemana: 1600, rentaMes: 4800 },
    { numeracion: '111', descripcion: 'Bomba de agua de 2", marca EVANS',               categoria: 'Bomba de agua', serie: null,                                   fechaCompra: new Date('2022-10-01'), montoCompra: 4759.20, tipo: 'LIVIANA', rentaDia: 400, rentaSemana: 1600, rentaMes: 4800 },

    // ─── Bomba p/sólidos 2"  (Q300/día · Q1200/semana · Q3600/mes) ───
    { numeracion: '44',  descripcion: 'Bomba p/solidos de 2" TSURUMI PUMP & maguera de 17 ml', categoria: 'Bomba sólidos 2"', serie: '1918238813',               fechaCompra: new Date('2022-01-28'), montoCompra: 1500.00, tipo: 'LIVIANA', rentaDia: 300, rentaSemana: 1200, rentaMes: 3600 },
    { numeracion: '96',  descripcion: 'Bomba p/solidos de 2" TSURUMI PUMP & maguera de 25 ml', categoria: 'Bomba sólidos 2"', serie: 'HS2.4S & serie 20649169509', fechaCompra: new Date('2022-01-28'), montoCompra: 2500.00, tipo: 'LIVIANA', rentaDia: 300, rentaSemana: 1200, rentaMes: 3600 },
    { numeracion: '127', descripcion: 'Bomba de agua para Semi-Sólidos de 2" EVANS',           categoria: 'Bomba sólidos 2"', serie: null,                         fechaCompra: new Date('2024-08-16'), montoCompra: 4631.70, tipo: 'LIVIANA', rentaDia: 300, rentaSemana: 1200, rentaMes: 3600 },
    { numeracion: '129', descripcion: 'Bomba de Solidos Evans',                                 categoria: 'Bomba sólidos 2"', serie: 'serie No. 221202729',        fechaCompra: new Date('2025-02-21'), montoCompra: 4822.20, tipo: 'LIVIANA', rentaDia: 300, rentaSemana: 1200, rentaMes: 3600 },
    { numeracion: '140', descripcion: 'Bomba de solidos 2" x 2" EVANS AC2MG0750TH',            categoria: 'Bomba sólidos 2"', serie: '221202317',                   fechaCompra: new Date('2026-01-30'), montoCompra: null,    tipo: 'LIVIANA', rentaDia: 300, rentaSemana: 1200, rentaMes: 3600 },
    { numeracion: '141', descripcion: 'Bomba de solidos 2" x 2" EVANS AC2MG0750TH',            categoria: 'Bomba sólidos 2"', serie: '2212202610',                  fechaCompra: new Date('2026-01-30'), montoCompra: null,    tipo: 'LIVIANA', rentaDia: 300, rentaSemana: 1200, rentaMes: 3600 },
    { numeracion: '142', descripcion: 'Bomba de solidos sumergible HS2.4 S61 1/2 Tsurumi',     categoria: 'Bomba sólidos 2"', serie: 'Serie : 25T01827004',          fechaCompra: new Date('2026-02-04'), montoCompra: null,    tipo: 'LIVIANA', rentaDia: 300, rentaSemana: 1200, rentaMes: 3600 },
    { numeracion: '143', descripcion: 'Bomba de solidos sumergible HS2.4 S61 1/2 Tsurumi',     categoria: 'Bomba sólidos 2"', serie: 'Serie : 25T01827011',          fechaCompra: new Date('2026-02-04'), montoCompra: null,    tipo: 'LIVIANA', rentaDia: 300, rentaSemana: 1200, rentaMes: 3600 },

    // ─── Bomba p/sólidos 3"  (Q400/día · Q1600/semana · Q4800/mes) ───
    { numeracion: '95',  descripcion: 'Bomba p/solidos de 3" TSURUMI PUMP & maguera de 25 ml', categoria: 'Bomba sólidos 3"', serie: 'NK4-22 & serie 19646217001', fechaCompra: new Date('2022-01-28'), montoCompra: 6500.00, tipo: 'LIVIANA', rentaDia: 400, rentaSemana: 1600, rentaMes: 4800 },
    { numeracion: '148', descripcion: 'Bomba de solidos sumergible 3HP de 3"',                  categoria: 'Bomba sólidos 3"', serie: 'Serie : 25T02162001',          fechaCompra: new Date('2026-02-18'), montoCompra: null,    tipo: 'LIVIANA', rentaDia: 400, rentaSemana: 1600, rentaMes: 4800 },

    // ─── Cortadora de concreto  (Q1000/día · Q4000/semana · Q12000/mes) ───
    { numeracion: '11',  descripcion: 'Cortadora de concreto Hoopt con motor honda GX-390', categoria: 'Cortadora de concreto', serie: 'GCAFH-1010404',     fechaCompra: new Date('2022-01-28'), montoCompra: 12000.00, tipo: 'LIVIANA', rentaDia: 1000, rentaSemana: 4000, rentaMes: 12000 },
    { numeracion: '56',  descripcion: 'Cortadora de concreto Hoopt con motor honda GX-390', categoria: 'Cortadora de concreto', serie: 'mod. CGVCT1497164', fechaCompra: new Date('2022-01-28'), montoCompra: 12000.00, tipo: 'LIVIANA', rentaDia: 1000, rentaSemana: 4000, rentaMes: 12000 },
    { numeracion: '128', descripcion: 'Cortadora de concreto Hoopt con motor honda GX-390', categoria: 'Cortadora de concreto', serie: null,                fechaCompra: new Date('2024-11-29'), montoCompra: 12087.00, tipo: 'LIVIANA', rentaDia: 1000, rentaSemana: 4000, rentaMes: 12000 },

    // ─── Generador eléctrico  (Q400/día · Q1600/semana · Q4800/mes) ───
    { numeracion: '14',  descripcion: 'Generador marca Freedom de 2500 WT',        categoria: 'Generador eléctrico', serie: 'T53K00180-80104234',              fechaCompra: new Date('2022-01-28'), montoCompra:  1000.00, tipo: 'LIVIANA', rentaDia: 400, rentaSemana: 1600, rentaMes: 4800 },
    { numeracion: '71',  descripcion: 'Generador EVANS 9500 watts',                categoria: 'Generador eléctrico', serie: 'mod. MGT4106AE & serie 1812901046', fechaCompra: new Date('2022-01-28'), montoCompra:  6000.00, tipo: 'LIVIANA', rentaDia: 400, rentaSemana: 1600, rentaMes: 4800 },
    { numeracion: '74',  descripcion: 'Generador EVANS 4000 watts',                categoria: 'Generador eléctrico', serie: 'mod. MGT225G & serie 181203994',   fechaCompra: new Date('2022-01-28'), montoCompra:  2000.00, tipo: 'LIVIANA', rentaDia: 400, rentaSemana: 1600, rentaMes: 4800 },
    { numeracion: '76',  descripcion: 'Generador EVANS 5500 watts',                categoria: 'Generador eléctrico', serie: 'mod. MGT3400 & serie No. 181204215', fechaCompra: new Date('2022-01-28'), montoCompra:  3000.00, tipo: 'LIVIANA', rentaDia: 400, rentaSemana: 1600, rentaMes: 4800 },
    { numeracion: '81',  descripcion: 'Generador powermate 3000 watts',            categoria: 'Generador eléctrico', serie: 'mod. R210E / serie No. M020000121', fechaCompra: new Date('2022-01-28'), montoCompra:   500.00, tipo: 'LIVIANA', rentaDia: 400, rentaSemana: 1600, rentaMes: 4800 },
    { numeracion: '130', descripcion: 'Generador 3500W RGv3500 Robin',             categoria: 'Generador eléctrico', serie: 'serie: 22323V030150',               fechaCompra: new Date('2025-02-21'), montoCompra:  3928.50, tipo: 'LIVIANA', rentaDia: 400, rentaSemana: 1600, rentaMes: 4800 },
    { numeracion: '132', descripcion: 'Generador Electrico Freedom',               categoria: 'Generador eléctrico', serie: 'serie: 1036206346',                 fechaCompra: new Date('2025-02-28'), montoCompra:  9300.00, tipo: 'LIVIANA', rentaDia: 400, rentaSemana: 1600, rentaMes: 4800 },
    { numeracion: '139', descripcion: 'Generador FR6500 Freedom',                  categoria: 'Generador eléctrico', serie: 'T61G0024080150018',                 fechaCompra: new Date('2026-01-30'), montoCompra:  null,    tipo: 'LIVIANA', rentaDia: 400, rentaSemana: 1600, rentaMes: 4800 },
    { numeracion: '144', descripcion: 'Generador Portatil 5.5 Kw Trupper',        categoria: 'Generador eléctrico', serie: 'Serie: 2510114A0029',               fechaCompra: new Date('2026-02-13'), montoCompra:  null,    tipo: 'LIVIANA', rentaDia: 400, rentaSemana: 1600, rentaMes: 4800 },
    { numeracion: '145', descripcion: 'Generador Portatil 8 Kw Trupper',          categoria: 'Generador eléctrico', serie: 'Serie: 2511034A0128',               fechaCompra: new Date('2026-02-13'), montoCompra:  null,    tipo: 'LIVIANA', rentaDia: 400, rentaSemana: 1600, rentaMes: 4800 },
    { numeracion: '146', descripcion: 'Generador Portatil 5.5 Kw Trupper',        categoria: 'Generador eléctrico', serie: 'Serie: 2510114A0133',               fechaCompra: new Date('2026-02-16'), montoCompra:  null,    tipo: 'LIVIANA', rentaDia: 400, rentaSemana: 1600, rentaMes: 4800 },
    { numeracion: '147', descripcion: 'Generador Portatil 8Kw Trupper',           categoria: 'Generador eléctrico', serie: 'Serie: 2511034A0129',               fechaCompra: new Date('2026-02-16'), montoCompra:  null,    tipo: 'LIVIANA', rentaDia: 400, rentaSemana: 1600, rentaMes: 4800 },
    { numeracion: '149', descripcion: 'Generador Portatil 8Kw Trupper',           categoria: 'Generador eléctrico', serie: 'Serie: ZS190FE/P-F 2511034A0140',  fechaCompra: new Date('2026-02-21'), montoCompra:  null,    tipo: 'LIVIANA', rentaDia: 400, rentaSemana: 1600, rentaMes: 4800 },
    { numeracion: '150', descripcion: 'Generador Portatil 5.5 Kw Motor',          categoria: 'Generador eléctrico', serie: 'Serie: ZS188F-2 2510114A0179',      fechaCompra: new Date('2026-02-21'), montoCompra:  null,    tipo: 'LIVIANA', rentaDia: 400, rentaSemana: 1600, rentaMes: 4800 },
    { numeracion: '151', descripcion: 'Generador Hyundai Portatil GAS 3.0KW',     categoria: 'Generador eléctrico', serie: 'Serie: HYH2500214',                 fechaCompra: new Date('2026-02-23'), montoCompra:  null,    tipo: 'LIVIANA', rentaDia: 400, rentaSemana: 1600, rentaMes: 4800 },

    // ─── Generador soldador  (Q650/día · Q2600/semana · Q7800/mes) ───
    { numeracion: '13',  descripcion: 'Generador Soldador marca Freedom WG 6500',               categoria: 'Generador soldador', serie: 'T61E120922180',                          fechaCompra: new Date('2022-01-28'), montoCompra:  2500.00, tipo: 'LIVIANA', rentaDia: 650, rentaSemana: 2600, rentaMes: 7800 },
    { numeracion: '20',  descripcion: 'Generador Soldador marca Freedom WG 6500',               categoria: 'Generador soldador', serie: '188FT61E14120067574',                     fechaCompra: new Date('2022-01-28'), montoCompra:  2500.00, tipo: 'LIVIANA', rentaDia: 650, rentaSemana: 2600, rentaMes: 7800 },
    { numeracion: '35',  descripcion: 'Generador soldador Welder GX390',                        categoria: 'Generador soldador', serie: 'mod. EDT5 & serie GCAA4180529',           fechaCompra: new Date('2022-01-28'), montoCompra: 10000.00, tipo: 'LIVIANA', rentaDia: 650, rentaSemana: 2600, rentaMes: 7800 },
    { numeracion: '75',  descripcion: 'Generador soldador Evans',                               categoria: 'Generador soldador', serie: 'mod. MGT460GAE & serie 181201130',        fechaCompra: new Date('2022-01-28'), montoCompra:  7000.00, tipo: 'LIVIANA', rentaDia: 650, rentaSemana: 2600, rentaMes: 7800 },
    { numeracion: '117', descripcion: 'Generador Soldador marca EVANS con motor Thunder 18HP', categoria: 'Generador soldador', serie: 'serie No. 210408694 & No. W240MG1800THAE', fechaCompra: new Date('2022-12-09'), montoCompra: 22928.50, tipo: 'LIVIANA', rentaDia: 650, rentaSemana: 2600, rentaMes: 7800 },

    // ─── Martillo demoledor  (Q500/día · Q2000/semana · Q6000/mes) ───
    { numeracion: '22',  descripcion: 'Martillo demoledor DEWALT de 30 kg', categoria: 'Martillo demoledor', serie: 'mod. 2017-35-11 / 17352668',    fechaCompra: new Date('2022-01-28'), montoCompra:  7000.00, tipo: 'LIVIANA', rentaDia: 500, rentaSemana: 2000, rentaMes: 6000 },
    { numeracion: '36',  descripcion: 'Martillo demoledor DEWALT de 30 kg', categoria: 'Martillo demoledor', serie: 'mod. 2017-35-11 / 19115467',    fechaCompra: new Date('2022-01-28'), montoCompra:  7000.00, tipo: 'LIVIANA', rentaDia: 500, rentaSemana: 2000, rentaMes: 6000 },
    { numeracion: '70',  descripcion: 'Martillo demoledor DEWALT de 30 kg', categoria: 'Martillo demoledor', serie: 'mod. 2017-35-11 / 13350660',    fechaCompra: new Date('2022-01-28'), montoCompra:  7000.00, tipo: 'LIVIANA', rentaDia: 500, rentaSemana: 2000, rentaMes: 6000 },
    { numeracion: '79',  descripcion: 'Martillo demoledor DEWALT de 30 kg', categoria: 'Martillo demoledor', serie: 'mod. 2017-35-11 / 17352736',    fechaCompra: new Date('2022-01-28'), montoCompra:  7000.00, tipo: 'LIVIANA', rentaDia: 500, rentaSemana: 2000, rentaMes: 6000 },
    { numeracion: '106', descripcion: 'Martillo demoledor DEWALT de 30 kg', categoria: 'Martillo demoledor', serie: 'serie No. 2021-36-11006458',    fechaCompra: new Date('2022-04-23'), montoCompra: 15724.80, tipo: 'LIVIANA', rentaDia: 500, rentaSemana: 2000, rentaMes: 6000 },
    { numeracion: '107', descripcion: 'Martillo demoledor DEWALT de 30 kg', categoria: 'Martillo demoledor', serie: 'serie No. 2021-36-11006459',    fechaCompra: new Date('2022-04-23'), montoCompra: 15724.80, tipo: 'LIVIANA', rentaDia: 500, rentaSemana: 2000, rentaMes: 6000 },
    { numeracion: '136', descripcion: 'Martillo Demoledor Truper 30kg 2000W', categoria: 'Martillo demoledor', serie: null,                          fechaCompra: new Date('2025-08-27'), montoCompra:  6780.00, tipo: 'LIVIANA', rentaDia: 500, rentaSemana: 2000, rentaMes: 6000 },

    // ─── Medidor de presión  (Q200/día · Q800/semana · Q2400/mes) ───
    { numeracion: '58',  descripcion: 'Medidor de presión SUPER EGO', categoria: 'Medidor de presión', serie: 'mod. RP50-S / serie 12073735', fechaCompra: new Date('2022-01-28'), montoCompra: 2500.00, tipo: 'LIVIANA', rentaDia: 200, rentaSemana: 800, rentaMes: 2400 },
    { numeracion: '135', descripcion: 'Medidor de presión PRÜFPUMPE', categoria: 'Medidor de presión', serie: null,                          fechaCompra: new Date('2025-08-05'), montoCompra:  840.00, tipo: 'LIVIANA', rentaDia: 200, rentaSemana: 800, rentaMes: 2400 },

    // ─── Mezcladora de concreto  (Q400/día · Q1600/semana · Q4800/mes) ───
    { numeracion: '24',  descripcion: 'Mezcladora Rockman de 1.5 sacos', categoria: 'Mezcladora de concreto', serie: 'mod. GX270 / 0303481',               fechaCompra: new Date('2022-01-28'), montoCompra: 8000.00, tipo: 'LIVIANA', rentaDia: 400, rentaSemana: 1600, rentaMes: 4800 },
    { numeracion: '25',  descripcion: 'Mezcladora Rockman de 1.5 sacos', categoria: 'Mezcladora de concreto', serie: 'mod. GX270 / 0336327',               fechaCompra: new Date('2022-01-28'), montoCompra: 8000.00, tipo: 'LIVIANA', rentaDia: 400, rentaSemana: 1600, rentaMes: 4800 },
    { numeracion: '26',  descripcion: 'Mezcladora Rockman de 1.5 sacos', categoria: 'Mezcladora de concreto', serie: 'mod. GX270 / 0157811',               fechaCompra: new Date('2022-01-28'), montoCompra: 8000.00, tipo: 'LIVIANA', rentaDia: 400, rentaSemana: 1600, rentaMes: 4800 },
    { numeracion: '34',  descripcion: 'Mezcladora Sirl GX160',           categoria: 'Mezcladora de concreto', serie: 'mod. JH1G8F & serie: GCAAH-5549003', fechaCompra: new Date('2022-01-28'), montoCompra: 8000.00, tipo: 'LIVIANA', rentaDia: 400, rentaSemana: 1600, rentaMes: 4800 },
    { numeracion: '77',  descripcion: 'Mezcladora Sirl GX160',           categoria: 'Mezcladora de concreto', serie: 'mod. JH168F & serie GCAAH-5296849',  fechaCompra: new Date('2022-01-28'), montoCompra: 8000.00, tipo: 'LIVIANA', rentaDia: 400, rentaSemana: 1600, rentaMes: 4800 },
    { numeracion: '78',  descripcion: 'Mezcladora Sirl GX160',           categoria: 'Mezcladora de concreto', serie: 'mod. JH168F & serie GCAAH-5549001',  fechaCompra: new Date('2022-01-28'), montoCompra: 8000.00, tipo: 'LIVIANA', rentaDia: 400, rentaSemana: 1600, rentaMes: 4800 },

    // ─── Plancha alisadora de concreto  (Q100/día · Q400/semana · Q1200/mes) ───
    { numeracion: '55',  descripcion: 'Plancha alizadora de concreto', categoria: 'Plancha alisadora de concreto', serie: null, fechaCompra: new Date('2022-01-28'), montoCompra: 100.00, tipo: 'LIVIANA', rentaDia: 100, rentaSemana: 400, rentaMes: 1200 },
    { numeracion: '72',  descripcion: 'Plancha alizadora de concreto', categoria: 'Plancha alisadora de concreto', serie: null, fechaCompra: new Date('2022-01-28'), montoCompra: 100.00, tipo: 'LIVIANA', rentaDia: 100, rentaSemana: 400, rentaMes: 1200 },

    // ─── Plato vibratorio  (Q300/día · Q1200/semana · Q3600/mes) ───
    { numeracion: '125', descripcion: 'Plato vibratorio HOPPT', categoria: 'Plato vibratorio', serie: 'serie No. 231220409', fechaCompra: new Date('2023-05-10'), montoCompra: 12963.60, tipo: 'LIVIANA', rentaDia: 300, rentaSemana: 1200, rentaMes: 3600 },

    // ─── Rastrillo  (Q100/día · Q400/semana · Q1200/mes) ───
    { numeracion: '63',  descripcion: 'Rastrillo para concreto', categoria: 'Rastrillo', serie: null, fechaCompra: new Date('2022-01-28'), montoCompra:  100.00, tipo: 'LIVIANA', rentaDia: 100, rentaSemana: 400, rentaMes: 1200 },
    { numeracion: '73',  descripcion: 'Rastrillo para concreto', categoria: 'Rastrillo', serie: null, fechaCompra: new Date('2022-01-28'), montoCompra:  100.00, tipo: 'LIVIANA', rentaDia: 100, rentaSemana: 400, rentaMes: 1200 },
    { numeracion: '120', descripcion: 'Rastrillo para concreto', categoria: 'Rastrillo', serie: null, fechaCompra: new Date('2024-01-29'), montoCompra: 3073.50, tipo: 'LIVIANA', rentaDia: 100, rentaSemana: 400, rentaMes: 1200 },
    { numeracion: '121', descripcion: 'Rastrillo para concreto', categoria: 'Rastrillo', serie: null, fechaCompra: new Date('2024-01-29'), montoCompra: 3073.50, tipo: 'LIVIANA', rentaDia: 100, rentaSemana: 400, rentaMes: 1200 },

    // ─── Compresor  (Q1500/día · Q6000/semana · Q18000/mes) ───
    { numeracion: '123', descripcion: 'Compresor Euler 185CFM TWT185D-7', categoria: 'Compresor', serie: 'serie: TWT001127-BNV4316', fechaCompra: new Date('2024-01-31'), montoCompra: 157084.20, tipo: 'LIVIANA', rentaDia: 1500, rentaSemana: 6000, rentaMes: 18000 },

    // ─── Barreno industrial  (Q300/día · Q1200/semana · Q3600/mes) ───
    { numeracion: '60',  descripcion: 'Barreno industrial DeWalt de 3/4", 1.19/16"', categoria: 'Barreno industrial', serie: 'BR2 D2550', fechaCompra: new Date('2022-01-28'), montoCompra: 4000.00, tipo: 'LIVIANA', rentaDia: 300, rentaSemana: 1200, rentaMes: 3600 },

    // ─── Rodo  (Q600/día · Q2400/semana · Q7200/mes) ───
    { numeracion: '124', descripcion: 'Rodo Compactador Hoppt c/m honda 13HP',           categoria: 'Rodo no tripulado', serie: 'serie: 2312061024-1128831',   fechaCompra: new Date('2024-03-06'), montoCompra:  82755.90, tipo: 'LIVIANA', rentaDia: 600, rentaSemana: 2400, rentaMes: 7200 },
    { numeracion: '126', descripcion: 'Rodo compactador Hyundai',                        categoria: 'Rodo no tripulado', serie: null,                          fechaCompra: new Date('2024-06-29'), montoCompra:  50934.96, tipo: 'LIVIANA', rentaDia: 600, rentaSemana: 2400, rentaMes: 7200 },
    { numeracion: '134', descripcion: 'Rodo No Tripulado ROL650PH Hoppt c/m Honda 13HP', categoria: 'Rodo no tripulado', serie: 'serie: 2312061023-112826',    fechaCompra: new Date('2025-07-09'), montoCompra:  82755.90, tipo: 'LIVIANA', rentaDia: 600, rentaSemana: 2400, rentaMes: 7200 },
    { numeracion: '137', descripcion: 'Rodo No Tripulado ROL650PH Hoppt c/m Honda 13HP', categoria: 'Rodo no tripulado', serie: 'serie: 2503221176-1357700',   fechaCompra: new Date('2025-09-25'), montoCompra: 827500.90, tipo: 'LIVIANA', rentaDia: 600, rentaSemana: 2400, rentaMes: 7200 },
    { numeracion: '152', descripcion: 'Rodo No Tripulado ROL650PH Hoppt c/m Honda 13HP', categoria: 'Rodo no tripulado', serie: 'Serie: 2509251300 - 2398124', fechaCompra: new Date('2026-02-23'), montoCompra:  null,     tipo: 'LIVIANA', rentaDia: 600, rentaSemana: 2400, rentaMes: 7200 },

    // ─── Vibrador de concreto  (Q350/día · Q1400/semana · Q4200/mes) ───
    { numeracion: '39',  descripcion: 'Vibrador de concreto GUASUECA con motor honda GX160', categoria: 'Vibrador de concreto', serie: 'GCAAH5305643',  fechaCompra: new Date('2022-01-28'), montoCompra: 1500.00, tipo: 'LIVIANA', rentaDia: 350, rentaSemana: 1400, rentaMes: 4200 },
    { numeracion: '42',  descripcion: 'Vibrador de concreto Weber MT con motor honda GX160', categoria: 'Vibrador de concreto', serie: 'GCABT4536120',  fechaCompra: new Date('2022-01-28'), montoCompra: 2500.00, tipo: 'LIVIANA', rentaDia: 350, rentaSemana: 1400, rentaMes: 4200 },
    { numeracion: '52',  descripcion: 'Vibrador de concreto Weber MT con motor honda GX160', categoria: 'Vibrador de concreto', serie: 'GCABT-4342965', fechaCompra: new Date('2022-01-28'), montoCompra: 2500.00, tipo: 'LIVIANA', rentaDia: 350, rentaSemana: 1400, rentaMes: 4200 },
    { numeracion: '53',  descripcion: 'Vibrador de concreto Weber MT con motor honda GX160', categoria: 'Vibrador de concreto', serie: 'GCABT-4589499', fechaCompra: new Date('2022-01-28'), montoCompra: 2500.00, tipo: 'LIVIANA', rentaDia: 350, rentaSemana: 1400, rentaMes: 4200 },
    { numeracion: '54',  descripcion: 'Vibrador de concreto GUASUECA con motor honda GX160', categoria: 'Vibrador de concreto', serie: 'JH1G8F-5305649', fechaCompra: new Date('2022-01-28'), montoCompra: 1500.00, tipo: 'LIVIANA', rentaDia: 350, rentaSemana: 1400, rentaMes: 4200 },

    // ─── Montacarga manual  (Q150/día · Q600/semana · Q1800/mes) ───
    { numeracion: '119', descripcion: 'Montacarga manual marca INGCO', categoria: 'Montacarga manual', serie: null, fechaCompra: new Date('2024-01-27'), montoCompra: 3800.00, tipo: 'LIVIANA', rentaDia: 150, rentaSemana: 600, rentaMes: 1800 },

    // ─── Helicóptero  (Q500/día · Q2000/semana · Q6000/mes) ───
    { numeracion: '122', descripcion: 'Helicoptero TOL100GB HOPPT con motor HONDA 5.5HP', categoria: 'Helicóptero', serie: 'serie: 18B051159-1027681',  fechaCompra: new Date('2024-01-30'), montoCompra: 14137.20, tipo: 'LIVIANA', rentaDia: 500, rentaSemana: 2000, rentaMes: 6000 },
    { numeracion: '138', descripcion: 'Helicoptero TOL100GB HOPPT c/m HONDA 5.5HP',      categoria: 'Helicóptero', serie: 'serie: 24081024-2359840',    fechaCompra: new Date('2025-10-29'), montoCompra: null,     tipo: 'LIVIANA', rentaDia: 500, rentaSemana: 2000, rentaMes: 6000 },

    // ══════════════════════════════════════════
    //  MAQUINARIA PESADA  (sin categoría)
    // ══════════════════════════════════════════
    { numeracion: 'MP01', descripcion: 'Retroexcavadora CASE 580N',            categoria: 'Retroexcavadora', serie: 'serie: JJGN58NRCLC771510 & motor: 1728119',                 fechaCompra: new Date('2020-12-04'), montoCompra: 500000.00, tipo: 'PESADA', rentaHora: 475, rentaDia: null, rentaSemana: null, rentaMes: null },
    { numeracion: 'MP02', descripcion: 'Rodo compactador Tripulado CASE DV36', categoria: 'Rodo tripulado',  serie: 'serie: NHNTV0108 & motor: W7885',                           fechaCompra: new Date('2022-02-24'), montoCompra: 250000.00, tipo: 'PESADA', rentaHora: 325, rentaDia: null, rentaSemana: null, rentaMes: null },
    { numeracion: 'MP04', descripcion: 'Montacarga',                           categoria: 'Montacarga',      serie: null,                                                        fechaCompra: new Date('2023-10-04'), montoCompra: 327600.00, tipo: 'PESADA', rentaHora: 350, rentaDia: null, rentaSemana: null, rentaMes: null },
    { numeracion: 'MP05', descripcion: 'Minicargador CASE SR250B',             categoria: 'Minicargador',    serie: 'MODELO: SR250B SERIE: JAFSR250VPM446786 & MOTOR: 1025722', fechaCompra: new Date('2024-07-04'), montoCompra: 472420.00, tipo: 'PESADA', rentaHora: 350, rentaDia: null, rentaSemana: null, rentaMes: null },
    { numeracion: 'MP06', descripcion: 'Minicargador CASE SR220B',             categoria: 'Minicargador',    serie: 'MODELO: SR220B SERIE: JAFSR220CPM450582 MOTOR: 1035944',   fechaCompra: new Date('2025-03-25'), montoCompra: 429112.20, tipo: 'PESADA', rentaHora: 350, rentaDia: null, rentaSemana: null, rentaMes: null },
    { numeracion: 'MP07', descripcion: 'Retroexcavadora Case 580N',            categoria: 'Retroexcavadora', serie: 'serie: JJGN58NRJRC787598 No. de Motor: 2194620',            fechaCompra: new Date('2025-08-08'), montoCompra: 890000.00, tipo: 'PESADA', rentaHora: 475, rentaDia: null, rentaSemana: null, rentaMes: null },

    // ══════════════════════════════════════════
    //  DADOS DE BAJA
    // ══════════════════════════════════════════
    { numeracion: '98',       descripcion: 'Plato vibratorio WOLKAN mod. PV1500',             categoria: 'Plato vibratorio',  serie: 'serie 209546',                             fechaCompra: new Date('2022-01-28'), montoCompra:  10000.00, tipo: 'LIVIANA', rentaDia: 300, rentaSemana: 1200, rentaMes: 3600, isActive: false, motivoBaja: 'Dado de baja tras ser robado',        fechaBaja: new Date('2022-01-28') },
    { numeracion: 'BAJA-SN2', descripcion: 'Plato vibratorio WOLKAN',                         categoria: 'Plato vibratorio',  serie: '-',                                        fechaCompra: new Date('2022-01-28'), montoCompra:  10000.00, tipo: 'LIVIANA', rentaDia: 300, rentaSemana: 1200, rentaMes: 3600, isActive: false, motivoBaja: 'Dado de baja tras ser robado',        fechaBaja: new Date('2022-01-28') },
    { numeracion: '131',      descripcion: 'Rodo No Tripulado ROL650PH Hoppt c/m Honda 13HP', categoria: 'Rodo no tripulado', serie: 'serie: 2312061025-1165179',                 fechaCompra: new Date('2025-02-21'), montoCompra:  87261.47, tipo: 'LIVIANA', rentaDia: 600, rentaSemana: 2400, rentaMes: 7200, isActive: false, motivoBaja: 'Dado de baja por venta',              fechaBaja: new Date('2025-02-21') },
    { numeracion: 'BAJA-SN04',descripcion: 'Rodo No Tripulado ROL650PH Hoppt c/m Honda 13HP', categoria: 'Rodo no tripulado', serie: '-',                                        fechaCompra: new Date('2025-05-15'), montoCompra:  87261.47, tipo: 'LIVIANA', rentaDia: 600, rentaSemana: 2400, rentaMes: 7200, isActive: false, motivoBaja: 'Dado de baja',                       fechaBaja: new Date('2025-05-15') },
    { numeracion: 'MP03',     descripcion: 'Minicargador CASE SR220B',                        categoria: 'Minicargador',      serie: 'serie: JAFSR220LMM407232 & motor: 614722', fechaCompra: new Date('2022-03-24'), montoCompra: 325000.00, tipo: 'PESADA',   rentaDia: null, rentaSemana: null, rentaMes: null, isActive: false, motivoBaja: 'Dado de baja por venta',              fechaBaja: new Date('2022-03-24') },

    // ══════════════════════════════════════════
    //  EQUIPO USO PROPIO
    // ══════════════════════════════════════════
    { numeracion: '28',  descripcion: 'Motosierra Sthil MS361',                categoria: 'Motosierra',       serie: null,                                     fechaCompra: new Date('2022-01-28'), montoCompra: 1500.00, tipo: 'USO_PROPIO', rentaDia: null, rentaSemana: null, rentaMes: null },
    { numeracion: '30',  descripcion: 'Motosierra Sthil MS780',                categoria: 'Motosierra',       serie: null,                                     fechaCompra: new Date('2022-01-28'), montoCompra: 4000.00, tipo: 'USO_PROPIO', rentaDia: null, rentaSemana: null, rentaMes: null },
    { numeracion: '99',  descripcion: 'Hidrolavadora HIDROCAMPO',              categoria: 'Hidrolavadora',    serie: 'mod. HPWQP750 serie No. DH225090549420', fechaCompra: new Date('2022-01-28'), montoCompra: 1500.00, tipo: 'USO_PROPIO', rentaDia: null, rentaSemana: null, rentaMes: null },
    { numeracion: '104', descripcion: 'Chapeadora trupper DES-63',             categoria: 'Chapeadora',       serie: null,                                     fechaCompra: new Date('2022-01-28'), montoCompra: 2000.00, tipo: 'USO_PROPIO', rentaDia: null, rentaSemana: null, rentaMes: null },
    { numeracion: '105', descripcion: 'Sopladora marca Truper',                categoria: 'Sopladora',        serie: null,                                     fechaCompra: new Date('2022-03-05'), montoCompra: 1800.00, tipo: 'USO_PROPIO', rentaDia: null, rentaSemana: null, rentaMes: null },
    { numeracion: '118', descripcion: 'Compresor de aire lubricado de 50 lbs', categoria: 'Compresor',        serie: null,                                     fechaCompra: new Date('2023-01-10'), montoCompra: 1560.00, tipo: 'USO_PROPIO', rentaDia: null, rentaSemana: null, rentaMes: null },
    { numeracion: '133', descripcion: 'Regla vibratoria',                      categoria: 'Regla vibratoria', serie: 'serie: 22102064-7002930',                 fechaCompra: new Date('2025-05-22'), montoCompra: 8596.80, tipo: 'USO_PROPIO', rentaDia: null, rentaSemana: null, rentaMes: null },

  ];

  // ── 4a. Tipos de equipo ───────────────────────────────────────────────────
  // IDs explícitos para mantener consistencia con la DB existente.
  const [tipoLiviana, tipoPesada, tipoUso] = await Promise.all([
    prisma.tipoEquipo.upsert({
      where:  { id: 'tipo_liviana' },
      update: { modalidad: 'LIVIANA' },
      create: { id: 'tipo_liviana', nombre: 'LIVIANA', modalidad: 'LIVIANA', descripcion: 'Maquinaria liviana de alquiler' },
    }),
    prisma.tipoEquipo.upsert({
      where:  { id: 'tipo_pesada' },
      update: { modalidad: 'PESADA' },
      create: { id: 'tipo_pesada',  nombre: 'PESADA',  modalidad: 'PESADA',  descripcion: 'Maquinaria pesada de alquiler' },
    }),
    prisma.tipoEquipo.upsert({
      where:  { id: 'tipo_uso' },
      update: { modalidad: 'USO_PROPIO' },
      create: { id: 'tipo_uso', nombre: 'USO_PROPIO', modalidad: 'USO_PROPIO', descripcion: 'Equipo para uso interno' },
    }),
  ]);

  const tipoMap: Record<string, string> = {
    LIVIANA:    tipoLiviana.id,
    PESADA:     tipoPesada.id,
    USO_PROPIO: tipoUso.id,
  };
  console.log('  3 tipos de equipo listos');

  // ── 4b. Categorías — agrupadas por tipo ──────────────────────────────────
  // Los nombres duplicados entre tipos ('Rodo compactador', 'Montacarga', 'Compresor')
  // son entidades distintas. La clave `nombre|tipoNombre` los distingue sin ambigüedad.
  const categoriasPorTipo: Record<string, string[]> = {
    LIVIANA: [
      'Bailarina',              'Bomba de agua',              'Bomba sólidos 2"',
      'Bomba sólidos 3"',       'Cortadora de concreto',      'Generador eléctrico',
      'Generador soldador',     'Martillo demoledor',         'Medidor de presión',
      'Mezcladora de concreto', 'Plancha alisadora de concreto', 'Plato vibratorio',
      'Rastrillo',              'Compresor',                  'Barreno industrial',
      'Rodo no tripulado',      'Vibrador de concreto',       'Montacarga manual',
      'Helicóptero',
    ],
    PESADA: [
      'Retroexcavadora', 'Rodo tripulado', 'Montacarga', 'Minicargador',
    ],
    USO_PROPIO: [
      'Motosierra', 'Hidrolavadora', 'Chapeadora',
      'Sopladora',  'Compresor',     'Regla vibratoria',
    ],
  };

  // Map: `${categoríaNombre}|${tipoNombre}` → categoriaId
  const categoriaMap = new Map<string, string>();

  for (const [tipoNombre, nombres] of Object.entries(categoriasPorTipo)) {
    const tipoId = tipoMap[tipoNombre];
    for (const nombre of nombres) {
      const cat = await prisma.categoria.upsert({
        where:  { nombre_tipoId: { nombre, tipoId } },
        update: {},
        create: { nombre, tipoId },
      });
      categoriaMap.set(`${nombre}|${tipoNombre}`, cat.id);
    }
  }
  console.log(`  ${categoriaMap.size} categorías listas`);

  // ── 4c. Equipos ───────────────────────────────────────────────────────────
  for (const e of equiposData) {
    const equipoData = {
      descripcion:  e.descripcion,
      serie:        e.serie,
      fechaCompra:  e.fechaCompra,
      montoCompra:  e.montoCompra,
      tipoId:       tipoMap[e.tipo],
      categoriaId:  categoriaMap.get(`${e.categoria}|${e.tipo}`) ?? null,
      rentaHora:    e.rentaHora ?? null,
      rentaDia:     e.rentaDia,
      rentaSemana:  e.rentaSemana,
      rentaMes:     e.rentaMes,
      isActive:     e.isActive   ?? true,
      motivoBaja:   e.motivoBaja ?? null,
      fechaBaja:    e.fechaBaja  ?? null,
    };
    await prisma.equipo.upsert({
      where:  { numeracion: e.numeracion },
      update: equipoData,
      create: { numeracion: e.numeracion, ...equipoData },
    });
  }
  console.log(`  ${equiposData.length} equipos listos`);

  // 5. Extras de maquinaria pesada
  console.log('\nCreando extras de maquinaria pesada...');

  const tipoMartillo = await prisma.tipoExtra.upsert({
    where:  { nombre: 'Martillo' },
    update: {},
    create: { nombre: 'Martillo' },
  });

  const mp01 = await prisma.equipo.findUnique({ where: { numeracion: 'MP01' } });
  const mp07 = await prisma.equipo.findUnique({ where: { numeracion: 'MP07' } });

  if (mp01) {
    await prisma.extraEquipo.upsert({
      where:  { equipoId_tipoExtraId: { equipoId: mp01.id, tipoExtraId: tipoMartillo.id } },
      update: { rentaHora: 175 },
      create: { equipoId: mp01.id, tipoExtraId: tipoMartillo.id, rentaHora: 175 },
    });
  }
  if (mp07) {
    await prisma.extraEquipo.upsert({
      where:  { equipoId_tipoExtraId: { equipoId: mp07.id, tipoExtraId: tipoMartillo.id } },
      update: { rentaHora: 175 },
      create: { equipoId: mp07.id, tipoExtraId: tipoMartillo.id, rentaHora: 175 },
    });
  }
  console.log('  Martillo agregado a MP01 y MP07 (Q175/hora c/u)');

  // 6. Configuración de precios de granel
  console.log('\nCreando configuración de precios de granel...');
  await prisma.configGranel.upsert({
    where:  { tipo: 'PUNTAL' },
    update: {},
    create: { tipo: 'PUNTAL', rentaDia: 1.5, rentaSemana: 5, rentaMes: 15 },
  });
  await prisma.configGranel.upsert({
    where:  { tipo: 'ANDAMIO_SIMPLE' },
    update: { rentaDia: 10, rentaSemana: 40, rentaMes: 120, rentaDiaConMadera: 25, rentaSemanaConMadera: 100, rentaMesConMadera: 300 },
    create: {
      tipo: 'ANDAMIO_SIMPLE',
      rentaDia: 10, rentaSemana: 40, rentaMes: 120,
      rentaDiaConMadera: 25, rentaSemanaConMadera: 100, rentaMesConMadera: 300,
    },
  });
  await prisma.configGranel.upsert({
    where:  { tipo: 'ANDAMIO_RUEDAS' },
    update: { rentaDia: 25, rentaSemana: 100, rentaMes: 300 },
    create: { tipo: 'ANDAMIO_RUEDAS', rentaDia: 25, rentaSemana: 100, rentaMes: 300 },
  });
  console.log('  ConfigGranel lista: PUNTAL · ANDAMIO_SIMPLE · ANDAMIO_RUEDAS');

  // 6. Lotes de granel
  console.log('\nCreando lotes de granel...');
  const lotesPuntal = await prisma.loteGranel.count({ where: { tipo: 'PUNTAL' } });
  if (lotesPuntal === 0) {
    await prisma.loteGranel.createMany({
      data: [
        { tipo: 'PUNTAL', descripcion: 'Puntales telescópicos', cantidad: 100, precioUnitario: 261.68 },
        { tipo: 'PUNTAL', descripcion: 'Puntales metálicos',    cantidad: 900, precioUnitario: 170.00 },
        { tipo: 'PUNTAL', descripcion: 'Puntales metálicos',    cantidad: 200, precioUnitario: 170.00, fechaCompra: new Date('2024-12-20') },
        { tipo: 'PUNTAL', descripcion: 'Puntales metálicos',    cantidad: 300, precioUnitario: 170.00, fechaCompra: new Date('2024-12-30') },
        { tipo: 'PUNTAL', descripcion: 'Puntales metálicos',    cantidad:   2, precioUnitario: 170.00, fechaCompra: new Date('2025-04-15') },
      ],
    });
    console.log('  5 lotes de PUNTAL creados');
  } else {
    console.log(`  Omitido: ya existen ${lotesPuntal} lotes de PUNTAL.`);
  }

  const lotesAndamioSimple = await prisma.loteGranel.count({ where: { tipo: 'ANDAMIO_SIMPLE' } });
  if (lotesAndamioSimple === 0) {
    await prisma.loteGranel.createMany({
      data: [
        { tipo: 'ANDAMIO_SIMPLE', descripcion: 'Módulos de andamios metálicos', cantidad:  93, precioUnitario: 750.00, fechaCompra: new Date('2022-01-28') },
        { tipo: 'ANDAMIO_SIMPLE', descripcion: 'Módulos de andamios metálicos', cantidad:  12, precioUnitario: 750.00, fechaCompra: new Date('2024-09-23') },
        { tipo: 'ANDAMIO_SIMPLE', descripcion: 'Módulos de andamios simples',   cantidad:  25, precioUnitario: 1200.00, fechaCompra: new Date('2024-03-26') },
        { tipo: 'ANDAMIO_SIMPLE', descripcion: 'Módulos de andamios simples',   cantidad:  38, precioUnitario: 900.00, fechaCompra: new Date('2024-06-10') },
        { tipo: 'ANDAMIO_SIMPLE', descripcion: 'Módulos de andamios simples',   cantidad:   5, precioUnitario: 900.00, fechaCompra: new Date('2024-07-09') },
        { tipo: 'ANDAMIO_SIMPLE', descripcion: 'Módulos de Andamios Simples',   cantidad:   8, precioUnitario: 1200.00, fechaCompra: new Date('2024-11-18') },
        { tipo: 'ANDAMIO_SIMPLE', descripcion: 'Módulos de Andamios Simples',   cantidad:  30, precioUnitario: 1200.00, fechaCompra: new Date('2024-12-09') },
      ],
    });
    console.log('  7 lotes de ANDAMIO_SIMPLE creados');
  } else {
    console.log(`  Omitido: ya existen ${lotesAndamioSimple} lotes de ANDAMIO_SIMPLE.`);
  }

  const lotesAndamioRuedas = await prisma.loteGranel.count({ where: { tipo: 'ANDAMIO_RUEDAS' } });
  if (lotesAndamioRuedas === 0) {
    await prisma.loteGranel.createMany({
      data: [
        { tipo: 'ANDAMIO_RUEDAS', descripcion: 'Módulos de andamios con ruedas', cantidad: 4, precioUnitario: 900.00, fechaCompra: new Date('2024-06-10') },
      ],
    });
    console.log('  1 lote de ANDAMIO_RUEDAS creado');
  } else {
    console.log(`  Omitido: ya existen ${lotesAndamioRuedas} lotes de ANDAMIO_RUEDAS.`);
  }

  console.log('===========================================');
  console.log('\nSeed completado exitosamente!');
}

main()
  .catch((e) => {
    console.error('Error en seed:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
