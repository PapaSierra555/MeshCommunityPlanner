# Map Safety Agent Journal

## 2026-04-26 - Phase 1 Task 4

- Added `escapeHtml` utility for Leaflet popup/tooltip string content.
- Escaped user-controlled node names, device IDs, overlay names derived from nodes, route/link labels, signal labels, and placement suggestion reasons before passing strings to Leaflet HTML APIs in `MapContainer.tsx`.
- Added focused unit coverage for HTML escaping behavior.

## 2026-04-26 - Phase 1 Task 10

- Extracted Leaflet node marker presentation helpers into `frontend/src/components/map/nodeMarkerLeaflet.ts`.
- Moved `createNodeIcon`, added `buildNodePopupHtml(node)`, and centralized permanent node label tooltip options as `NODE_LABEL_TOOLTIP_OPTIONS`.
- Left marker lifecycle, marker events, stores, and overlay rendering in `MapContainer.tsx`; `escapeHtml` remains there for non-node overlay strings.

## 2026-04-26 - Phase 1.5 Task 3

- Updated `CoverageCircle.tsx` and `NodeMarker.tsx` to use backend-aligned `Node` fields (`region`, `frequency_mhz`, `desired_coverage_radius_m`, `node_status`) instead of stale radio/status fields.
- Kept coverage FSPL fallback local to the component with existing frontend defaults and did not weaken shared `Node` typing or alter placement/settings/wizard/import surfaces.

## 2026-04-26 - Phase 1.5 Task 6

- Fixed owned TypeScript errors for tooltip clone props, react-leaflet tooltip props, Leaflet pattern path options, and duplicate `formatDistance` barrel exports.
- Kept edits scoped to map-safety owned files; `formatDistance` continues to come from `utils/units`.
