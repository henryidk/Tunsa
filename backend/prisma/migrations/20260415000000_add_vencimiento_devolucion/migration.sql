-- AlterEnum: add DEVUELTA to EstadoSolicitud
ALTER TYPE "EstadoSolicitud" ADD VALUE 'DEVUELTA';

-- AlterTable: add vencimiento + devolución fields
ALTER TABLE "solicitudes"
  ADD COLUMN "fechaFinEstimada" TIMESTAMP(3),
  ADD COLUMN "fechaDevolucion"  TIMESTAMP(3),
  ADD COLUMN "recargoTotal"     DECIMAL(12, 2);

-- CreateIndex: encargado activas-mias / vencidas-mias query
CREATE INDEX "solicitudes_creadaPor_estado_fechaFinEstimada_idx"
  ON "solicitudes"("creadaPor", "estado", "fechaFinEstimada");
