-- CreateEnum
CREATE TYPE "EstadoProyecto" AS ENUM ('ACTIVO', 'FINALIZADO');

-- AlterTable
ALTER TABLE "solicitudes" ADD COLUMN     "proyectoId" TEXT;

-- CreateTable
CREATE TABLE "proyectos" (
    "id" TEXT NOT NULL,
    "nombre" TEXT NOT NULL,
    "descripcion" TEXT,
    "clienteId" TEXT NOT NULL,
    "estado" "EstadoProyecto" NOT NULL DEFAULT 'ACTIVO',
    "fechaInicio" DATE NOT NULL,
    "fechaFin" DATE,
    "creadoPor" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "proyectos_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "proyectos_clienteId_estado_idx" ON "proyectos"("clienteId", "estado");

-- CreateIndex
CREATE INDEX "proyectos_estado_createdAt_idx" ON "proyectos"("estado", "createdAt");

-- CreateIndex
CREATE INDEX "solicitudes_proyectoId_idx" ON "solicitudes"("proyectoId");

-- AddForeignKey
ALTER TABLE "solicitudes" ADD CONSTRAINT "solicitudes_proyectoId_fkey" FOREIGN KEY ("proyectoId") REFERENCES "proyectos"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "proyectos" ADD CONSTRAINT "proyectos_clienteId_fkey" FOREIGN KEY ("clienteId") REFERENCES "clientes"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
