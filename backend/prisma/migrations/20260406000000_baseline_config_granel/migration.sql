-- Baseline: enum TipoGranel y tabla config_granel
-- Creados originalmente via db push sin archivo de migración.

CREATE TYPE "TipoGranel" AS ENUM ('PUNTAL', 'ANDAMIO_SIMPLE', 'ANDAMIO_RUEDAS');

CREATE TABLE "config_granel" (
    "tipo"        "TipoGranel"    NOT NULL,
    "rentaDia"    DECIMAL(10,2)   NOT NULL,
    "rentaSemana" DECIMAL(10,2)   NOT NULL,
    "rentaMes"    DECIMAL(10,2)   NOT NULL,
    "updatedAt"   TIMESTAMP(3)    NOT NULL,

    CONSTRAINT "config_granel_pkey" PRIMARY KEY ("tipo")
);
