-- Registro de cortes de migración de expedientes archivados Laboral NLPT – CSJLE.
-- No reescribe estados ni cifras históricas. Sin precarga de avances ficticios.
CREATE TABLE IF NOT EXISTS seguimiento_cronograma.migration_progress_updates (
  event_id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  target_count INTEGER NOT NULL CHECK (target_count BETWEEN 1 AND 10000000),
  migrated_count INTEGER NOT NULL CHECK (migrated_count >= 0 AND migrated_count <= target_count),
  validated_count INTEGER CHECK (validated_count IS NULL OR (validated_count >= 0 AND validated_count <= migrated_count)),
  reported_at TIMESTAMPTZ NOT NULL,
  source_description TEXT NOT NULL CHECK (char_length(trim(source_description)) BETWEEN 5 AND 500),
  evidence_url TEXT CHECK (evidence_url IS NULL OR evidence_url LIKE 'https://%'),
  updated_by TEXT NOT NULL CHECK (char_length(updated_by) BETWEEN 3 AND 320),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
-- La interfaz toma el último corte por fecha de medición y registra cada actualización como nueva fila.
