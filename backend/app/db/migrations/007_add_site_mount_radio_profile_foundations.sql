-- Migration 007: Add site/mount/radio-profile schema foundations
-- Additive only: nodes remain the authoritative flattened planner records.

CREATE TABLE sites (
    id                   TEXT PRIMARY KEY,
    plan_id              TEXT NOT NULL REFERENCES plans(id) ON DELETE CASCADE,
    name                 TEXT NOT NULL,
    latitude             REAL NOT NULL,
    longitude            REAL NOT NULL,
    public_latitude      REAL,
    public_longitude     REAL,
    coordinate_precision TEXT NOT NULL DEFAULT 'exact'
        CHECK (coordinate_precision IN ('exact', 'approximate', 'hidden')),
    visibility           TEXT NOT NULL DEFAULT 'private'
        CHECK (visibility IN ('private', 'community', 'public')),
    owner_user_id        TEXT,
    access_notes_private TEXT DEFAULT '',
    status               TEXT NOT NULL DEFAULT 'planned'
        CHECK (status IN ('candidate', 'planned', 'active', 'retired', 'rejected')),
    notes                TEXT DEFAULT '',
    created_at           TEXT NOT NULL,
    updated_at           TEXT NOT NULL
);
CREATE INDEX idx_sites_plan ON sites(plan_id);

CREATE TABLE mounts (
    id              TEXT PRIMARY KEY,
    plan_id         TEXT NOT NULL REFERENCES plans(id) ON DELETE CASCADE,
    site_id         TEXT NOT NULL REFERENCES sites(id) ON DELETE CASCADE,
    mount_type      TEXT NOT NULL DEFAULT 'mast'
        CHECK (mount_type IN ('handheld', 'window', 'indoor', 'mast', 'roof', 'tower', 'vehicle', 'tree', 'temporary')),
    height_agl_m    REAL NOT NULL DEFAULT 0.0,
    height_asl_m    REAL,
    cable_id        TEXT REFERENCES cables(id),
    cable_length_m  REAL DEFAULT 0.0,
    enclosure       TEXT,
    power_source    TEXT NOT NULL DEFAULT 'unknown'
        CHECK (power_source IN ('battery', 'solar', 'mains', 'vehicle', 'unknown')),
    install_notes   TEXT DEFAULT '',
    created_at      TEXT NOT NULL,
    updated_at      TEXT NOT NULL
);
CREATE INDEX idx_mounts_plan ON mounts(plan_id);
CREATE INDEX idx_mounts_site ON mounts(site_id);

CREATE TABLE radio_profiles (
    id                  TEXT PRIMARY KEY,
    plan_id             TEXT NOT NULL REFERENCES plans(id) ON DELETE CASCADE,
    name                TEXT NOT NULL,
    protocol            TEXT NOT NULL DEFAULT 'meshtastic',
    region              TEXT NOT NULL,
    frequency_mhz       REAL NOT NULL,
    tx_power_dbm        REAL NOT NULL,
    spreading_factor    INTEGER NOT NULL,
    bandwidth_khz       REAL NOT NULL,
    coding_rate         TEXT NOT NULL,
    modem_preset        TEXT,
    firmware_version    TEXT,
    config_json         TEXT DEFAULT '{}',
    created_at          TEXT NOT NULL,
    updated_at          TEXT NOT NULL
);
CREATE INDEX idx_radio_profiles_plan ON radio_profiles(plan_id);

ALTER TABLE nodes ADD COLUMN site_id TEXT REFERENCES sites(id) ON DELETE SET NULL;
ALTER TABLE nodes ADD COLUMN mount_id TEXT REFERENCES mounts(id) ON DELETE SET NULL;
ALTER TABLE nodes ADD COLUMN radio_profile_id TEXT REFERENCES radio_profiles(id) ON DELETE SET NULL;
CREATE INDEX idx_nodes_site ON nodes(site_id);
CREATE INDEX idx_nodes_mount ON nodes(mount_id);
CREATE INDEX idx_nodes_radio_profile ON nodes(radio_profile_id);
