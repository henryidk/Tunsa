-- Paso 1: renombrar renta_hora → "rentaHora" para alinearlo con la
--         convención camelCase que usan las demás columnas (rentaDia, rentaSemana, rentaMes).
ALTER TABLE "equipos" RENAME COLUMN "renta_hora" TO "rentaHora";

-- Paso 2: limpieza de precios incompatibles por tipo de equipo.
--
-- Reglas de negocio:
--   PESADA     → solo "rentaHora"; rentaDia/rentaSemana/rentaMes siempre NULL.
--   LIVIANA    → solo rentaDia/rentaSemana/rentaMes; "rentaHora" siempre NULL.
--   USO_PROPIO → sin precios de renta; todos NULL.

UPDATE "equipos"
SET "rentaDia"    = NULL,
    "rentaSemana" = NULL,
    "rentaMes"    = NULL
WHERE "tipo_id" = 'tipo_pesada';

UPDATE "equipos"
SET "rentaHora" = NULL
WHERE "tipo_id" = 'tipo_liviana';

UPDATE "equipos"
SET "rentaHora"   = NULL,
    "rentaDia"    = NULL,
    "rentaSemana" = NULL,
    "rentaMes"    = NULL
WHERE "tipo_id" = 'tipo_uso';
