-- Migration 008: Add plan-scoped field communication observations
-- Stores real-world pass/fail test points used to validate modeled coverage.

CREATE TABLE field_observations (
    id              TEXT PRIMARY KEY,
    plan_id         TEXT NOT NULL REFERENCES plans(id) ON DELETE CASCADE,
    latitude        REAL NOT NULL,
    longitude       REAL NOT NULL,
    success         INTEGER NOT NULL DEFAULT 0 CHECK (success IN (0, 1)),
    ack_relay       TEXT,
    ack_db          REAL,
    test_type       TEXT NOT NULL DEFAULT 'message'
        CHECK (test_type IN ('message', 'position', 'telemetry', 'voice', 'other')),
    source_node_id  TEXT REFERENCES nodes(id) ON DELETE SET NULL,
    target_node_id  TEXT REFERENCES nodes(id) ON DELETE SET NULL,
    timestamp       TEXT,
    notes           TEXT DEFAULT '',
    created_at      TEXT NOT NULL,
    updated_at      TEXT NOT NULL
);

CREATE INDEX idx_field_observations_plan ON field_observations(plan_id);
CREATE INDEX idx_field_observations_success ON field_observations(plan_id, success);
