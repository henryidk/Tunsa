-- AlterTable
ALTER TABLE "solicitudes" ADD COLUMN     "gestionadaPor" TEXT;

-- CreateIndex
CREATE INDEX "solicitudes_gestionadaPor_estado_fechaFinEstimada_idx" ON "solicitudes"("gestionadaPor", "estado", "fechaFinEstimada");
