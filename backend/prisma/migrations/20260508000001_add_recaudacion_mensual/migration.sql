CREATE TABLE "recaudacion_mensual" (
    "id"        TEXT NOT NULL,
    "encargado" TEXT NOT NULL,
    "anio"      INTEGER NOT NULL,
    "mes"       INTEGER NOT NULL,
    "pesada"    DECIMAL(12,2) NOT NULL DEFAULT 0,
    "liviana"   DECIMAL(12,2) NOT NULL DEFAULT 0,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "recaudacion_mensual_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "recaudacion_mensual_encargado_anio_mes_key" ON "recaudacion_mensual"("encargado", "anio", "mes");
CREATE INDEX "recaudacion_mensual_encargado_anio_mes_idx"        ON "recaudacion_mensual"("encargado", "anio", "mes");
