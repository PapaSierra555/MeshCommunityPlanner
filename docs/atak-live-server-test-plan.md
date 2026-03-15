# ATAK Live Server — Manual Test Plan

Validates the ATAK KML Network Link integration end-to-end with a real ATAK device or
ATAK CIV (Android) / WinTAK on the same LAN as the planner host.

---

## Prerequisites

- Mesh Community Planner running (`python -m backend.app.main` or installed binary)
- ATAK CIV (Android) or WinTAK on the same LAN subnet
- At least one plan with 2+ placed nodes (lat/lon filled in)

---

## 1. Verify the KML endpoint returns valid XML

Open a browser on the host machine and navigate to:

```
http://127.0.0.1:8321/api/atak/nodes.kml
```

**Expected:**
- Browser prompts to download or displays XML starting with `<?xml version="1.0"`
- `<Document>` contains three `<Folder>` elements: Mesh Nodes, Repeaters, Gateways
- Each node with valid coordinates appears as a `<Placemark>` with `<name>`, `<description>`,
  and `<Point><coordinates>` populated
- Nodes at `0,0` do NOT appear
- Response headers include `Cache-Control: no-cache`

---

## 2. Verify plan_id filter

Append `?plan_id=<ID>` where `<ID>` is the integer ID of one of your plans.

```
http://127.0.0.1:8321/api/atak/nodes.kml?plan_id=1
```

**Expected:**
- Only placemarks from that plan appear
- Placemarks from other plans are absent

---

## 3. Verify the local-url detection endpoint

```
http://127.0.0.1:8321/api/atak/local-url
```

**Expected JSON:**
```json
{ "url": "http://<LAN-IP>:8321/api/atak/nodes.kml" }
```

- `<LAN-IP>` must be the machine's actual LAN IP (e.g. `192.168.x.x`), not `127.0.0.1`
- If the machine has no network adapter, it may fall back to `127.0.0.1` — acceptable

---

## 4. Verify the UI panel (sidebar)

1. Open the app in a browser at `http://127.0.0.1:8321`
2. Open or create a plan with at least one node
3. In the right sidebar, scroll to the "ATAK Integration" collapsible
4. Click the summary arrow to expand it

**Expected:**
- URL input shows `http://<LAN-IP>:8321/api/atak/nodes.kml`
- "Override IP" field is empty
- "This plan only" checkbox is unchecked
- "Copy URL" button is enabled

**IP override test:**
- Type `10.0.0.99` into the Override IP field
- URL input updates to `http://10.0.0.99:8321/api/atak/nodes.kml`
- Clear the field — URL reverts to the detected LAN IP

**Plan filter test:**
- Check "This plan only"
- URL input gains `?plan_id=<ID>` suffix matching the open plan
- Uncheck — `plan_id=` suffix disappears

**Copy test:**
- Click "Copy URL" — button briefly shows "Copied!"
- Paste into a text editor and confirm the URL matches what is displayed

---

## 5. Import into ATAK CIV (Android)

1. On the ATAK device, tap the **Import Manager** icon (cloud arrow)
2. Select **KML Network Links** (or **Network** in some versions)
3. Tap the **+** icon to add a new network link
4. Paste the URL from step 4 (use the LAN IP, not 127.0.0.1)
5. Set **Refresh interval** to 30 seconds
6. Tap **OK** / **Import**

**Expected:**
- ATAK downloads the KML and places markers on the map
- Marker icons vary: green circle (mesh node), orange (repeater), red (gateway)
- Tapping a marker shows the description popup with Plan, Freq, Antenna, Device fields
- After 30 s the feed refreshes (add a new node in the planner; it appears in ATAK)

---

## 6. Plan-filtered import in ATAK

1. In the Planner, check "This plan only" and copy the URL (includes `?plan_id=X`)
2. Add a second Network Link in ATAK using this URL
3. Confirm only nodes from that plan appear for this link

---

## 7. Multi-subnet IP override

If the ATAK device is on a different subnet (e.g. via a hotspot):

1. Find the correct interface IP on the host (`ipconfig` / `ip addr`)
2. Enter that IP in the "Override IP" field and copy the updated URL
3. Import into ATAK as above

**Expected:** same behaviour as step 5

---

## 8. Backend node-type routing to folders

Create nodes with names containing "gateway", "repeater", and a plain name.
Fetch the KML and verify:

| Node name contains | KML `<Folder>` | `styleUrl` |
|--------------------|----------------|------------|
| "gateway"          | Gateways       | `#style-gateway` |
| "repeater"         | Repeaters      | `#style-repeater` |
| anything else      | Mesh Nodes     | `#style-mesh-node` |

---

## 9. Node with null coordinates is excluded

Create a node without placing it on the map (latitude/longitude = NULL in DB, or 0,0).
Fetch `/api/atak/nodes.kml` and confirm no `<Placemark>` appears for that node.

---

## Pass criteria

All 9 sections complete with no unexpected errors or missing placemarks.
The ATAK map refresh cycle (30 s) successfully picks up new/modified nodes.
