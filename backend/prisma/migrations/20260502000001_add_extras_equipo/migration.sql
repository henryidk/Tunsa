-- Eliminar columna rentaHoraMartillo (reemplazada por extras_equipo)
ALTER TABLE "equipos" DROP COLUMN IF EXISTS "rentaHoraMartillo";

-- Catálogo de tipos de extra (Martillo, Pluma hidráulica, etc.)
CREATE TABLE "tipos_extra" (
    "id"          TEXT NOT NULL,
    "nombre"      TEXT NOT NULL,
    "descripcion" TEXT,
    "createdAt"   TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt"   TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "tipos_extra_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "tipos_extra_nombre_key" ON "tipos_extra"("nombre");

-- Precio de un extra concreto para un equipo concreto
CREATE TABLE "extras_equipo" (
    "id"          TEXT NOT NULL,
    "equipoId"    TEXT NOT NULL,
    "tipoExtraId" TEXT NOT NULL,
    "rentaHora"   DECIMAL(10,2) NOT NULL,
    CONSTRAINT "extras_equipo_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "extras_equipo_equipoId_tipoExtraId_key" ON "extras_equipo"("equipoId", "tipoExtraId");
CREATE INDEX "extras_equipo_equipoId_idx" ON "extras_equipo"("equipoId");
ALTER TABLE "extras_equipo" ADD CONSTRAINT "extras_equipo_equipoId_fkey"
    FOREIGN KEY ("equipoId") REFERENCES "equipos"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "extras_equipo" ADD CONSTRAINT "extras_equipo_tipoExtraId_fkey"
    FOREIGN KEY ("tipoExtraId") REFERENCES "tipos_extra"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
