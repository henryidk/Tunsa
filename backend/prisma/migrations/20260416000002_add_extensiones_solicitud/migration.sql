-- Agrega el campo `extensiones` (JSONB nullable) a la tabla de solicitudes.
-- Almacena las ampliaciones de renta como un array de EntradaExtension,
-- manteniendo el JSON original de `items` inmutable (snapshot histórico).

ALTER TABLE "solicitudes" ADD COLUMN "extensiones" JSONB;
