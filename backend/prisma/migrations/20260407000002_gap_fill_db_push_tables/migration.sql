-- Gap-fill: tables and schema changes that were applied via db push without migration files.
-- Reconstructs those changes so the shadow database can validate schema.prisma.

-- ── 1. ModalidadTipo enum (used by tipos_equipo.modalidad) ───────────────────
CREATE TYPE "ModalidadTipo" AS ENUM ('LIVIANA', 'PESADA', 'USO_PROPIO');

-- ── 2. tipos_equipo ──────────────────────────────────────────────────────────
CREATE TABLE "tipos_equipo" (
    "id"          TEXT NOT NULL,
    "nombre"      TEXT NOT NULL,
    "descripcion" TEXT,
    "createdAt"   TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "modalidad"   "ModalidadTipo" NOT NULL DEFAULT 'USO_PROPIO',
    CONSTRAINT "tipos_equipo_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "tipos_equipo_nombre_key" ON "tipos_equipo"("nombre");

-- ── 3. clientes ──────────────────────────────────────────────────────────────
-- UNIQUE on telefono is added later by 20260429000001_unique_telefono_cliente
CREATE TABLE "clientes" (
    "id"           TEXT NOT NULL,
    "nombre"       TEXT NOT NULL,
    "dpi"          TEXT NOT NULL,
    "telefono"     TEXT,
    "documentoKey" TEXT,
    "createdAt"    TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt"    TIMESTAMP(3) NOT NULL,
    CONSTRAINT "clientes_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "clientes_dpi_key"   ON "clientes"("dpi");
CREATE INDEX        "clientes_nombre_idx" ON "clientes"("nombre");

-- ── 4. bitacoras ─────────────────────────────────────────────────────────────
CREATE TABLE "bitacoras" (
    "id"            TEXT NOT NULL,
    "modulo"        TEXT NOT NULL,
    "entidadId"     TEXT NOT NULL,
    "entidadNombre" TEXT NOT NULL,
    "campo"         TEXT NOT NULL,
    "valorAnterior" TEXT,
    "valorNuevo"    TEXT,
    "realizadoPor"  TEXT NOT NULL,
    "createdAt"     TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "bitacoras_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "bitacoras_createdAt_id_idx"        ON "bitacoras"("createdAt", id);
CREATE INDEX "bitacoras_entidadId_idx"           ON "bitacoras"("entidadId");
CREATE INDEX "bitacoras_modulo_createdAt_id_idx" ON "bitacoras"("modulo", "createdAt", id);

-- ── 5. lotes_granel ──────────────────────────────────────────────────────────
-- Requires TipoGranel enum from 20260406000000_baseline_config_granel
CREATE TABLE "lotes_granel" (
    "id"             TEXT NOT NULL,
    "tipo"           "TipoGranel" NOT NULL,
    "descripcion"    TEXT NOT NULL,
    "cantidad"       INTEGER NOT NULL,
    "precioUnitario" DECIMAL(10,2) NOT NULL,
    "fechaCompra"    DATE,
    "ubicacion"      TEXT,
    "isActive"       BOOLEAN NOT NULL DEFAULT true,
    "createdAt"      TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt"      TIMESTAMP(3) NOT NULL,
    CONSTRAINT "lotes_granel_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "lotes_granel_tipo_isActive_idx" ON "lotes_granel"("tipo", "isActive");

-- ── 6. Drop puntales (removed via db push; no longer in schema.prisma) ───────
DROP TABLE "puntales";

-- ── 7. Restructure categorias: add tipo_id FK, replace unique index ──────────
ALTER TABLE "categorias" ADD COLUMN "tipo_id" TEXT NOT NULL;
DROP INDEX "categorias_nombre_key";
CREATE UNIQUE INDEX "categorias_id_tipo_id_key"     ON "categorias"("id", "tipo_id");
CREATE UNIQUE INDEX "categorias_nombre_tipo_id_key" ON "categorias"("nombre", "tipo_id");
CREATE INDEX        "categorias_tipo_id_idx"        ON "categorias"("tipo_id");
ALTER TABLE "categorias" ADD CONSTRAINT "categorias_tipo_id_fkey"
    FOREIGN KEY ("tipo_id") REFERENCES "tipos_equipo"("id") ON UPDATE CASCADE ON DELETE RESTRICT;

-- ── 8. Restructure equipos: replace tipo+categoria with FK columns ────────────
ALTER TABLE "equipos"
    DROP COLUMN "tipo",
    DROP COLUMN "categoria",
    ADD COLUMN  "tipo_id"      TEXT NOT NULL,
    ADD COLUMN  "categoria_id" TEXT;

ALTER TABLE "equipos"
    ALTER COLUMN "fechaCompra" TYPE DATE USING "fechaCompra"::DATE,
    ALTER COLUMN "fechaBaja"   TYPE DATE USING "fechaBaja"::DATE;

-- equipos_categoria_idx and equipos_tipo_idx are auto-dropped by PostgreSQL
-- when their respective columns are dropped above.
DROP INDEX "equipos_isActive_idx";

CREATE INDEX "equipos_categoria_id_idx"       ON "equipos"("categoria_id");
CREATE INDEX "equipos_tipo_id_idx"            ON "equipos"("tipo_id");
CREATE INDEX "equipos_isActive_createdAt_idx" ON "equipos"("isActive", "createdAt");

ALTER TABLE "equipos" ADD CONSTRAINT "equipos_tipo_id_fkey"
    FOREIGN KEY ("tipo_id") REFERENCES "tipos_equipo"("id") ON UPDATE CASCADE ON DELETE RESTRICT;
ALTER TABLE "equipos" ADD CONSTRAINT "equipos_categoria_id_fkey"
    FOREIGN KEY ("categoria_id") REFERENCES "categorias"("id") ON UPDATE CASCADE ON DELETE SET NULL;

DROP TYPE "TipoMaquinaria";
