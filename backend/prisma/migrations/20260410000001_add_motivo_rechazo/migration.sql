-- NULL en solicitudes PENDIENTE/APROBADA; obligatorio solo al rechazar (validado en DTO).
ALTER TABLE "solicitudes" ADD COLUMN "motivoRechazo" TEXT;
