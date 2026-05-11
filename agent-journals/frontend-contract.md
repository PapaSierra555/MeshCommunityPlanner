# Frontend Contract Agent Journal

## 2026-04-26 - Phase 1 Task 1: Fix node list API contract

- Touched `frontend/src/types/index.ts`, `frontend/src/services/api.ts`, and `frontend/src/components/layout/AppLayout.tsx`.
- Added `NodePage` matching the backend node list response shape `{ items, total, limit, offset }`.
- Updated `APIClient.listNodes` to return `Promise<NodePage>`.
- Updated the AppLayout `listNodes` call sites to consume `resp.items` instead of array-or-items fallback logic.
- Follow-up touched by Architect: `frontend/tests/services/api.test.ts`.
- Verification: `rg -n "listNodes\\(|Array\\.isArray\\(resp\\)|resp as any\\)\\.items|NodePage" frontend/src/types/index.ts frontend/src/services/api.ts frontend/src/components/layout/AppLayout.tsx` showed only the typed `NodePage` API and three AppLayout `listNodes` call sites. `cd frontend && npx vitest run tests/services/api.test.ts` passed. `cd frontend && npx tsc -b --noEmit` failed on existing unrelated errors such as missing `__BUILD_ID__`, Tooltip prop typing, CoverageCircle Node fields, missing websocket modules, and store selector type mismatches.

## 2026-04-26 - Phase 1 Task 2: Add node privacy/domain frontend types

- Touched `frontend/src/types/index.ts` only for frontend type support.
- Added `NodeVisibility`, `CoordinatePrecision`, `NodeRole`, and `NodeLifecycleStatus` union types matching the proposed backend values.
- Added optional `visibility`, `coordinate_precision`, `node_role`, and `node_status` fields to `Node`.
- Left the existing optional `Node.status` connectivity/presence field unchanged to avoid lifecycle-status ambiguity.

## 2026-04-26 - Phase 1.5 Task 2: Build ID and websocket module stubs

- Touched `frontend/src/vite-env.d.ts`, `frontend/src/services/websocket.ts`, and `frontend/src/stores/websocketStore.ts`.
- Moved `__BUILD_ID__` into `declare global` because `vite-env.d.ts` is a module due to its React type import.
- Added a small ticket-auth WebSocket client for `/ws/propagation` matching `websocket-provider.tsx` imports.
- Added the minimal zustand WebSocket store consumed by `websocket-provider.tsx`.
- Verification: `cd frontend && npx tsc -b --noEmit` now moves past the previous `__BUILD_ID__` and missing `./websocket` / `../stores/websocketStore` errors. Remaining errors are out-of-scope Tooltip, placement payload, stale Node fields, selectors, and duplicate utility export failures.

## 2026-04-26 - Phase 1.5 Task 4: Placement suggest payload contract

- Touched `frontend/src/components/layout/AppLayout.tsx` only for code.
- Left `frontend/src/services/api.ts` unchanged because `APIClient.suggestPlacement` already matches the backend contract.
- Converted `handlePlacementSuggest` existing nodes from the modal shape `{ latitude, longitude, name }` into `{ node_id, latitude, longitude, coverage_radius_m }` before calling the API.
- Verification: `cd frontend && npx tsc -b --noEmit` moved past the AppLayout placement payload error; remaining failures are out-of-scope planned errors.

## 2026-04-26 - Phase 1.5 Task 5: Selector/store contract cleanup

- Touched `frontend/src/stores/selectors.ts` and `agent-journals/frontend-contract.md`.
- Updated selector shallow comparisons for Zustand 5 via `useShallow`.
- Aligned settings selectors with the current nested `settings` state and removed reads of stale top-level settings/API-key fields.
- Computed total coverage area from `CoverageResult.coverage_radius_m` instead of stale `radius_km`.
- Verification: `cd frontend && npx tsc -b --noEmit` passed.

## 2026-04-26 - Phase 2 Task 5: Site/mount/radio profile frontend contracts

- Touched `frontend/src/types/index.ts`, `frontend/src/services/api.ts`, `frontend/src/utils/nodeDomainAdapters.ts`, `frontend/tests/utils/nodeDomainAdapters.test.ts`, `frontend/tests/services/api.test.ts`, and this journal.
- Added `Site`, `Mount`, `RadioProfile` plus page types and optional relationship IDs on `Node`.
- Added typed API client methods for plan-scoped sites, mounts, and radio profiles.
- Added pure node domain adapters for compatibility with the current flattened Node UI shape.
- Verification: `cd frontend && npx vitest run tests/services/api.test.ts tests/utils/nodeDomainAdapters.test.ts` passed. `cd frontend && npx tsc -b --noEmit` passed.
