import { PrismaClient } from '@prisma/client';
import * as bcrypt from 'bcrypt';

const prisma = new PrismaClient();

async function main() {
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

  const secretariaRole = await prisma.role.upsert({
    where: { nombre: 'secretaria' },
    update: {},
    create: {
      nombre: 'secretaria',
      descripcion: 'Secretaria - Aprueba solicitudes',
    },
  });

  const encargadoRole = await prisma.role.upsert({
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
  const adminPassword = await bcrypt.hash('Admin123!', 12);
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

  // Usuario Secretaria
  const secretariaPassword = await bcrypt.hash('Secre123!', 12);
  await prisma.usuario.upsert({
    where: { username: 'secretaria' },
    update: {},
    create: {
      username: 'secretaria',
      password: secretariaPassword,
      nombre: 'Maria Lopez',
      telefono: '55555678',
      roleId: secretariaRole.id,
    },
  });
  console.log('  - Secretaria creada');

  // Usuario Encargado Maquinas
  const encargadoPassword = await bcrypt.hash('Encar123!', 12);
  await prisma.usuario.upsert({
    where: { username: 'encargado' },
    update: {},
    create: {
      username: 'encargado',
      password: encargadoPassword,
      nombre: 'Pedro Garcia',
      telefono: '55553456',
      roleId: encargadoRole.id,
    },
  });
  console.log('  - Encargado creado');

  console.log('\nUsuarios creados\n');

  // 3. Mostrar credenciales
  console.log('===========================================');
  console.log('CREDENCIALES DE ACCESO:');
  console.log('===========================================\n');
  
  console.log('ADMINISTRADOR:');
  console.log('   Usuario:    admin');
  console.log('   Contrasena: Admin123!\n');
  
  console.log('SECRETARIA:');
  console.log('   Usuario:    secretaria');
  console.log('   Contrasena: Secre123!\n');
  
  console.log('ENCARGADO MAQUINAS:');
  console.log('   Usuario:    encargado');
  console.log('   Contrasena: Encar123!\n');
  
  console.log('===========================================');

  // 4. Tipos de equipo, categorías y equipos
  // Los tres pasos van juntos porque categorías dependen de tipos, y equipos de ambos.
  console.log('\nCreando tipos, categorías y equipos...');

  interface EquipoSeed {
    numeracion:        string;
    descripcion:       string;
    categoria:         string;
    serie:             string | null;
    fechaCompra:       Date;
    montoCompra:       number;
    tipo:              string;
    rentaHora?:        number | null;
    rentaHoraMartillo?: number | null;
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
    { numeracion: '1',  descripcion: 'Bailarina Hoopt con motor subaru 4.0 EH12',      categoria: 'Bailarina', serie: 'RAM 70B 120306115 / J0114213TH122',                        fechaCompra: new Date('2022-01-28'), montoCompra: 12000.00, tipo: 'LIVIANA', rentaDia: 400, rentaSemana: 1600, rentaMes: 4800 },
    { numeracion: '2',  descripcion: 'Bailarina Hoopt con motor honda GX 100',         categoria: 'Bailarina', serie: 'RAM 70C 18-0803286 / EH122D-J0117171 MARCA SUBARU',        fechaCompra: new Date('2022-01-28'), montoCompra: 10000.00, tipo: 'LIVIANA', rentaDia: 400, rentaSemana: 1600, rentaMes: 4800 },
    { numeracion: '47', descripcion: 'Bailarina WOLKAN con motor honda',               categoria: 'Bailarina', serie: 'mod. SW550 662964 serie No. GCCDT2103360',                 fechaCompra: new Date('2022-01-28'), montoCompra: 12500.00, tipo: 'LIVIANA', rentaDia: 400, rentaSemana: 1600, rentaMes: 4800 },
    { numeracion: '48', descripcion: 'Bailarina WOLKAN con motor honda',               categoria: 'Bailarina', serie: 'mod. SW600 006625 serie No. GCCDT2104107',                 fechaCompra: new Date('2022-01-28'), montoCompra: 12500.00, tipo: 'LIVIANA', rentaDia: 400, rentaSemana: 1600, rentaMes: 4800 },
    { numeracion: '49', descripcion: 'Bailarina WOLKAN con motor honda',               categoria: 'Bailarina', serie: 'mod. SW600 006831 serie No. GCCDT2104073',                 fechaCompra: new Date('2022-01-28'), montoCompra: 12500.00, tipo: 'LIVIANA', rentaDia: 400, rentaSemana: 1600, rentaMes: 4800 },
    { numeracion: '54', descripcion: 'Bailarina HOPPT con motor honda',                categoria: 'Bailarina', serie: 'serie No. 181031441-1113078',                               fechaCompra: new Date('2022-07-18'), montoCompra: 17280.00, tipo: 'LIVIANA', rentaDia: 400, rentaSemana: 1600, rentaMes: 4800 },
    { numeracion: '55', descripcion: 'Bailarina Weber con motor honda',                categoria: 'Bailarina', serie: 'serie No. GCCDT-2159036',                                   fechaCompra: new Date('2022-07-18'), montoCompra: 21800.00, tipo: 'LIVIANA', rentaDia: 400, rentaSemana: 1600, rentaMes: 4800 },
    { numeracion: '57', descripcion: 'Bailarina HUSQVARNA con motor honda GXR120',    categoria: 'Bailarina', serie: 'serie No. 20213400041',                                     fechaCompra: new Date('2022-12-02'), montoCompra: 21046.30, tipo: 'LIVIANA', rentaDia: 400, rentaSemana: 1600, rentaMes: 4800 },
    { numeracion: '58', descripcion: 'Bailarina HUSQVARNA con motor honda GXR120',    categoria: 'Bailarina', serie: 'serie No. 20214101660',                                     fechaCompra: new Date('2022-12-02'), montoCompra: 21046.30, tipo: 'LIVIANA', rentaDia: 400, rentaSemana: 1600, rentaMes: 4800 },
    { numeracion: '59', descripcion: 'Bailarina HUSQVARNA con motor honda GXR120',    categoria: 'Bailarina', serie: 'serie No. 20214101726',                                     fechaCompra: new Date('2022-12-02'), montoCompra: 21046.30, tipo: 'LIVIANA', rentaDia: 400, rentaSemana: 1600, rentaMes: 4800 },
    { numeracion: '60', descripcion: 'Bailarina WEBER con motor honda GXR120',        categoria: 'Bailarina', serie: 'serie No. 20076183',                                        fechaCompra: new Date('2022-12-09'), montoCompra: 24400.00, tipo: 'LIVIANA', rentaDia: 400, rentaSemana: 1600, rentaMes: 4800 },

    // ─── Bomba de agua  (Q400/día · Q1600/semana · Q4800/mes) ───
    { numeracion: '3',  descripcion: 'Bomba de agua de 3" marca honda y motor GX-160', categoria: 'Bomba de agua', serie: 'mod. JH1G8F & serie: GCAAH-3281883',  fechaCompra: new Date('2022-01-28'), montoCompra:  2000.00, tipo: 'LIVIANA', rentaDia: 400, rentaSemana: 1600, rentaMes: 4800 },
    { numeracion: '18', descripcion: 'Bomba de agua de 3" marca honda y motor GX-160', categoria: 'Bomba de agua', serie: 'mod. JH168F & serie GCAAH3281663',     fechaCompra: new Date('2022-01-28'), montoCompra:  2000.00, tipo: 'LIVIANA', rentaDia: 400, rentaSemana: 1600, rentaMes: 4800 },
    { numeracion: '19', descripcion: 'Bomba de agua de 3" marca honda y motor GX-160', categoria: 'Bomba de agua', serie: 'mod. JH168F & serie GCAAH12103275',    fechaCompra: new Date('2022-01-28'), montoCompra:  2000.00, tipo: 'LIVIANA', rentaDia: 400, rentaSemana: 1600, rentaMes: 4800 },
    { numeracion: '29', descripcion: 'Bomba de agua de 3", Yamaha MZ 175',             categoria: 'Bomba de agua', serie: 'Q9CE-1012689',                         fechaCompra: new Date('2022-01-28'), montoCompra:   300.00, tipo: 'LIVIANA', rentaDia: 400, rentaSemana: 1600, rentaMes: 4800 },
    { numeracion: '56', descripcion: 'Bomba de agua de 2", marca EVANS',               categoria: 'Bomba de agua', serie: null,                                    fechaCompra: new Date('2022-10-01'), montoCompra:  4759.20, tipo: 'LIVIANA', rentaDia: 400, rentaSemana: 1600, rentaMes: 4800 },

    // ─── Bomba p/sólidos  (Q300/día · Q1200/semana · Q3600/mes) ───
    { numeracion: '21', descripcion: 'Bomba p/solidos de 2" TSURUMI PUMP & maguera de 17 ml', categoria: 'Bomba p/sólidos', serie: '1918238813',                    fechaCompra: new Date('2022-01-28'), montoCompra:  1500.00, tipo: 'LIVIANA', rentaDia: 300, rentaSemana: 1200, rentaMes: 3600 },
    { numeracion: '43', descripcion: 'Bomba p/solidos de 2" TSURUMI PUMP & maguera de 25 ml', categoria: 'Bomba p/sólidos', serie: 'HS2.4S & serie 20649169509',   fechaCompra: new Date('2022-01-28'), montoCompra:  2500.00, tipo: 'LIVIANA', rentaDia: 300, rentaSemana: 1200, rentaMes: 3600 },
    { numeracion: '70', descripcion: 'Bomba de agua para Semi-Sólidos de 2" EVANS',          categoria: 'Bomba p/sólidos', serie: null,                             fechaCompra: new Date('2024-08-16'), montoCompra:  4631.70, tipo: 'LIVIANA', rentaDia: 300, rentaSemana: 1200, rentaMes: 3600 },
    { numeracion: '72', descripcion: 'Bomba de Solidos Evans',                                categoria: 'Bomba p/sólidos', serie: 'serie No. 221202729',            fechaCompra: new Date('2025-02-21'), montoCompra:  4822.20, tipo: 'LIVIANA', rentaDia: 300, rentaSemana: 1200, rentaMes: 3600 },
    // Bomba p/sólidos 3"  (Q400/día · Q1600/semana · Q4800/mes)
    { numeracion: '42', descripcion: 'Bomba p/solidos de 3" TSURUMI PUMP & maguera de 25 ml', categoria: 'Bomba p/sólidos', serie: 'NK4-22 & serie 19646217001',  fechaCompra: new Date('2022-01-28'), montoCompra:  6500.00, tipo: 'LIVIANA', rentaDia: 400, rentaSemana: 1600, rentaMes: 4800 },

    // ─── Cortadora de concreto  (Q1000/día · Q4000/semana · Q12000/mes) ───
    { numeracion: '4',  descripcion: 'Cortadora de concreto Hoopt con motor honda GX-390', categoria: 'Cortadora de concreto', serie: 'GCAFH-1010404',        fechaCompra: new Date('2022-01-28'), montoCompra: 12000.00, tipo: 'LIVIANA', rentaDia: 1000, rentaSemana: 4000, rentaMes: 12000 },
    { numeracion: '26', descripcion: 'Cortadora de concreto Hoopt con motor honda GX-390', categoria: 'Cortadora de concreto', serie: 'mod. CGVCT1497164',    fechaCompra: new Date('2022-01-28'), montoCompra: 12000.00, tipo: 'LIVIANA', rentaDia: 1000, rentaSemana: 4000, rentaMes: 12000 },
    { numeracion: '71', descripcion: 'Cortadora de concreto Hoopt con motor honda GX-390', categoria: 'Cortadora de concreto', serie: null,                   fechaCompra: new Date('2024-11-29'), montoCompra: 12087.00, tipo: 'LIVIANA', rentaDia: 1000, rentaSemana: 4000, rentaMes: 12000 },

    // ─── Generador eléctrico  (Q400/día · Q1600/semana · Q4800/mes) ───
    { numeracion: '6',  descripcion: 'Generador marca Freedom de 2500 WT',   categoria: 'Generador eléctrico', serie: 'T53K00180-80104234',                      fechaCompra: new Date('2022-01-28'), montoCompra:  1000.00, tipo: 'LIVIANA', rentaDia: 400, rentaSemana: 1600, rentaMes: 4800 },
    { numeracion: '32', descripcion: 'Generador EVANS 9500 watts',           categoria: 'Generador eléctrico', serie: 'mod. MGT4106AE & serie 1812901046',       fechaCompra: new Date('2022-01-28'), montoCompra:  6000.00, tipo: 'LIVIANA', rentaDia: 400, rentaSemana: 1600, rentaMes: 4800 },
    { numeracion: '35', descripcion: 'Generador EVANS 4000 watts',           categoria: 'Generador eléctrico', serie: 'mod. MGT225G & serie 181203994',          fechaCompra: new Date('2022-01-28'), montoCompra:  2000.00, tipo: 'LIVIANA', rentaDia: 400, rentaSemana: 1600, rentaMes: 4800 },
    { numeracion: '37', descripcion: 'Generador EVANS 5500 watts',           categoria: 'Generador eléctrico', serie: 'mod. MGT3400 & serie No. 181204215',      fechaCompra: new Date('2022-01-28'), montoCompra:  3000.00, tipo: 'LIVIANA', rentaDia: 400, rentaSemana: 1600, rentaMes: 4800 },
    { numeracion: '41', descripcion: 'Generador powermate 3000 watts',       categoria: 'Generador eléctrico', serie: 'mod. R210E / serie No. M020000121',       fechaCompra: new Date('2022-01-28'), montoCompra:   500.00, tipo: 'LIVIANA', rentaDia: 400, rentaSemana: 1600, rentaMes: 4800 },
    { numeracion: '73', descripcion: 'Generador 3500W RGv3500 Robin',        categoria: 'Generador eléctrico', serie: 'serie: 22323V030150',                     fechaCompra: new Date('2025-02-21'), montoCompra:  3928.50, tipo: 'LIVIANA', rentaDia: 400, rentaSemana: 1600, rentaMes: 4800 },
    { numeracion: '75', descripcion: 'Generador Electrico Freedom',          categoria: 'Generador eléctrico', serie: 'serie: 1036206346',                        fechaCompra: new Date('2025-02-28'), montoCompra:  9300.00, tipo: 'LIVIANA', rentaDia: 400, rentaSemana: 1600, rentaMes: 4800 },

    // ─── Generador soldador  (Q650/día · Q2600/semana · Q7800/mes) ───
    { numeracion: '5',  descripcion: 'Generador Soldador marca Freedom WG 6500',               categoria: 'Generador soldador', serie: 'T61E120922180',                                    fechaCompra: new Date('2022-01-28'), montoCompra:  2500.00, tipo: 'LIVIANA', rentaDia: 650, rentaSemana: 2600, rentaMes: 7800 },
    { numeracion: '7',  descripcion: 'Generador Soldador marca Freedom WG 6500',               categoria: 'Generador soldador', serie: '188FT61E14120067574',                               fechaCompra: new Date('2022-01-28'), montoCompra:  2500.00, tipo: 'LIVIANA', rentaDia: 650, rentaSemana: 2600, rentaMes: 7800 },
    { numeracion: '15', descripcion: 'Generador soldador Welder GX390',                        categoria: 'Generador soldador', serie: 'mod. EDT5 & serie GCAA4180529',                     fechaCompra: new Date('2022-01-28'), montoCompra: 10000.00, tipo: 'LIVIANA', rentaDia: 650, rentaSemana: 2600, rentaMes: 7800 },
    { numeracion: '36', descripcion: 'Generador soldador Evans',                               categoria: 'Generador soldador', serie: 'mod. MGT460GAE & serie 181201130',                  fechaCompra: new Date('2022-01-28'), montoCompra:  7000.00, tipo: 'LIVIANA', rentaDia: 650, rentaSemana: 2600, rentaMes: 7800 },
    { numeracion: '61', descripcion: 'Generador Soldador marca EVANS con motor Thunder 18HP', categoria: 'Generador soldador', serie: 'serie No. 210408694 & No. W240MG1800THAE',          fechaCompra: new Date('2022-12-09'), montoCompra: 22928.50, tipo: 'LIVIANA', rentaDia: 650, rentaSemana: 2600, rentaMes: 7800 },

    // ─── Martillo demoledor  (Q500/día · Q2000/semana · Q6000/mes) ───
    { numeracion: '8',  descripcion: 'Martillo demoledor DEWALT de 30 kg', categoria: 'Martillo demoledor', serie: 'mod. 2017-35-11 / 17352668',      fechaCompra: new Date('2022-01-28'), montoCompra:  7000.00, tipo: 'LIVIANA', rentaDia: 500, rentaSemana: 2000, rentaMes: 6000 },
    { numeracion: '16', descripcion: 'Martillo demoledor DEWALT de 30 kg', categoria: 'Martillo demoledor', serie: 'mod. 2017-35-11 / 19115467',      fechaCompra: new Date('2022-01-28'), montoCompra:  7000.00, tipo: 'LIVIANA', rentaDia: 500, rentaSemana: 2000, rentaMes: 6000 },
    { numeracion: '31', descripcion: 'Martillo demoledor DEWALT de 30 kg', categoria: 'Martillo demoledor', serie: 'mod. 2017-35-11 / 13350660',      fechaCompra: new Date('2022-01-28'), montoCompra:  7000.00, tipo: 'LIVIANA', rentaDia: 500, rentaSemana: 2000, rentaMes: 6000 },
    { numeracion: '40', descripcion: 'Martillo demoledor DEWALT de 30 kg', categoria: 'Martillo demoledor', serie: 'mod. 2017-35-11 / 17352736',      fechaCompra: new Date('2022-01-28'), montoCompra:  7000.00, tipo: 'LIVIANA', rentaDia: 500, rentaSemana: 2000, rentaMes: 6000 },
    { numeracion: '52', descripcion: 'Martillo demoledor DEWALT de 30 kg', categoria: 'Martillo demoledor', serie: 'serie No. 2021-36-11006458',      fechaCompra: new Date('2022-04-23'), montoCompra: 15724.80, tipo: 'LIVIANA', rentaDia: 500, rentaSemana: 2000, rentaMes: 6000 },
    { numeracion: '53', descripcion: 'Martillo demoledor DEWALT de 30 kg', categoria: 'Martillo demoledor', serie: 'serie No. 2021-36-11006459',      fechaCompra: new Date('2022-04-23'), montoCompra: 15724.80, tipo: 'LIVIANA', rentaDia: 500, rentaSemana: 2000, rentaMes: 6000 },
    { numeracion: '79', descripcion: 'Martillo Demoledor Truper 30kg 2000W', categoria: 'Martillo demoledor', serie: null,                            fechaCompra: new Date('2025-08-27'), montoCompra:  6780.00, tipo: 'LIVIANA', rentaDia: 500, rentaSemana: 2000, rentaMes: 6000 },

    // ─── Medidor de presión  (Q200/día · Q800/semana · Q2400/mes) ───
    { numeracion: '27', descripcion: 'Medidor de presión SUPER EGO', categoria: 'Medidor de presión', serie: 'mod. RP50-S / serie 12073735', fechaCompra: new Date('2022-01-28'), montoCompra: 2500.00, tipo: 'LIVIANA', rentaDia: 200, rentaSemana: 800, rentaMes: 2400 },
    { numeracion: '78', descripcion: 'Medidor de presión PRÜFPUMPE',  categoria: 'Medidor de presión', serie: null,                         fechaCompra: new Date('2025-08-05'), montoCompra:  840.00, tipo: 'LIVIANA', rentaDia: 200, rentaSemana: 800, rentaMes: 2400 },

    // ─── Mezcladora  (Q400/día · Q1600/semana · Q4800/mes) ───
    { numeracion: '9',  descripcion: 'Mezcladora Rockman de 1.5 sacos', categoria: 'Mezcladora', serie: 'mod. GX270 / 0303481',              fechaCompra: new Date('2022-01-28'), montoCompra: 8000.00, tipo: 'LIVIANA', rentaDia: 400, rentaSemana: 1600, rentaMes: 4800 },
    { numeracion: '10', descripcion: 'Mezcladora Rockman de 1.5 sacos', categoria: 'Mezcladora', serie: 'mod. GX270 / 0336327',              fechaCompra: new Date('2022-01-28'), montoCompra: 8000.00, tipo: 'LIVIANA', rentaDia: 400, rentaSemana: 1600, rentaMes: 4800 },
    { numeracion: '11', descripcion: 'Mezcladora Rockman de 1.5 sacos', categoria: 'Mezcladora', serie: 'mod. GX270 / 0157811',              fechaCompra: new Date('2022-01-28'), montoCompra: 8000.00, tipo: 'LIVIANA', rentaDia: 400, rentaSemana: 1600, rentaMes: 4800 },
    { numeracion: '14', descripcion: 'Mezcladora Sirl GX160',           categoria: 'Mezcladora', serie: 'mod. JH1G8F & serie: GCAAH-5549003', fechaCompra: new Date('2022-01-28'), montoCompra: 8000.00, tipo: 'LIVIANA', rentaDia: 400, rentaSemana: 1600, rentaMes: 4800 },
    { numeracion: '38', descripcion: 'Mezcladora Sirl GX160',           categoria: 'Mezcladora', serie: 'mod. JH168F & serie GCAAH-5296849',  fechaCompra: new Date('2022-01-28'), montoCompra: 8000.00, tipo: 'LIVIANA', rentaDia: 400, rentaSemana: 1600, rentaMes: 4800 },
    { numeracion: '39', descripcion: 'Mezcladora Sirl GX160',           categoria: 'Mezcladora', serie: 'mod. JH168F & serie GCAAH-5549001',  fechaCompra: new Date('2022-01-28'), montoCompra: 8000.00, tipo: 'LIVIANA', rentaDia: 400, rentaSemana: 1600, rentaMes: 4800 },

    // ─── Plancha alizadora  (Q100/día · Q400/semana · Q1200/mes) ───
    { numeracion: '25', descripcion: 'Plancha alizadora de concreto', categoria: 'Plancha alizadora', serie: 'SN', fechaCompra: new Date('2022-01-28'), montoCompra: 100.00, tipo: 'LIVIANA', rentaDia: 100, rentaSemana: 400, rentaMes: 1200 },
    { numeracion: '33', descripcion: 'Plancha alizadora de concreto', categoria: 'Plancha alizadora', serie: 'SN', fechaCompra: new Date('2022-01-28'), montoCompra: 100.00, tipo: 'LIVIANA', rentaDia: 100, rentaSemana: 400, rentaMes: 1200 },

    // ─── Plato vibratorio  (Q300/día · Q1200/semana · Q3600/mes) ───
    { numeracion: '68', descripcion: 'Plato vibratorio HOPPT', categoria: 'Plato vibratorio', serie: 'serie No. 231220409', fechaCompra: new Date('2023-05-10'), montoCompra: 12963.60, tipo: 'LIVIANA', rentaDia: 300, rentaSemana: 1200, rentaMes: 3600 },

    // ─── Rastrío  (Q100/día · Q400/semana · Q1200/mes) ───
    { numeracion: '30', descripcion: 'Rastrío para concreto', categoria: 'Rastrío', serie: 'SN', fechaCompra: new Date('2022-01-28'), montoCompra:  100.00, tipo: 'LIVIANA', rentaDia: 100, rentaSemana: 400, rentaMes: 1200 },
    { numeracion: '34', descripcion: 'Rastrío para concreto', categoria: 'Rastrío', serie: 'SN', fechaCompra: new Date('2022-01-28'), montoCompra:  100.00, tipo: 'LIVIANA', rentaDia: 100, rentaSemana: 400, rentaMes: 1200 },
    { numeracion: '64', descripcion: 'Rastrío para concreto', categoria: 'Rastrío', serie: null, fechaCompra: new Date('2024-01-29'), montoCompra: 3073.50, tipo: 'LIVIANA', rentaDia: 100, rentaSemana: 400, rentaMes: 1200 },

    // ─── Compresor  (Q1500/día · Q6000/semana · Q18000/mes) ───
    { numeracion: '66', descripcion: 'Compresor Euler 185CFM TWT185D-7', categoria: 'Compresor', serie: 'serie: TWT001127-BNV4316', fechaCompra: new Date('2024-01-31'), montoCompra: 157084.20, tipo: 'LIVIANA', rentaDia: 1500, rentaSemana: 6000, rentaMes: 18000 },

    // ─── Barreno  (Q300/día · Q1200/semana · Q3600/mes) ───
    { numeracion: '28', descripcion: 'Barreno industrial DeWalt de 3/4", 1.19/16"', categoria: 'Barreno', serie: 'BR2 D2550', fechaCompra: new Date('2022-01-28'), montoCompra: 4000.00, tipo: 'LIVIANA', rentaDia: 300, rentaSemana: 1200, rentaMes: 3600 },

    // ─── Rodo compactador liviano  (Q600/día · Q2400/semana · Q7200/mes) ───
    { numeracion: '67', descripcion: 'Rodo Compactador Hoppt c/m honda 13HP',        categoria: 'Rodo compactador', serie: 'serie: 2312061024-1128831',     fechaCompra: new Date('2024-03-06'), montoCompra:  82755.90, tipo: 'LIVIANA', rentaDia: 600, rentaSemana: 2400, rentaMes: 7200 },
    { numeracion: '69', descripcion: 'Rodo compactador Hyundai',                     categoria: 'Rodo compactador', serie: null,                            fechaCompra: new Date('2024-06-29'), montoCompra:  50934.96, tipo: 'LIVIANA', rentaDia: 600, rentaSemana: 2400, rentaMes: 7200 },
    { numeracion: '77', descripcion: 'Rodo No Tripulado ROL650PH Hoppt c/m Honda 13HP', categoria: 'Rodo compactador', serie: 'serie: 2312061023-112826',   fechaCompra: new Date('2025-07-09'), montoCompra:  82755.90, tipo: 'LIVIANA', rentaDia: 600, rentaSemana: 2400, rentaMes: 7200 },
    { numeracion: '80', descripcion: 'Rodo No Tripulado ROL650PH Hoppt c/m Honda 13HP', categoria: 'Rodo compactador', serie: 'serie: 2503221176-1357700',  fechaCompra: new Date('2025-09-25'), montoCompra: 827500.90, tipo: 'LIVIANA', rentaDia: 600, rentaSemana: 2400, rentaMes: 7200 },

    // ─── Vibrador de concreto  (Q350/día · Q1400/semana · Q4200/mes) ───
    { numeracion: '17', descripcion: 'Vibrador de concreto GUASUECA con motor honda GX160', categoria: 'Vibrador de concreto', serie: 'GCAAH5305643',     fechaCompra: new Date('2022-01-28'), montoCompra: 1500.00, tipo: 'LIVIANA', rentaDia: 350, rentaSemana: 1400, rentaMes: 4200 },
    { numeracion: '20', descripcion: 'Vibrador de concreto Weber MT con motor honda GX160', categoria: 'Vibrador de concreto', serie: 'GCABT4536120',     fechaCompra: new Date('2022-01-28'), montoCompra: 2500.00, tipo: 'LIVIANA', rentaDia: 350, rentaSemana: 1400, rentaMes: 4200 },
    { numeracion: '22', descripcion: 'Vibrador de concreto Weber MT con motor honda GX160', categoria: 'Vibrador de concreto', serie: 'GCABT4342965',     fechaCompra: new Date('2022-01-28'), montoCompra: 2500.00, tipo: 'LIVIANA', rentaDia: 350, rentaSemana: 1400, rentaMes: 4200 },
    { numeracion: '23', descripcion: 'Vibrador de concreto Weber MT con motor honda GX160', categoria: 'Vibrador de concreto', serie: 'GCABT-4589499',    fechaCompra: new Date('2022-01-28'), montoCompra: 2500.00, tipo: 'LIVIANA', rentaDia: 350, rentaSemana: 1400, rentaMes: 4200 },
    { numeracion: '24', descripcion: 'Vibrador de concreto GUASUECA con motor honda GX160', categoria: 'Vibrador de concreto', serie: 'JH1G8F-5305649',   fechaCompra: new Date('2022-01-28'), montoCompra: 1500.00, tipo: 'LIVIANA', rentaDia: 350, rentaSemana: 1400, rentaMes: 4200 },

    // ─── Montacarga manual liviana  (Q150/día · Q600/semana · Q1800/mes) ───
    { numeracion: '63', descripcion: 'Montacarga manual marca INGCO', categoria: 'Montacarga', serie: null, fechaCompra: new Date('2024-01-27'), montoCompra: 3800.00, tipo: 'LIVIANA', rentaDia: 150, rentaSemana: 600, rentaMes: 1800 },

    // ─── Helicóptero  (Q500/día · Q2000/semana · Q6000/mes) ───
    { numeracion: '65', descripcion: 'Helicoptero TOL100GB HOPPT con motor HONDA 5.5HP', categoria: 'Helicóptero', serie: 'serie: 18B051159-1027681', fechaCompra: new Date('2024-01-30'), montoCompra: 14137.20, tipo: 'LIVIANA', rentaDia: 500, rentaSemana: 2000, rentaMes: 6000 },

    // ══════════════════════════════════════════
    //  MAQUINARIA PESADA
    // ══════════════════════════════════════════
    { numeracion: 'MP01', descripcion: 'Retroexcavadora CASE 580N',   categoria: 'Retroexcavadora', serie: 'serie: JJGN58NRCLC771510 & motor: 1728119',           fechaCompra: new Date('2020-12-04'), montoCompra: 500000.00, tipo: 'PESADA', rentaHora: 475, rentaHoraMartillo: 650, rentaDia: null, rentaSemana: null, rentaMes: null },
    { numeracion: 'MP02', descripcion: 'Rodo compactador CASE DV36',  categoria: 'Rodo compactador', serie: 'serie: NHNTV0108 & motor: W7885',                             fechaCompra: new Date('2022-02-24'), montoCompra: 250000.00, tipo: 'PESADA', rentaHora: 325, rentaDia: null, rentaSemana: null, rentaMes: null },
    { numeracion: 'MP04', descripcion: 'Montacarga',                   categoria: 'Montacarga',       serie: null,                                                         fechaCompra: new Date('2023-10-04'), montoCompra: 327600.00, tipo: 'PESADA', rentaHora: 350, rentaDia: null, rentaSemana: null, rentaMes: null },
    { numeracion: 'MP05', descripcion: 'Minicargador CASE SR250B',     categoria: 'Minicargador',     serie: 'MODELO: SR250B SERIE: JAFSR250VPM446786 & MOTOR: 1025722',  fechaCompra: new Date('2024-07-04'), montoCompra: 472420.00, tipo: 'PESADA', rentaHora: 350, rentaDia: null, rentaSemana: null, rentaMes: null },
    { numeracion: 'MP06', descripcion: 'Minicargador CASE SR220B',     categoria: 'Minicargador',     serie: 'MODELO: SR220B SERIE: JAFSR220CPM450582 MOTOR: 1035944',    fechaCompra: new Date('2025-03-25'), montoCompra: 429112.20, tipo: 'PESADA', rentaHora: 350, rentaDia: null, rentaSemana: null, rentaMes: null },
    { numeracion: 'MP07', descripcion: 'Retroexcavadora Case 580N',   categoria: 'Retroexcavadora', serie: 'serie: JJGN58NRJRC787598 No. de Motor: 2194620',              fechaCompra: new Date('2025-08-08'), montoCompra: 890000.00, tipo: 'PESADA', rentaHora: 475, rentaHoraMartillo: 650, rentaDia: null, rentaSemana: null, rentaMes: null },

    // ══════════════════════════════════════════
    //  EQUIPO USO PROPIO
    // ══════════════════════════════════════════
    { numeracion: '12', descripcion: 'Motosierra Stihl MS361',             categoria: 'Motosierra',         serie: 'SN',                                      fechaCompra: new Date('2022-01-28'), montoCompra: 1500.00,  tipo: 'USO_PROPIO', rentaDia: null, rentaSemana: null, rentaMes: null },
    { numeracion: '13', descripcion: 'Motosierra Stihl MS780',             categoria: 'Motosierra',         serie: 'SN',                                      fechaCompra: new Date('2022-01-28'), montoCompra: 4000.00,  tipo: 'USO_PROPIO', rentaDia: null, rentaSemana: null, rentaMes: null },
    { numeracion: '46', descripcion: 'Hidrolavadora HIDROCAMPO',           categoria: 'Hidrolavadora',      serie: 'mod. HPWQP750 serie No. DH225090549420',   fechaCompra: new Date('2022-01-28'), montoCompra: 1500.00,  tipo: 'USO_PROPIO', rentaDia: null, rentaSemana: null, rentaMes: null },
    { numeracion: '50', descripcion: 'Chapeadora trupper DES-63',          categoria: 'Chapeadora',         serie: 'SN',                                      fechaCompra: new Date('2022-01-28'), montoCompra: 2000.00,  tipo: 'USO_PROPIO', rentaDia: null, rentaSemana: null, rentaMes: null },
    { numeracion: '51', descripcion: 'Sopladora marca Truper',             categoria: 'Sopladora',          serie: 'SN',                                      fechaCompra: new Date('2022-03-05'), montoCompra: 1800.00,  tipo: 'USO_PROPIO', rentaDia: null, rentaSemana: null, rentaMes: null },
    { numeracion: '62', descripcion: 'Compresor de aire lubricado de 50 lbs', categoria: 'Compresor',      serie: null,                                      fechaCompra: new Date('2023-01-10'), montoCompra: 1560.00,  tipo: 'USO_PROPIO', rentaDia: null, rentaSemana: null, rentaMes: null },
    { numeracion: '76', descripcion: 'Regla vibratoria',                   categoria: 'Regla vibratoria',   serie: 'serie: 22102064-7002930',                  fechaCompra: new Date('2025-05-22'), montoCompra: 8596.80,  tipo: 'USO_PROPIO', rentaDia: null, rentaSemana: null, rentaMes: null },

    // ══════════════════════════════════════════
    //  DADOS DE BAJA
    // ══════════════════════════════════════════
    { numeracion: '44',  descripcion: 'Plato vibratorio WOLKAN mod. PV1500',             categoria: 'Plato vibratorio', serie: 'serie 209546',                               fechaCompra: new Date('2022-01-28'), montoCompra:  10000.00, tipo: 'LIVIANA', rentaDia: 300, rentaSemana: 1200, rentaMes: 3600, isActive: false, motivoBaja: 'Dado de baja tras ser robado',                   fechaBaja: new Date('2022-01-28') },
    { numeracion: '45',  descripcion: 'Plato vibratorio WOLKAN',                         categoria: 'Plato vibratorio', serie: null,                                         fechaCompra: new Date('2022-01-28'), montoCompra:  10000.00, tipo: 'LIVIANA', rentaDia: 300, rentaSemana: 1200, rentaMes: 3600, isActive: false, motivoBaja: 'Dado de baja tras ser robado',                   fechaBaja: new Date('2022-01-28') },
    { numeracion: '74',  descripcion: 'Rodo No Tripulado ROL650PH Hoppt c/m Honda 13HP', categoria: 'Rodo compactador', serie: 'serie: 2312061025-1165179',                   fechaCompra: new Date('2025-02-21'), montoCompra:  87261.47, tipo: 'LIVIANA', rentaDia: 600, rentaSemana: 2400, rentaMes: 7200, isActive: false, motivoBaja: 'Dado de baja tras ser vendida a Otto Perez',     fechaBaja: new Date('2025-02-21') },
    { numeracion: 'MP03', descripcion: 'Minicargador CASE SR220B',                       categoria: 'Minicargador',     serie: 'serie: JAFSR220LMM407232 & motor: 614722',   fechaCompra: new Date('2022-03-24'), montoCompra: 325000.00, tipo: 'PESADA',   rentaDia: null, rentaSemana: null, rentaMes: null,       isActive: false, motivoBaja: 'Dado de baja tras ser vendida a Otto Perez',     fechaBaja: new Date('2022-03-24') },
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
      'Bailarina',         'Bomba de agua',          'Bomba p/sólidos',
      'Cortadora de concreto', 'Generador eléctrico', 'Generador soldador',
      'Martillo demoledor', 'Medidor de presión',     'Mezcladora',
      'Plancha alizadora', 'Plato vibratorio',        'Rastrío',
      'Compresor',         'Barreno',                 'Rodo compactador',
      'Vibrador de concreto', 'Montacarga',            'Helicóptero',
    ],
    PESADA: [
      'Retroexcavadora', 'Rodo compactador', 'Montacarga', 'Minicargador',
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
    await prisma.equipo.upsert({
      where:  { numeracion: e.numeracion },
      update: {},
      create: {
        numeracion:        e.numeracion,
        descripcion:       e.descripcion,
        serie:             e.serie,
        fechaCompra:       e.fechaCompra,
        montoCompra:       e.montoCompra,
        tipoId:            tipoMap[e.tipo],
        categoriaId:       categoriaMap.get(`${e.categoria}|${e.tipo}`) ?? null,
        rentaHora:         e.rentaHora         ?? null,
        rentaHoraMartillo: e.rentaHoraMartillo ?? null,
        rentaDia:          e.rentaDia,
        rentaSemana:       e.rentaSemana,
        rentaMes:          e.rentaMes,
        isActive:          e.isActive   ?? true,
        motivoBaja:        e.motivoBaja ?? null,
        fechaBaja:         e.fechaBaja  ?? null,
      },
    });
  }
  console.log(`  ${equiposData.length} equipos listos`);

  // 5. Configuración de precios de granel
  console.log('\nCreando configuración de precios de granel...');
  await prisma.configGranel.upsert({
    where:  { tipo: 'PUNTAL' },
    update: {},
    create: { tipo: 'PUNTAL', rentaDia: 1.5, rentaSemana: 5, rentaMes: 15 },
  });
  await prisma.configGranel.upsert({
    where:  { tipo: 'ANDAMIO_SIMPLE' },
    update: {},
    create: {
      tipo: 'ANDAMIO_SIMPLE',
      rentaDia: 3, rentaSemana: 10, rentaMes: 30,
      rentaDiaConMadera: 5, rentaSemanaConMadera: 16, rentaMesConMadera: 48,
    },
  });
  await prisma.configGranel.upsert({
    where:  { tipo: 'ANDAMIO_RUEDAS' },
    update: {},
    create: { tipo: 'ANDAMIO_RUEDAS', rentaDia: 5, rentaSemana: 18, rentaMes: 54 },
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
