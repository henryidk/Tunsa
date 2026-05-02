-- AlterTable: agregar tarifa por hora a equipos (uso exclusivo de maquinaria pesada)
ALTER TABLE "equipos" ADD COLUMN "renta_hora" DECIMAL(10,2);
