-- Seguimiento del Plan de Operaciones de Salida v2.0, aislado de las 80 tareas anteriores.
-- Idempotente: no modifica ni elimina datos de seguimiento_cronograma.activities.
CREATE SCHEMA IF NOT EXISTS seguimiento_cronograma;
CREATE TABLE IF NOT EXISTS seguimiento_cronograma.operational_status (
 id TEXT PRIMARY KEY CHECK (id ~ '^[a-z0-9-]{2,18}$'),
 status TEXT NOT NULL DEFAULT 'Sin confirmar' CHECK (status IN ('Sin confirmar','En curso','Completada','Bloqueada','No aplica')),
 notes TEXT NOT NULL DEFAULT '',
 actual_at TIMESTAMPTZ,
 version INTEGER NOT NULL DEFAULT 0 CHECK (version >= 0),
 updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
 updated_by TEXT NOT NULL DEFAULT 'Sin identificar'
);
CREATE TABLE IF NOT EXISTS seguimiento_cronograma.operational_evidence (
 evidence_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
 activity_id TEXT NOT NULL REFERENCES seguimiento_cronograma.operational_status(id),
 label TEXT NOT NULL,
 url TEXT NOT NULL CHECK (url LIKE 'https://%'),
 created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
 created_by TEXT NOT NULL DEFAULT 'Sin identificar'
);
CREATE INDEX IF NOT EXISTS ix_operational_evidence_activity ON seguimiento_cronograma.operational_evidence(activity_id);
CREATE TABLE IF NOT EXISTS seguimiento_cronograma.operational_history (
 event_id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
 activity_id TEXT NOT NULL REFERENCES seguimiento_cronograma.operational_status(id),
 status TEXT NOT NULL,
 notes TEXT NOT NULL DEFAULT '',
 changed_by TEXT NOT NULL DEFAULT 'Sin identificar',
 action TEXT NOT NULL DEFAULT 'estado',
 changed_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS ix_operational_history_activity ON seguimiento_cronograma.operational_history(activity_id,changed_at DESC);