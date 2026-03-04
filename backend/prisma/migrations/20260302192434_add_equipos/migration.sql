-- CreateEnum
CREATE TYPE "TipoMaquinaria" AS ENUM ('LIVIANA', 'PESADA', 'USO_PROPIO');

-- CreateTable
CREATE TABLE "equipos" (
    "id" TEXT NOT NULL,
    "numeracion" TEXT NOT NULL,
    "descripcion" TEXT NOT NULL,
    "categoria" TEXT NOT NULL,
    "serieEquipo" TEXT,
    "serieMotor" TEXT,
    "fechaCompra" TIMESTAMP(3) NOT NULL,
    "montoCompra" DECIMAL(12,2) NOT NULL,
    "tipo" "TipoMaquinaria" NOT NULL DEFAULT 'LIVIANA',
    "rentaDia" DECIMAL(10,2),
    "rentaSemana" DECIMAL(10,2),
    "rentaMes" DECIMAL(10,2),
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "motivoBaja" TEXT,
    "fechaBaja" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "equipos_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "equipos_numeracion_key" ON "equipos"("numeracion");

-- CreateIndex
CREATE INDEX "equipos_categoria_idx" ON "equipos"("categoria");

-- CreateIndex
CREATE INDEX "equipos_tipo_idx" ON "equipos"("tipo");

-- CreateIndex
CREATE INDEX "equipos_isActive_idx" ON "equipos"("isActive");
