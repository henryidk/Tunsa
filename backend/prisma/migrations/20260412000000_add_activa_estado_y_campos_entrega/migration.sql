-- AlterEnum: agrega ACTIVA al enum EstadoSolicitud
ALTER TYPE "EstadoSolicitud" ADD VALUE 'ACTIVA';

-- AlterTable: campos de aprobación y entrega
ALTER TABLE "solicitudes"
  ADD COLUMN "aprobadaPor"  TEXT,
  ADD COLUMN "firmaCliente" TEXT,
  ADD COLUMN "fechaEntrega" TIMESTAMP(3);
