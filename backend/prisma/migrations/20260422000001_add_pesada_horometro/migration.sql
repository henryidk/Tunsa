-- AlterTable: add rentaHoraMartillo to equipos
ALTER TABLE "equipos" ADD COLUMN "rentaHoraMartillo" DECIMAL(10,2);

-- AlterTable: add esPesada to solicitudes
ALTER TABLE "solicitudes" ADD COLUMN "esPesada" BOOLEAN NOT NULL DEFAULT false;

-- CreateTable: lecturas_horometro
CREATE TABLE "lecturas_horometro" (
    "id" TEXT NOT NULL,
    "solicitudId" TEXT NOT NULL,
    "equipoId" TEXT NOT NULL,
    "fecha" DATE NOT NULL,
    "horometroInicio" DECIMAL(10,1),
    "horometroFin5pm" DECIMAL(10,1),
    "horasNocturnas" DECIMAL(6,1),
    "horasDiurnasRaw" DECIMAL(6,1),
    "horasDiurnasFacturadas" DECIMAL(6,1),
    "ajusteMinimo" DECIMAL(6,1),
    "tarifaEfectiva" DECIMAL(10,2),
    "costoDiurno" DECIMAL(10,2),
    "costoNocturno" DECIMAL(10,2),
    "costoTotal" DECIMAL(10,2),
    "registradoInicioBy" TEXT,
    "registradoFinBy" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "lecturas_horometro_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "lecturas_horometro_solicitudId_equipoId_fecha_key" ON "lecturas_horometro"("solicitudId", "equipoId", "fecha");
CREATE INDEX "lecturas_horometro_solicitudId_equipoId_idx" ON "lecturas_horometro"("solicitudId", "equipoId");

-- AddForeignKey
ALTER TABLE "lecturas_horometro" ADD CONSTRAINT "lecturas_horometro_solicitudId_fkey" FOREIGN KEY ("solicitudId") REFERENCES "solicitudes"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "lecturas_horometro" ADD CONSTRAINT "lecturas_horometro_equipoId_fkey" FOREIGN KEY ("equipoId") REFERENCES "equipos"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
