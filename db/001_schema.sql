-- Esquema aislado en el proyecto Neon existente; no altera las tablas de otros módulos.
CREATE SCHEMA IF NOT EXISTS seguimiento_cronograma;
CREATE TABLE IF NOT EXISTS seguimiento_cronograma.plans (
 plan_id TEXT PRIMARY KEY,
 title TEXT NOT NULL,
 description TEXT NOT NULL DEFAULT '',
 start_date DATE NOT NULL,
 end_date DATE NOT NULL,
 created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS seguimiento_cronograma.activities (
 id VARCHAR(8) PRIMARY KEY,
 plan_id TEXT NOT NULL REFERENCES seguimiento_cronograma.plans(plan_id),
 plan_date DATE NOT NULL,
 start_minute INT NOT NULL CHECK (start_minute BETWEEN 0 AND 1439),
 end_minute INT NOT NULL CHECK (end_minute>start_minute AND end_minute<=2880),
 title TEXT NOT NULL,
 category TEXT NOT NULL,
 action_icon VARCHAR(16) NOT NULL DEFAULT '📌',
 owner TEXT NOT NULL,
 dependencies TEXT NOT NULL DEFAULT '',
 description TEXT NOT NULL DEFAULT '',
 expected_result TEXT NOT NULL DEFAULT '',
 contingency BOOLEAN NOT NULL DEFAULT FALSE,
 sort_order INT NOT NULL,
 status TEXT NOT NULL DEFAULT 'Pendiente' CHECK(status IN ('Pendiente','En curso','Completada','Bloqueada','No aplica')),
 notes TEXT NOT NULL DEFAULT '',
 started_at TIMESTAMPTZ,
 completed_at TIMESTAMPTZ,
 updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
 updated_by TEXT,
 version INT NOT NULL DEFAULT 1 CHECK(version>0)
);
CREATE TABLE IF NOT EXISTS seguimiento_cronograma.activity_history (
 event_id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
 activity_id VARCHAR(8) NOT NULL REFERENCES seguimiento_cronograma.activities(id),
 status TEXT NOT NULL,
 notes TEXT NOT NULL DEFAULT '',
 version INT NOT NULL,
 changed_by TEXT NOT NULL,
 changed_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS ix_cronograma_historial_actividad ON seguimiento_cronograma.activity_history(activity_id, changed_at DESC);
CREATE TABLE IF NOT EXISTS seguimiento_cronograma.activity_evidence (
 evidence_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
 activity_id VARCHAR(8) NOT NULL REFERENCES seguimiento_cronograma.activities(id),
 label VARCHAR(200) NOT NULL,
 url TEXT NOT NULL,
 created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS ix_cronograma_evidencia_actividad ON seguimiento_cronograma.activity_evidence(activity_id);
