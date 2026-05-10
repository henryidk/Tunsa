-- Gap-fill: field-level and index-level drift from db push usage.
-- Covers changes that happened via db push after the initial migration files were created.

-- ── usuarios ─────────────────────────────────────────────────────────────────
-- usuarios_username_idx was a redundant plain index (the @unique already creates one).
-- Dropped via db push; schema.prisma has a comment explaining it was removed.
DROP INDEX "usuarios_username_idx";

-- ── refresh_tokens ────────────────────────────────────────────────────────────
-- token field got @unique added for O(1) revocation lookups.
CREATE UNIQUE INDEX "refresh_tokens_token_key" ON "refresh_tokens"("token");

-- ── audit_logs ────────────────────────────────────────────────────────────────
-- Added index for queries by specific user ordered by date.
CREATE INDEX "audit_logs_userId_createdAt_idx" ON "audit_logs"("userId", "createdAt");

-- ── solicitudes ───────────────────────────────────────────────────────────────
-- Indexes based on updatedAt were replaced with fechaDecision-based ones
-- (updatedAt changes on every modification; fechaDecision is immutable at decision time).
DROP INDEX "solicitudes_estado_updatedAt_id_idx";
DROP INDEX "solicitudes_creadaPor_estado_updatedAt_id_idx";

-- firmaCliente replaced by comprobanteKey (R2 object key for the signed PDF).
ALTER TABLE "solicitudes" DROP COLUMN "firmaCliente";

-- Remove updatedAt default — Prisma manages this at application level via @updatedAt.
ALTER TABLE "solicitudes" ALTER COLUMN "updatedAt" DROP DEFAULT;

-- New approval/delivery tracking columns.
ALTER TABLE "solicitudes"
  ADD COLUMN "comprobanteKey"   TEXT,
  ADD COLUMN "fechaDecision"    TIMESTAMP(3),
  ADD COLUMN "fechaInicioRenta" TIMESTAMP(3);

-- Indexes for keyset pagination using the immutable fechaDecision.
CREATE INDEX "solicitudes_estado_fechaDecision_id_idx"
  ON "solicitudes"("estado", "fechaDecision", "id");

CREATE INDEX "solicitudes_creadaPor_estado_fechaDecision_id_idx"
  ON "solicitudes"("creadaPor", "estado", "fechaDecision", "id");

-- ── tipos_extra ───────────────────────────────────────────────────────────────
-- updatedAt default was removed (Prisma manages it via @updatedAt, no DB-level default needed).
ALTER TABLE "tipos_extra" ALTER COLUMN "updatedAt" DROP DEFAULT;
