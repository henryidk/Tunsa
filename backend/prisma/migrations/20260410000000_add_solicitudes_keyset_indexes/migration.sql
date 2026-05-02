-- Índice para keyset pagination de solicitudes RECHAZADA (panel admin).
-- Cubre: WHERE estado = 'RECHAZADA' AND updatedAt BETWEEN ? AND ?
-- ORDER BY updatedAt DESC, id DESC
CREATE INDEX "solicitudes_estado_updatedAt_id_idx" ON "solicitudes"("estado", "updatedAt", "id");

-- Índice para keyset pagination de solicitudes RECHAZADA del encargado autenticado.
-- Cubre: WHERE creadaPor = ? AND estado = 'RECHAZADA' AND updatedAt BETWEEN ? AND ?
-- ORDER BY updatedAt DESC, id DESC
CREATE INDEX "solicitudes_creadaPor_estado_updatedAt_id_idx" ON "solicitudes"("creadaPor", "estado", "updatedAt", "id");
