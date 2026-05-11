# Mesh Community Planner Repo Review

## 1. Executive Summary

This repository is a local desktop-style LoRa mesh planning application, not a cloud/community collaboration app yet. The documented stack is React, TypeScript, Vite, Leaflet, Zustand, FastAPI, and SQLite, with PyInstaller packaging and local browser access on `127.0.0.1`. The README describes the product as a privacy-first planner for placing nodes, simulating RF/terrain coverage, selecting hardware, importing/exporting plans, and generating BOM/deployment reports (`README.md:5`, `README.md:36`, `README.md:97`).

The codebase is meaningfully implemented. It has a real FastAPI backend, SQLite migrations, seed data, a hardware catalog, map UI, terrain/elevation services, LOS/coverage analysis, imports, exports, unit tests, and packaging scripts. It is not just a scaffold.

It is ready for smaller single-user planning features, especially features that extend existing node, radio, catalog, import/export, and analysis flows. It is not ready for multi-user community submissions, moderation, ownership, privacy-controlled sharing, persistent test history, photos, or public/private location handling without architectural work.

The biggest risks before adding more functionality are:

- The current domain model centers on `plans` and `nodes`; there are no first-class `Site`, `LinkTest`, `TestSession`, `User`, `Attachment`, visibility, or moderation tables (`backend/app/db/migrations/001_initial_schema.sql:4`, `backend/app/db/migrations/001_initial_schema.sql:123`).
- The auth model is a local per-process bearer token injected into the frontend, not user identity or authorization (`backend/app/main.py:175`, `backend/app/main.py:279`, `backend/app/auth/middleware.py:82`).
- Exact coordinates are stored, shown, exported, and printed by default, which is unsafe for private home/repeater sites (`frontend/src/types/index.ts:35`, `frontend/src/components/map/MapContainer.tsx:407`, `backend/app/services/pdf_generator.py:171`).
- UI complexity is concentrated in very large components, especially `AppLayout.tsx` and `MapContainer.tsx`, which makes new workflow features riskier.
- Data contracts are uneven. Example: `APIClient.listNodes()` claims `Promise<Node[]>`, while the backend returns a paginated object and AppLayout compensates with `as any` (`frontend/src/services/api.ts:196`, `backend/app/api/nodes.py:25`, `frontend/src/components/layout/AppLayout.tsx:680`).

## 2. Architecture Map

Frontend:

- React + TypeScript + Vite. `frontend/package.json` currently declares React 19 dependencies while README/docs still say React 18 (`frontend/package.json:25`, `README.md:112`).
- Routing is effectively single-screen; `App.tsx` renders `AppLayout` directly (`frontend/src/App.tsx:1`).
- State is Zustand stores: `planStore`, `mapStore`, `settingsStore`, `layerStore`, `selectionStore`.
- Map rendering is Leaflet via imperative refs inside `MapContainer.tsx`.
- API access is centralized in `frontend/src/services/api.ts`, but many payloads are typed as `any`.

Backend:

- FastAPI app in `backend/app/main.py`.
- W2-style REST routers for plans, nodes, catalog, internet import, signal import.
- W3-style engine router in `backend/app/api/router.py` for LOS, coverage, terrain, BOM, placement, reports, elevation tiles, and WebSocket tickets.
- SQLite via a shared `DatabaseManager`, migration SQL files, and repository classes.
- Auth is local bearer token middleware plus query-param token for elevation tiles.

Storage:

- SQLite DB in platform user data dir (`backend/app/config.py:198`).
- Migrations live in `backend/app/db/migrations`.
- Seed data lives in `backend/app/db/seed/*.json`.
- `.meshplan.json`, CSV, KML, GeoJSON, PDF, and screenshots are handled largely from frontend flows.

Important structure:

```text
.
├── README.md, docs/
├── requirements.txt
├── backend/
│   ├── app/main.py
│   ├── app/config.py
│   ├── app/auth/
│   ├── app/security/
│   ├── app/api/
│   ├── app/models/
│   ├── app/db/
│   │   ├── migrations/
│   │   ├── repositories/
│   │   └── seed/
│   ├── app/services/
│   └── tests/
├── frontend/
│   ├── package.json
│   ├── vite.config.ts
│   ├── vitest.config.ts
│   ├── playwright.config.ts
│   ├── src/
│   │   ├── components/
│   │   ├── stores/
│   │   ├── services/
│   │   ├── types/
│   │   └── utils/
│   └── tests/
├── installers/
├── test_plans/
└── .github/workflows/release.yml
```

## 3. Data Model Review

Existing persistent model:

- `plans`: plan metadata: name, description, firmware family, region, file path, timestamps (`backend/app/db/migrations/001_initial_schema.sql:5`). This is sufficient for local plan files but has no owner, visibility, organization/community, default coordinate privacy, or moderation state.
- `nodes`: planned node/device records with coordinates, antenna height, device, firmware, region, radio settings, antenna/cable/PA IDs, solar flag, desired radius, notes, sort order, timestamps (`backend/app/db/migrations/001_initial_schema.sql:124`). This is useful for planned device placements but conflates device, site, deployment, and radio profile into one row.
- Catalog tables: `devices`, `antennas`, `cables`, `pa_modules`, `power_components`, `regulatory_presets`, `modem_presets`, `firmware_region_defaults` (`backend/app/db/migrations/001_initial_schema.sql:16`). These are a strong foundation for hardware and radio presets.
- `templates`: reusable configuration blobs (`backend/app/db/migrations/001_initial_schema.sql:153`). Useful, but JSON `config` makes validation and migration harder.
- `propagation_cache`: cached analysis blobs keyed by plan/node/hash (`backend/app/db/migrations/001_initial_schema.sql:166`). Good for performance, but not a durable test/result model.
- `activity_log` and `audit_trail`: mutation/audit traces (`backend/app/db/migrations/001_initial_schema.sql:178`, `backend/app/db/migrations/002_add_audit_trail.sql:4`). Current API hardcodes `user="test-user"` for plan audit writes (`backend/app/api/plans.py:147`).
- Node environment fields were added by migrations 004/005 (`backend/app/db/migrations/004_add_node_environment.sql:1`, `backend/app/db/migrations/005_add_node_coverage_environment.sql:1`).

Missing or weak for community mesh planning:

- No `Site`: exact physical place should be separate from node/device so multiple radios/tests can belong to one location.
- No `Mount`: height, rooftop/window/tree/mast/tripod, cable run, access notes, and install status are not modeled.
- No `NodeRole` or status: repeater/client/gateway/planned/experimental/public/private is absent.
- No `TestSession` or `LinkTest`: signal import exists only as an overlay parser; it does not persist structured measurements (`backend/app/api/signal_import.py:1`).
- No durable RSSI/SNR history, packet loss, route/hops, firmware version, weather/foliage, indoor/outdoor, or test operator.
- No photos/attachments.
- No user/operator/owner model.
- No visibility, coordinate fuzzing, or permission model.
- No first-class Meshtastic vs MeshCore profile model beyond firmware strings and modem preset catalog.

The model scales for local design plans with maybe dozens to low hundreds of nodes. It does not scale conceptually to a community knowledge base until sites, nodes, tests, roles, visibility, and users are separated.

## 4. Feature-Readiness Assessment

| Feature | Readiness | Why |
|---|---|---|
| Pin nodes/sites on a map | Needs minor work | Node pins exist in Leaflet and persist as `nodes`, but there is no separate `Site` model. |
| Store structured mesh test results | Needs architectural work | Signal CSV parser returns overlays only; no `TestSession`/`LinkTest` tables. |
| Record antenna, height, cable, mounting details | Needs architectural work | Antenna/cable/height exist on `nodes`; mount type, cable route, install status, access, and history do not. |
| Track links between two nodes/sites | Needs architectural work | LOS/link overlays exist, but no durable `Link`/`LinkTest` persistence. |
| Store test conditions | Needs architectural work | Radio fields exist on nodes, not per-test observations. No weather/foliage/firmware/test setup model. |
| Import/export CSV or JSON | Needs minor work | Plan and node CSV/JSON flows exist, but should be schema-versioned and privacy-aware. |
| Filter map by protocol/channel/ownership/status/test date | Needs architectural work | Protocol/radio fields exist; ownership/status/test date are missing. Filter type scaffolding exists but is not a full feature. |
| Attach photos/screenshots to a test | Not currently supported | No attachment storage/API. |
| Mark nodes public/private/experimental/repeater/client/gateway/planned | Needs architectural work | Some external import descriptions include type labels, but node schema has no role/status/visibility fields. |
| Support community submissions with moderation | Not currently supported | No users, submissions, moderation states, or permissions. |
| Track both Meshtastic and MeshCore config profiles | Needs minor to architectural work | Firmware and modem presets exist; protocol-specific config profiles are not first-class. |
| Generate coverage/testing reports | Needs minor work | PDF report generation exists; test result persistence is missing. |

## 5. Code Quality Review

Type safety:

- Backend Pydantic models are generally explicit for plans, nodes, LOS, coverage, and BOM (`backend/app/models/node.py:55`, `backend/app/api/models.py:18`).
- Frontend types are useful but inconsistent. `Node.id` is `string | number`, while backend IDs are UUID strings (`frontend/src/types/index.ts:31`, `backend/app/models/node.py:278`).
- Many frontend API and UI flows use `any`, especially `api.ts` and `AppLayout.tsx` (`frontend/src/services/api.ts:220`, `frontend/src/components/layout/AppLayout.tsx:787`).
- `frontend/src/types/network.ts` defines live network/dashboard metrics with numeric IDs that do not match the core node ID model and appear unused (`frontend/src/types/network.ts:1`).

Naming and contracts:

- Backend uses snake_case; frontend largely mirrors it, which is good for API payloads.
- Some analysis/report models use camelCase fields (`NetworkReportLinkInput.nodeAName`) while other models use snake_case (`backend/app/api/models.py:210`).
- `APIClient.listNodes()` has a misleading return type relative to backend pagination (`frontend/src/services/api.ts:196`, `backend/app/api/nodes.py:25`).

Component size and separation:

- `AppLayout.tsx` is doing plan CRUD, import/export, node editing, analysis, dialogs, reporting, status, and large parts of workflow control. It should be split before adding field-test workflows.
- `MapContainer.tsx` is 1300+ lines of imperative Leaflet rendering, popup creation, coverage, LOS, placement, route, flooding, signal, elevation, and marker editing. Future map features should be extracted into overlay hooks/modules.

Repeated logic:

- Node creation defaults are repeated in map click, plan import, CSV import, JSON import, and internet import flows.
- Frontend adapts paginated/non-paginated node responses in several places instead of fixing the API client contract (`frontend/src/components/layout/AppLayout.tsx:681`, `frontend/src/components/layout/AppLayout.tsx:708`, `frontend/src/components/layout/AppLayout.tsx:2317`).
- SQL injection/SSRF validators are duplicated in plan and node models (`backend/app/models/node.py:31`, `backend/app/models/plan.py:23`).

Error handling:

- Backend has a central error handler registration attempt and W3 `_error_response()` for service errors (`backend/app/main.py:151`, `backend/app/api/router.py:86`).
- Several frontend operations log errors and continue after optimistic local updates, e.g. deleting or dragging nodes (`frontend/src/components/layout/AppLayout.tsx:1451`, `frontend/src/components/map/MapContainer.tsx:288`). That is acceptable for local UX but risky for eventual shared state.
- Signal import has clear parsing errors and row limits (`backend/app/api/signal_import.py:29`, `backend/app/api/signal_import.py:111`).

Validation:

- Node validation covers coordinate ranges, frequency, power, SF, bandwidth, coding rate shape, text lengths, and environment enum (`backend/app/models/node.py:58`).
- The string validators reject URLs/IPs inside general text fields. That is heavy-handed for notes because real deployment notes may legitimately include URLs or IPs (`backend/app/models/node.py:123`).
- Catalog import reads the whole upload as UTF-8 without explicit byte-size or row count logic in the endpoint (`backend/app/api/catalog.py:288`), relying mainly on global request-size middleware.

Security assumptions:

- The code assumes local desktop use. `SECURITY.md` says no accounts and localhost binding (`SECURITY.md:40`), but current code does implement a per-session bearer token.
- `docs/CONFIG.md` allows self-hosting/binding to `0.0.0.0` with a warning (`docs/CONFIG.md:21`). That mode is not ready for community use because there are no users or authorization checks.
- `/api/shutdown` bypasses auth for browser `sendBeacon` and assumes localhost safety (`backend/app/auth/middleware.py:82`).

Performance:

- SQLite WAL, write serialization middleware, indexes, and propagation cache are appropriate for a local app (`backend/app/db/database.py:63`, `backend/app/db/migrations/003_performance_indexes.sql:4`).
- Map rendering may degrade beyond the documented 100-node target because overlays are rebuilt imperatively and many effects linearly search `nodes` during rendering (`frontend/src/components/map/MapContainer.tsx:902`, `frontend/src/components/map/MapContainer.tsx:1189`).
- Terrain overlays avoid storing raw point arrays and use precomputed image data, which is a good performance pattern (`frontend/src/stores/mapStore.ts:50`).

Accessibility/UI:

- There are accessibility-oriented tests and ARIA labels on map/info controls.
- Leaflet popups are built with HTML strings from node fields (`frontend/src/components/map/MapContainer.tsx:407`, `frontend/src/components/map/MapContainer.tsx:426`). React escaping does not apply there; user-controlled names/notes should be escaped before HTML string interpolation.

## 6. Testing and Tooling Review

Available tooling:

- Backend tests use pytest. Tests cover database manager, models, elevation API, middleware bypass, coverage grid, signal import, seed loader, PNG writer, etc.
- Frontend unit tests use Vitest + Testing Library + jsdom (`frontend/vitest.config.ts:9`).
- Frontend integration tests use Playwright and start the Vite dev server (`frontend/playwright.config.ts:71`).
- ESLint is configured with JS recommended, TypeScript recommended, React Hooks, and React Refresh (`frontend/eslint.config.js:8`).
- Frontend build script runs `tsc -b && vite build` (`frontend/package.json:8`).
- No `pyproject.toml`, `ruff.toml`, `mypy.ini`, or backend lint/type-check config exists; backend docs now describe pytest as the available backend check.
- CI is release-artifact oriented. `.github/workflows/release.yml` builds packages but does not run the backend/frontend tests as a normal PR gate (`.github/workflows/release.yml:29`, `.github/workflows/release.yml:121`).
- Vitest coverage thresholds are set to 100%, which is unrealistic for broad feature work and likely discourages running coverage as a normal gate (`frontend/vitest.config.ts:29`).

Minimum quality gate before feature work:

1. `cd frontend && npm run build && npm run lint && npm test`
2. `python -m pytest backend/tests`
3. Add a CI workflow for test/build on pull requests.
4. Intentionally add backend lint/type tooling when the project is ready to gate on it.
5. Add one contract test around `GET /api/plans/{plan_id}/nodes` and the frontend API adapter.

I did not run the test suite during this review; this pass was source inspection only.

## 7. Security and Privacy Review

Current privacy stance:

- The product is explicitly local-first and no-telemetry (`README.md:52`, `SECURITY.md:44`).
- Default bind host is local-only (`backend/app/config.py:14`).
- SQLite DB file permissions are set to `0600` on Unix (`backend/app/db/database.py:148`).

Privacy gaps for community planning:

- No visibility controls or public/private flags.
- Exact lat/lon is stored on every node and shown in popups/sidebar/export/deployment cards (`frontend/src/types/index.ts:35`, `frontend/src/components/map/MapContainer.tsx:407`, `frontend/src/components/layout/AppLayout.tsx:1298`).
- Exports and PDFs can leak exact home/repeater locations. Deployment cards explicitly include coordinates.
- Auth has no users, roles, groups, ownership, or authorization checks. It is a local process token only.
- Query-param auth token for elevation tiles can appear in browser/network logs (`frontend/src/components/map/MapContainer.tsx:1068`).
- External imports from public maps normalize exact coordinates to 6 decimals, roughly sub-meter precision (`backend/app/api/internet_map.py:117`, `backend/app/api/internet_map.py:214`).
- Self-host mode is documented, but the app is not safe as a shared server without stronger auth and privacy controls (`docs/CONFIG.md:21`).

Privacy-safe defaults to adopt:

- Separate exact coordinates from public coordinates.
- Default new sites to private.
- Add `visibility: private | community | public` and `location_precision: exact | approximate | hidden`.
- Fuzz public coordinates by default, with distance configurable per site.
- Require explicit confirmation before exporting exact coordinates.
- Tag exported files/reports with whether they contain exact or fuzzed coordinates.
- Add per-site owner/contact fields that are private by default.
- Never include private notes/access instructions in public exports unless explicitly selected.
- Delay uploads/photos until auth, scanning, storage limits, and EXIF stripping are designed.

## 8. UX/Product Review

The current UI supports “plan a network on a map” better than “record field observations over time.”

Supported reasonably well:

- Place nodes on a map.
- Configure radio/hardware details.
- Run LOS/terrain coverage analysis.
- Import nodes from CSV/JSON/internet sources.
- Import signal CSV as a visual overlay.
- Generate BOM and reports.

Workflow gaps:

- “I tested from FiveForge to home”: no durable test session or link-test form.
- “I changed antenna from 5.8 dBi to 10 dBi”: current node stores one current antenna; no equipment-change history or before/after comparison.
- “This worked on LongFast but not MeshCore SF8”: modem/radio config exists on nodes, but observations cannot be tied to a radio profile/test condition.
- “This site is promising but needs rooftop mounting”: notes can hold this, but there is no structured site status, mount type, task, or planning decision.
- “This node is public but exact coordinates should be fuzzy”: no visibility or coordinate precision UI.
- “I want to compare test results over time”: no persisted test history or charts.

Practical UX improvements:

- Add a `Site` concept to the UI before adding more node fields.
- Add a mobile-friendly “Log Test” flow: from site, to site, protocol/profile, RSSI/SNR, success/failure, notes, conditions.
- Add a “visibility/precision” control near location fields.
- Add role/status badges on nodes: planned, active, repeater, client, gateway, experimental.
- Add a timeline/table view for tests by link and date.
- Add export scope controls: exact/private, community/fuzzed, public.

## 9. Recommended Refactor Before New Features

P0: must fix first

- Fix and type the `listNodes` API contract. Either return `NodePage` everywhere or make the client return `items`.
- Add privacy fields before any sharing/community/export expansion: visibility, role/status, coordinate precision.
- Escape or sanitize user-controlled strings before inserting them into Leaflet HTML popups/tooltips.
- Do not treat self-hosting as supported community mode until user auth/authorization exists.

P1: should fix before larger feature work

- Split `AppLayout.tsx` into feature hooks/components: plan actions, import/export, node editor, analysis actions, dialogs.
- Split `MapContainer.tsx` into map initialization, marker layer, coverage layer, LOS layer, signal layer, elevation layer, placement layer.
- Create shared frontend/backend schema expectations for node list pagination and import/export versioning.
- Introduce `Site` and `RadioProfile` tables before test history.
- Add CI test/build workflow.
- Add backend lint/type tooling when the project is ready to gate on it.

P2: nice improvement

- Consolidate duplicated default-node creation logic.
- Convert unused or speculative frontend types into either used code or remove them.
- Add repository/service tests around import/export edge cases.
- Improve docs version consistency: README says v1.3.5, frontend package says 1.3.4, docs include stale v1.2 known issues.

## 10. Suggested Feature Roadmap

### Phase 1: Solid Foundation

Goal: make the current single-user planner safer and easier to extend.

Likely files/modules touched:

- `backend/app/models/node.py`
- `backend/app/db/migrations`
- `backend/app/api/nodes.py`
- `frontend/src/services/api.ts`
- `frontend/src/types/index.ts`
- `frontend/src/components/layout/AppLayout.tsx`
- `frontend/src/components/map/MapContainer.tsx`

Risks:

- Migration compatibility with existing local databases and `.meshplan.json` exports.
- UI regressions due to large components.

Suggested tests:

- Backend node migration/model tests.
- API contract tests for paginated node listing.
- Frontend tests for loading a plan and rendering nodes.
- Popup escaping test for unsafe node names.

### Phase 2: Core Mesh Planning

Goal: separate sites, nodes, mounts, and radio profiles so the app can model real deployments.

Likely files/modules touched:

- New migrations for `sites`, `mounts`, `radio_profiles`, node role/status/visibility.
- New repositories and Pydantic models.
- Node wizard and sidebar.
- Import/export adapters.

Risks:

- Existing node-centric UI may need compatibility adapters.
- Users may have plans where one node equals one site; migration should preserve that.

Suggested tests:

- Migration from existing `nodes` to default `sites`.
- Site/node CRUD tests.
- Import/export round-trip tests.
- UI tests for site visibility and role filters.

### Phase 3: Field Testing Workflow

Goal: record real test sessions and link observations quickly from desktop/mobile browser.

Likely files/modules touched:

- New `test_sessions`, `link_tests`, `observations`, `protocol_profiles`.
- Signal import parser persistence path.
- New “Log Test” modal/form.
- Map signal overlay backed by persisted tests.

Risks:

- Data volume and query patterns.
- Ambiguous node identity when importing from external logs.
- Offline field use and later merge/conflict behavior.

Suggested tests:

- Link test CRUD and filtering.
- CSV import to persisted observations.
- Test-session report generation.
- UI tests for logging a test between two sites.

### Phase 4: Community Layer

Goal: support sharing, submissions, moderation, privacy-safe exports, and reports.

Likely files/modules touched:

- Auth/user/session model.
- Submission/moderation tables.
- Visibility/permission middleware.
- Export/report redaction layer.
- Attachment storage, if added.

Risks:

- Exposing exact private locations.
- Misleading users about auth strength if still in local token mode.
- Attachments can leak EXIF GPS or personal data.

Suggested tests:

- Authorization tests per visibility level.
- Export redaction tests.
- Coordinate fuzzing tests.
- Moderation state transition tests.
- Attachment upload limits and EXIF stripping tests, if uploads exist.

## 11. Specific Issues Found

- [ ] Frontend `listNodes` return type does not match backend response
  - Severity: medium
  - Files: `frontend/src/services/api.ts`, `backend/app/api/nodes.py`, `frontend/src/components/layout/AppLayout.tsx`
  - Why it matters: Feature code can accidentally treat a paginated object as an array.
  - Suggested fix: Type `listNodes()` as `Promise<{items: Node[]; total: number; limit: number; offset: number}>` or adapt it centrally to return `items`.

- [ ] No first-class site/test/link domain model
  - Severity: high
  - Files: `backend/app/db/migrations/001_initial_schema.sql`, `backend/app/models/node.py`
  - Why it matters: Future field-test and community planning features will overload `nodes` and become hard to query.
  - Suggested fix: Add `Site`, `Mount`, `RadioProfile`, `TestSession`, and `LinkTest` before implementing test history.

- [ ] No public/private visibility or coordinate precision controls
  - Severity: high
  - Files: `backend/app/db/migrations/001_initial_schema.sql`, `frontend/src/types/index.ts`
  - Why it matters: Home and repeater coordinates are sensitive.
  - Suggested fix: Add visibility and coordinate precision fields; default to private/exact locally and fuzzed/hidden for public export.

- [ ] Leaflet popup HTML interpolates user-controlled fields
  - Severity: high
  - Files: `frontend/src/components/map/MapContainer.tsx`
  - Why it matters: HTML string popups bypass React escaping.
  - Suggested fix: Escape text before popup/tooltip interpolation or build popup DOM nodes safely.

- [ ] Local bearer token is not multi-user auth
  - Severity: high
  - Files: `backend/app/auth/middleware.py`, `backend/app/main.py`
  - Why it matters: Self-host/community features need identity and authorization, not just process-local access control.
  - Suggested fix: Keep local token for desktop; add a separate explicit server mode auth design later.

- [ ] `/api/shutdown` bypasses auth
  - Severity: medium
  - Files: `backend/app/auth/middleware.py`
  - Why it matters: Safe only under localhost assumptions.
  - Suggested fix: Gate bypass on desktop local bind/app mode, or require token when not bound to loopback.

- [ ] Query-param token used for elevation tiles
  - Severity: medium
  - Files: `frontend/src/components/map/MapContainer.tsx`, `backend/app/api/router.py`
  - Why it matters: URLs can be logged or leaked more easily than headers.
  - Suggested fix: Accept for local-only desktop; revisit for server mode with cookie/session or tile proxy auth.

- [ ] `AppLayout.tsx` is too large and owns too many workflows
  - Severity: medium
  - Files: `frontend/src/components/layout/AppLayout.tsx`
  - Why it matters: New features will increase regression risk.
  - Suggested fix: Extract plan actions, imports/exports, node editor, analysis actions, and report generation.

- [ ] `MapContainer.tsx` is too large and mixes many overlay systems
  - Severity: medium
  - Files: `frontend/src/components/map/MapContainer.tsx`
  - Why it matters: Future map filters/tests/photos will be hard to add safely.
  - Suggested fix: Extract layer hooks/modules and index nodes by ID for overlay rendering.

- [ ] Plan audit user is hardcoded
  - Severity: low
  - Files: `backend/app/api/plans.py`
  - Why it matters: Audit trail will be misleading if multi-user features arrive.
  - Suggested fix: Use an explicit actor field when auth exists; for now use `local-user` or omit user identity.

- [x] Docs/tooling mismatch
  - Severity: low
  - Files: `docs/README.md`, `requirements.txt`, `.github/workflows/release.yml`
  - Why it matters: Docs mentioned dev requirements and linting tools that are not configured in repo.
  - Suggested fix: Backend docs now match the current pytest-only backend tooling; add backend dev tooling config later if needed.

- [ ] Version/doc drift
  - Severity: low
  - Files: `README.md`, `frontend/package.json`, `docs/KNOWN-ISSUES.md`
  - Why it matters: Makes release status unclear.
  - Suggested fix: Standardize version source and update stale docs.

## 12. Proposed Domain Model

Use SQLite migrations and Pydantic/TypeScript interfaces matching the existing style. Suggested TypeScript-style model:

```ts
type Visibility = 'private' | 'community' | 'public';
type CoordinatePrecision = 'exact' | 'approximate' | 'hidden';
type NodeRole = 'client' | 'repeater' | 'gateway' | 'sensor' | 'planned' | 'experimental';
type Protocol = 'meshtastic' | 'meshcore' | 'reticulum';

interface User {
  id: string;
  display_name: string;
  email?: string | null;
  role: 'owner' | 'moderator' | 'contributor' | 'viewer';
  created_at: string;
}

interface Site {
  id: string;
  plan_id: string;
  name: string;
  latitude: number;
  longitude: number;
  public_latitude?: number | null;
  public_longitude?: number | null;
  coordinate_precision: CoordinatePrecision;
  visibility: Visibility;
  owner_user_id?: string | null;
  access_notes_private?: string;
  status: 'candidate' | 'planned' | 'active' | 'retired' | 'rejected';
  notes: string;
  created_at: string;
  updated_at: string;
}

interface Mount {
  id: string;
  site_id: string;
  type: 'handheld' | 'window' | 'indoor' | 'mast' | 'roof' | 'tower' | 'vehicle' | 'tree' | 'temporary';
  height_agl_m: number;
  height_asl_m?: number | null;
  cable_id?: string | null;
  cable_length_m?: number;
  enclosure?: string | null;
  power_source?: 'battery' | 'solar' | 'mains' | 'vehicle' | 'unknown';
  install_notes?: string;
}

interface AntennaInstall {
  id: string;
  mount_id: string;
  antenna_id: string;
  gain_dbi: number;
  polarization?: string | null;
  azimuth_deg?: number | null;
  tilt_deg?: number | null;
}

interface Node {
  id: string;
  plan_id: string;
  site_id: string;
  mount_id?: string | null;
  name: string;
  role: NodeRole;
  status: 'planned' | 'active' | 'offline' | 'retired';
  visibility: Visibility;
  device_id: string;
  radio_profile_id: string;
  antenna_install_id?: string | null;
  owner_user_id?: string | null;
  notes: string;
  created_at: string;
  updated_at: string;
}

interface RadioProfile {
  id: string;
  plan_id: string;
  name: string;
  protocol: Protocol;
  region: string;
  frequency_mhz: number;
  tx_power_dbm: number;
  spreading_factor: number;
  bandwidth_khz: number;
  coding_rate: string;
  modem_preset?: string | null;
  firmware_version?: string | null;
  config_json?: Record<string, unknown>;
}

interface ProtocolProfile {
  id: string;
  protocol: Protocol;
  name: string;
  channel_name?: string | null;
  preset_name?: string | null;
  settings_json: Record<string, unknown>;
}

interface TestSession {
  id: string;
  plan_id: string;
  operator_user_id?: string | null;
  started_at: string;
  ended_at?: string | null;
  protocol_profile_id?: string | null;
  weather?: string | null;
  foliage?: string | null;
  notes: string;
  visibility: Visibility;
}

interface LinkTest {
  id: string;
  test_session_id: string;
  from_site_id: string;
  to_site_id: string;
  from_node_id?: string | null;
  to_node_id?: string | null;
  radio_profile_id?: string | null;
  rssi_dbm?: number | null;
  snr_db?: number | null;
  packet_loss?: number | null;
  latency_ms?: number | null;
  success: boolean;
  direction: 'a_to_b' | 'b_to_a' | 'bidirectional' | 'unknown';
  indoor_outdoor?: 'indoor' | 'outdoor' | 'vehicle' | 'unknown';
  notes: string;
  observed_at: string;
}

interface ObservationNote {
  id: string;
  plan_id: string;
  site_id?: string | null;
  node_id?: string | null;
  link_test_id?: string | null;
  author_user_id?: string | null;
  body: string;
  visibility: Visibility;
  created_at: string;
}

interface Attachment {
  id: string;
  plan_id: string;
  site_id?: string | null;
  test_session_id?: string | null;
  link_test_id?: string | null;
  filename: string;
  mime_type: string;
  storage_path: string;
  size_bytes: number;
  visibility: Visibility;
  exif_stripped: boolean;
  created_at: string;
}
```

Migration approach:

- Keep existing `nodes` fields initially for compatibility.
- Add `sites` and backfill one site per existing node.
- Add nullable `site_id` to `nodes`, backfill, then make required in a later migration.
- Move radio fields to `radio_profiles` after the UI can handle profile selection.
- Keep old import/export format supported via adapters.

## 13. Final Recommendation

The repo is ready for careful single-user feature work, but not ready for community/multi-user/private-location features without foundation changes.

Do first:

1. Fix typed API contracts and popup escaping.
2. Add visibility/coordinate precision fields before any sharing/export expansion.
3. Refactor `AppLayout.tsx` and `MapContainer.tsx` enough that new workflows have a clear home.
4. Add a PR test/build CI gate.

Safest next feature:

- Add node/site role/status and map filtering for local-only use, with export round-trip support.

Riskiest feature to delay:

- Community submissions with moderation and attachments. That should wait until auth, permissions, coordinate redaction, and domain tables are in place.
