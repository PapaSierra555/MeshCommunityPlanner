-- Migration 006: Add backwards-compatible node privacy/domain fields
-- Defaults preserve existing node behavior for older records and clients.
ALTER TABLE nodes ADD COLUMN visibility TEXT NOT NULL DEFAULT 'private'
    CHECK (visibility IN ('private', 'community', 'public'));
ALTER TABLE nodes ADD COLUMN coordinate_precision TEXT NOT NULL DEFAULT 'exact'
    CHECK (coordinate_precision IN ('exact', 'approximate', 'hidden'));
ALTER TABLE nodes ADD COLUMN node_role TEXT NOT NULL DEFAULT 'planned'
    CHECK (node_role IN ('client', 'repeater', 'gateway', 'sensor', 'planned', 'experimental'));
ALTER TABLE nodes ADD COLUMN node_status TEXT NOT NULL DEFAULT 'planned'
    CHECK (node_status IN ('candidate', 'planned', 'active', 'retired', 'rejected'));
