-- AlterTable
ALTER TABLE "lecturas_horometro" ADD COLUMN     "complementoActivoId" TEXT,
ADD COLUMN     "complementoActivoNombre" TEXT,
ADD COLUMN     "tramos" JSONB NOT NULL DEFAULT '[]';
