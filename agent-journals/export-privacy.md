# Export/Privacy Agent Journal

## 2026-04-26 - Phase 1 Task 5: Privacy-aware export boundaries

- Added privacy/domain fields (`visibility`, `coordinate_precision`, `node_role`, `node_status`) to node CSV export/import columns.
- Labeled node privacy/domain metadata in KML placemark descriptions and `ExtendedData`.
- Added GeoJSON export metadata and per-node privacy/domain properties.
- Added `.meshplan.json` export metadata and fixed bulk plan exports to preserve node privacy/domain fields.
- Added focused utility tests for CSV, KML, and GeoJSON privacy metadata behavior.
- Architect follow-up: added conservative CSV parser defaults for older CSV files without privacy/domain columns.
- Architect follow-up: tightened `frontend/src/utils/csv.ts` to pass focused `no-explicit-any` lint checks.
- Verification: `cd frontend && npx vitest run tests/utils/export-privacy.test.ts tests/utils/html.test.ts tests/components/AdvancedStep.test.tsx tests/services/api.test.ts` passed. Focused export utility ESLint and `git diff --check` passed. `cd frontend && npm run build` still fails on existing unrelated TypeScript errors.

## 2026-04-26 - Phase 2 Task 7: `.meshplan.json` relationship schema

- Extended `.meshplan.json` export/import only with optional `sites`, `mounts`, `radio_profiles`, and node relationship IDs while leaving CSV/KML/GeoJSON schemas unchanged.
- Import creates relationship records first, remaps source IDs to new plan-scoped IDs, and still accepts legacy node-only files.
- Added focused adapter tests for relationship export records, privacy defaults, and stale relationship ID handling.
- Verification: `cd frontend && npx vitest run tests/utils/nodeDomainAdapters.test.ts tests/utils/export-privacy.test.ts` and `cd frontend && npx tsc -b --noEmit` passed.
