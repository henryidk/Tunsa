-- AlterTable: campo denormalizado en Solicitud para acumular costos pesada
ALTER TABLE "solicitudes" ADD COLUMN "costoAcumuladoPesada" DECIMAL(12,2) NOT NULL DEFAULT 0;

-- CreateTable: registro de cierre por ítem (todos los tipos)
CREATE TABLE "resumen_items" (
    "id"              TEXT NOT NULL,
    "solicitudId"     TEXT NOT NULL,
    "clienteId"       TEXT NOT NULL,
    "equipoId"        TEXT,
    "itemRef"         TEXT NOT NULL,
    "tipoItem"        TEXT NOT NULL,
    "fechaEntrega"    TIMESTAMP(3) NOT NULL,
    "fechaDevolucion" TIMESTAMP(3),
    "tarifaEfectiva"  DECIMAL(10,2) NOT NULL,
    "diasCobrados"    INTEGER,
    "costoFinal"      DECIMAL(12,2),

    CONSTRAINT "resumen_items_pkey" PRIMARY KEY ("id")
);

-- CreateTable: extensión de horómetro solo para pesadas
CREATE TABLE "detalles_horometro" (
    "resumenItemId"       TEXT NOT NULL,
    "horometroEntrega"    DECIMAL(10,1),
    "horometroDevolucion" DECIMAL(10,1),
    "horasDiurnasTotal"   DECIMAL(10,1),
    "ajusteMinimoTotal"   DECIMAL(10,1),
    "horasNocturnas"      DECIMAL(10,1),

    CONSTRAINT "detalles_horometro_pkey" PRIMARY KEY ("resumenItemId")
);

-- CreateIndex
CREATE UNIQUE INDEX "resumen_items_solicitudId_itemRef_key" ON "resumen_items"("solicitudId", "itemRef");
CREATE INDEX "resumen_items_clienteId_idx" ON "resumen_items"("clienteId");
CREATE INDEX "resumen_items_equipoId_idx" ON "resumen_items"("equipoId");

-- AddForeignKey
ALTER TABLE "resumen_items" ADD CONSTRAINT "resumen_items_solicitudId_fkey"
    FOREIGN KEY ("solicitudId") REFERENCES "solicitudes"("id")
    ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "detalles_horometro" ADD CONSTRAINT "detalles_horometro_resumenItemId_fkey"
    FOREIGN KEY ("resumenItemId") REFERENCES "resumen_items"("id")
    ON DELETE RESTRICT ON UPDATE CASCADE;
