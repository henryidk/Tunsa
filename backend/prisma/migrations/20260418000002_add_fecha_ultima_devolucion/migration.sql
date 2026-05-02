-- Campo para filtrar historial por fecha de devolución sin queries JSONB
ALTER TABLE "solicitudes" ADD COLUMN "fechaUltimaDevolucion" TIMESTAMP(3);

-- Índice para keyset pagination del historial del encargado
CREATE INDEX "solicitudes_creadaPor_fechaUltimaDevolucion_id_idx"
  ON "solicitudes"("creadaPor", "fechaUltimaDevolucion", "id");
