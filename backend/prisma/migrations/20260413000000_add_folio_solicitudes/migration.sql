-- Tabla de secuencias mensuales para generación atómica de folios
CREATE TABLE "folio_secuencias" (
  "mesAnio" TEXT NOT NULL,
  "ultimo"  INTEGER NOT NULL DEFAULT 0,
  CONSTRAINT "folio_secuencias_pkey" PRIMARY KEY ("mesAnio")
);

-- Campo folio en solicitudes — nullable, asignado al aprobar
ALTER TABLE "solicitudes" ADD COLUMN "folio" TEXT;
ALTER TABLE "solicitudes" ADD CONSTRAINT "solicitudes_folio_key" UNIQUE ("folio");
