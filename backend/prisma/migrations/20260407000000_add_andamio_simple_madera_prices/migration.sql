-- AlterTable: add optional "con madera" price fields to config_granel
-- Only relevant for ANDAMIO_SIMPLE rows; NULL for all other TipoGranel values.
ALTER TABLE "config_granel"
  ADD COLUMN "rentaDiaConMadera"    DECIMAL(10,2),
  ADD COLUMN "rentaSemanaConMadera" DECIMAL(10,2),
  ADD COLUMN "rentaMesConMadera"    DECIMAL(10,2);
