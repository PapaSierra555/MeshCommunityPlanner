# Frontend Workflow Agent Journal

## 2026-04-26

- Phase 1 Task 3: surfaced node privacy/domain fields in create/edit UI workflows.
- Added `visibility`, `coordinate_precision`, `node_role`, and `node_status` controls to the selected-node sidebar config and the node wizard advanced/review steps.
- Added default/preserved values for map-created nodes, placement-suggested nodes, imports/exports, save-all, and duplicate-plan node payloads without changing backend field names.
- Architect follow-up: changed UI fallback defaults from `community`/`client` to conservative backend-aligned `private`/`planned`.
- Architect follow-up: added `frontend/tests/components/AdvancedStep.test.tsx`.
- Verification: `cd frontend && npx vitest run tests/components/AdvancedStep.test.tsx tests/services/api.test.ts` passed. `cd frontend && npx eslint src/components/wizard/steps/AdvancedStep.tsx src/components/wizard/steps/ReviewStep.tsx tests/components/AdvancedStep.test.tsx` passed. Focused backend tests and `git diff --check` passed.
- Phase 1 Task 9: extracted the bottom loading/dialog/modal render stack from `AppLayout.tsx` into pure prop-driven `frontend/src/components/layout/AppDialogStack.tsx`; kept dialog state, handlers, API calls, and modal data shaping in `AppLayout.tsx`.
- Phase 1.5 Task 3: resolved stale backend-aligned `Node` field references in the owned wizard/import path by switching wizard bindings/review/template defaults from obsolete radio/antenna aliases to `firmware`, `region`, `frequency_mhz`, `antenna_id`, and `cable_length_m`; fixed local `AccessibleIcon` prop usage and import default firmware precedence. Verification: `cd frontend && npx tsc -b --noEmit` now moves past these files; remaining failures are existing Tooltip/OverlapZone/settings selector/util export issues.
- Phase 2 Task 6: added `buildLegacyNodeCreatePayload` in `nodeDomainAdapters` and routed AppLayout meshplan/CSV/JSON/import duplicate/placement create payloads plus InternetMapImportModal through it while keeping flattened node payloads. Verification: `cd frontend && npx vitest run tests/services/api.test.ts tests/utils/nodeDomainAdapters.test.ts tests/utils/export-privacy.test.ts` passed. `cd frontend && npx tsc -b --noEmit` passed.
- Phase 2 Task 9: moved `NodeWizard` state to a `NodeWizardDraft` with site/mount/radio profile parts and flattened only for step rendering/create completion. Updated wizard step contracts and adapter coverage while preserving the flattened create payload. Verification: `cd frontend && npx vitest run tests/components/AdvancedStep.test.tsx tests/utils/nodeDomainAdapters.test.ts` passed. `cd frontend && npx tsc -b --noEmit` passed.
- Phase 2 Task 8: reorganized the selected-node `AppLayout` editor into Site, Mount, and Radio Profile groups while preserving flattened `updateNode` fields and existing controls. Verification: `cd frontend && npx tsc -b --noEmit` passed; `cd frontend && npx vitest run tests/components/TxPowerWarning.test.tsx` passed.
