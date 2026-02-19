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

  const colaboradorRole = await prisma.role.upsert({
    where: { nombre: 'colaborador' },
    update: {},
    create: {
      nombre: 'colaborador',
      descripcion: 'Colaborador - Solicita creditos y efectivo',
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

  // Usuario Colaborador
  const colaboradorPassword = await bcrypt.hash('Colab123!', 12);
  await prisma.usuario.upsert({
    where: { username: 'colaborador' },
    update: {},
    create: {
      username: 'colaborador',
      password: colaboradorPassword,
      nombre: 'Carlos Ruiz',
      telefono: '55559012',
      roleId: colaboradorRole.id,
    },
  });
  console.log('  - Colaborador creado');

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
  
  console.log('COLABORADOR:');
  console.log('   Usuario:    colaborador');
  console.log('   Contrasena: Colab123!\n');
  
  console.log('ENCARGADO MAQUINAS:');
  console.log('   Usuario:    encargado');
  console.log('   Contrasena: Encar123!\n');
  
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
