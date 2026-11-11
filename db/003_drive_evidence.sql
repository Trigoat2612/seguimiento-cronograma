-- Carga de evidencias Google Drive: extensión compatible con enlaces ya registrados.
-- Ejecutar en Neon solo al activar la rama. No modifica actividades ni archivos previos.
ALTER TABLE seguimiento_cronograma.operational_evidence
  ADD COLUMN IF NOT EXISTS drive_file_id TEXT;

CREATE UNIQUE INDEX IF NOT EXISTS ux_operational_evidence_drive_file
  ON seguimiento_cronograma.operational_evidence(drive_file_id)
  WHERE drive_file_id IS NOT NULL;

CREATE TABLE IF NOT EXISTS seguimiento_cronograma.operational_upload_attempts (
  upload_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  activity_id TEXT NOT NULL,
  uploader_hash CHAR(64) NOT NULL,
  uploader TEXT NOT NULL,
  filename TEXT NOT NULL,
  mime_type TEXT NOT NULL,
  size_bytes INTEGER NOT NULL CHECK(size_bytes>0 AND size_bytes<=3145728),
  state TEXT NOT NULL CHECK(state IN ('started','stored','failed','orphaned')),
  drive_file_id TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  finished_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS ix_operational_upload_attempts_ip
  ON seguimiento_cronograma.operational_upload_attempts
  (uploader_hash,created_at DESC);
CREATE INDEX IF NOT EXISTS ix_operational_upload_attempts_date
  ON seguimiento_cronograma.operational_upload_attempts
  (created_at DESC);
