/**
 * Migración: refactor_tipos_categorias
 *
 * Convierte:
 *   - Equipo.tipo (enum) + Equipo.categoria (string) → tipoId FK + categoriaId FK
 *   - Categoria (tabla suelta) → relacion real con TipoEquipo
 *   - Nueva tabla tipos_equipo como entidad padre
 *   - FK compuesta en equipos para garantizar que categoria.tipo == equipo.tipo
 *
 * Ejecutar desde /backend: node migrate-tipos-categorias.js
 */

const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function migrate() {
  console.log('=== Migración: refactor_tipos_categorias ===\n');

  await prisma.$transaction(async (tx) => {

    // ── 1. Tabla tipos_equipo ──────────────────────────────────────────────
    console.log('Creando tabla tipos_equipo...');
    await tx.$executeRawUnsafe(`
      CREATE TABLE "tipos_equipo" (
        "id"          TEXT         NOT NULL,
        "nombre"      TEXT         NOT NULL,
        "descripcion" TEXT,
        "createdAt"   TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
        CONSTRAINT "tipos_equipo_pkey" PRIMARY KEY ("id")
      )
    `);
    await tx.$executeRawUnsafe(`
      CREATE UNIQUE INDEX "tipos_equipo_nombre_key" ON "tipos_equipo"("nombre")
    `);

    // IDs fijos (legibles) para registros de sistema
    await tx.$executeRawUnsafe(`
      INSERT INTO "tipos_equipo" ("id", "nombre", "descripcion") VALUES
        ('tipo_liviana', 'LIVIANA',    'Maquinaria liviana'),
        ('tipo_pesada',  'PESADA',     'Maquinaria pesada'),
        ('tipo_uso',     'USO_PROPIO', 'Equipo de uso interno')
    `);
    console.log('  ✓ tipos_equipo: LIVIANA, PESADA, USO_PROPIO');

    // ── 2. Evolución de categorias ─────────────────────────────────────────
    console.log('Actualizando tabla categorias...');

    await tx.$executeRawUnsafe(`ALTER TABLE "categorias" ADD COLUMN "tipo_id" TEXT`);

    // Quitar unique antiguo en solo nombre
    await tx.$executeRawUnsafe(`DROP INDEX IF EXISTS "categorias_nombre_key"`);

    // Asignar tipo a cada categoría (exclusivas)
    await tx.$executeRawUnsafe(`
      UPDATE "categorias" SET "tipo_id" = 'tipo_liviana' WHERE "nombre" IN (
        'Bailarina','Bomba de agua','Bomba p/sólidos','Cortadora de concreto',
        'Generador eléctrico','Generador soldador','Martillo demoledor',
        'Medidor de presión','Mezcladora','Plancha alizadora','Plato vibratorio',
        'Rastrillo','Rastrío','Barreno','Barreno industrial','Vibrador de concreto',
        'Montacarga manual','Helicóptero','Puntales'
      )
    `);
    await tx.$executeRawUnsafe(`
      UPDATE "categorias" SET "tipo_id" = 'tipo_pesada'
      WHERE "nombre" IN ('Retroexcavadora','Minicargador','Montacarga')
    `);
    await tx.$executeRawUnsafe(`
      UPDATE "categorias" SET "tipo_id" = 'tipo_uso'
      WHERE "nombre" IN ('Motosierra','Hidrolavadora','Chapeadora','Sopladora','Regla vibratoria')
    `);

    // "Compresor" existe en LIVIANA (renta) y USO_PROPIO: la fila existente → LIVIANA, nueva → USO_PROPIO
    await tx.$executeRawUnsafe(`UPDATE "categorias" SET "tipo_id" = 'tipo_liviana' WHERE "nombre" = 'Compresor'`);
    await tx.$executeRawUnsafe(`
      INSERT INTO "categorias" ("id","nombre","tipo_id","createdAt")
      VALUES (replace(gen_random_uuid()::text,'-',''), 'Compresor', 'tipo_uso', CURRENT_TIMESTAMP)
    `);

    // "Rodo compactador" existe en LIVIANA (pequeños) y PESADA (CASE DV36)
    await tx.$executeRawUnsafe(`UPDATE "categorias" SET "tipo_id" = 'tipo_liviana' WHERE "nombre" = 'Rodo compactador'`);
    await tx.$executeRawUnsafe(`
      INSERT INTO "categorias" ("id","nombre","tipo_id","createdAt")
      VALUES (replace(gen_random_uuid()::text,'-',''), 'Rodo compactador', 'tipo_pesada', CURRENT_TIMESTAMP)
    `);

    // NOT NULL en tipo_id
    await tx.$executeRawUnsafe(`ALTER TABLE "categorias" ALTER COLUMN "tipo_id" SET NOT NULL`);

    // FK categorias → tipos_equipo (onDelete: RESTRICT para no borrar un tipo con categorías)
    await tx.$executeRawUnsafe(`
      ALTER TABLE "categorias"
        ADD CONSTRAINT "categorias_tipo_id_fkey"
        FOREIGN KEY ("tipo_id") REFERENCES "tipos_equipo"("id")
        ON DELETE RESTRICT ON UPDATE CASCADE
    `);

    // @@unique([nombre, tipoId]) — nombre único dentro de cada tipo
    await tx.$executeRawUnsafe(`
      CREATE UNIQUE INDEX "categorias_nombre_tipo_id_key" ON "categorias"("nombre","tipo_id")
    `);
    // @@unique([id, tipoId]) — habilita la FK compuesta desde equipos
    await tx.$executeRawUnsafe(`
      CREATE UNIQUE INDEX "categorias_id_tipo_id_key" ON "categorias"("id","tipo_id")
    `);
    await tx.$executeRawUnsafe(`
      CREATE INDEX "categorias_tipo_id_idx" ON "categorias"("tipo_id")
    `);
    console.log('  ✓ categorias: tipo_id FK, duplicados gestionados (Compresor, Rodo compactador)');

    // ── 3. Evolución de equipos ────────────────────────────────────────────
    console.log('Actualizando tabla equipos...');

    await tx.$executeRawUnsafe(`ALTER TABLE "equipos" ADD COLUMN "tipo_id"      TEXT`);
    await tx.$executeRawUnsafe(`ALTER TABLE "equipos" ADD COLUMN "categoria_id" TEXT`);

    // Poblar tipo_id desde el enum antiguo
    await tx.$executeRawUnsafe(`UPDATE "equipos" SET "tipo_id" = 'tipo_liviana' WHERE "tipo"::text = 'LIVIANA'`);
    await tx.$executeRawUnsafe(`UPDATE "equipos" SET "tipo_id" = 'tipo_pesada'  WHERE "tipo"::text = 'PESADA'`);
    await tx.$executeRawUnsafe(`UPDATE "equipos" SET "tipo_id" = 'tipo_uso'     WHERE "tipo"::text = 'USO_PROPIO'`);

    // Poblar categoria_id cruzando (nombre, tipo_id) — maneja categorías con mismo nombre en distintos tipos
    await tx.$executeRawUnsafe(`
      UPDATE "equipos" e
      SET "categoria_id" = c."id"
      FROM "categorias" c
      WHERE e."categoria" = c."nombre"
        AND c."tipo_id"   = e."tipo_id"
    `);

    // NOT NULL en tipo_id
    await tx.$executeRawUnsafe(`ALTER TABLE "equipos" ALTER COLUMN "tipo_id" SET NOT NULL`);

    // FK equipos → tipos_equipo
    await tx.$executeRawUnsafe(`
      ALTER TABLE "equipos"
        ADD CONSTRAINT "equipos_tipo_id_fkey"
        FOREIGN KEY ("tipo_id") REFERENCES "tipos_equipo"("id")
        ON DELETE RESTRICT ON UPDATE CASCADE
    `);

    // FK equipos → categorias (simple, onDelete: SET NULL para desasociar sin borrar equipo)
    await tx.$executeRawUnsafe(`
      ALTER TABLE "equipos"
        ADD CONSTRAINT "equipos_categoria_id_fkey"
        FOREIGN KEY ("categoria_id") REFERENCES "categorias"("id")
        ON DELETE SET NULL ON UPDATE CASCADE
    `);

    // FK COMPUESTA: garantiza que categoria.tipoId == equipo.tipoId a nivel de base de datos
    // DEFERRABLE INITIALLY DEFERRED: se verifica al final del commit, no línea a línea
    await tx.$executeRawUnsafe(`
      ALTER TABLE "equipos"
        ADD CONSTRAINT "equipos_categoria_tipo_consistencia"
        FOREIGN KEY ("categoria_id","tipo_id") REFERENCES "categorias"("id","tipo_id")
        DEFERRABLE INITIALLY DEFERRED
    `);

    // Eliminar columnas antiguas
    await tx.$executeRawUnsafe(`ALTER TABLE "equipos" DROP COLUMN "tipo"`);
    await tx.$executeRawUnsafe(`ALTER TABLE "equipos" DROP COLUMN "categoria"`);

    // Limpiar índices viejos
    await tx.$executeRawUnsafe(`DROP INDEX IF EXISTS "equipos_tipo_idx"`);
    await tx.$executeRawUnsafe(`DROP INDEX IF EXISTS "equipos_categoria_idx"`);

    // Nuevos índices
    await tx.$executeRawUnsafe(`CREATE INDEX "equipos_tipo_id_idx"      ON "equipos"("tipo_id")`);
    await tx.$executeRawUnsafe(`CREATE INDEX "equipos_categoria_id_idx" ON "equipos"("categoria_id")`);

    console.log('  ✓ equipos: tipo_id FK, categoria_id FK, FK compuesta de consistencia');

    // ── 4. Eliminar enum antiguo ───────────────────────────────────────────
    await tx.$executeRawUnsafe(`DROP TYPE IF EXISTS "TipoMaquinaria"`);
    console.log('  ✓ enum TipoMaquinaria eliminado');

  }, { timeout: 60000 });

  // ── Verificación post-migración ───────────────────────────────────────────
  const [tipos, categorias, equiposSinTipo] = await Promise.all([
    prisma.$queryRawUnsafe(`SELECT id, nombre FROM tipos_equipo ORDER BY nombre`),
    prisma.$queryRawUnsafe(`SELECT c.nombre, t.nombre AS tipo FROM categorias c JOIN tipos_equipo t ON t.id = c.tipo_id ORDER BY t.nombre, c.nombre`),
    prisma.$queryRawUnsafe(`SELECT COUNT(*) FROM equipos WHERE tipo_id IS NULL`),
  ]);

  console.log('\n=== Resultado ===');
  console.log('Tipos creados:', tipos.map(t => t.nombre).join(', '));
  console.log(`Categorías total: ${categorias.length}`);
  console.log(`Equipos sin tipo_id: ${equiposSinTipo[0].count} (debe ser 0)`);
  console.log('\n✅ Migración completada exitosamente.');
}

migrate()
  .catch(e => { console.error('\n❌ Error en migración (rollback automático):', e.message); process.exit(1); })
  .finally(() => prisma.$disconnect());
