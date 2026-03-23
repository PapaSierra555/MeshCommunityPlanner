# Release Notes — v1.3.4

## What's New

### Coverage Hatch Mode

Enable via **Tools → Coverage Hatch Mode** after running a terrain coverage analysis on two or more nodes.

When active, the heatmap view gains a second layer showing diagonal stripe patterns only where two nodes share measurable signal coverage. Each node pair is assigned a unique color and stripe direction — right diagonal, left diagonal, horizontal, vertical, dots, and cross — cycling if there are more than six pairs. Where three or more nodes overlap, multiple hatch layers accumulate into a visibly denser pattern.

**How overlap is detected:** the hatching is pixel-accurate. Both nodes' PNG heatmap images are compared pixel by pixel on an offscreen canvas. Only pixels where both images have non-transparent signal coverage (-80 to -130 dBm) get a hatch line — the circular analysis boundary has no effect on the shape of the hatched region.

Toggle off to return to the standard heatmap view. The underlying coverage data is unchanged.

![Coverage Hatch Mode — Table Mountain and Lookout Mountain near Golden, CO](screenshots/HatchMode.png)

*Blue diagonal (Table Mountain) and green diagonal (Lookout Mountain) cross-hatch where both nodes provide signal coverage.*

---

### Satellite View

Enable via **Tools → Satellite View** to switch the base map from OpenStreetMap street view to ESRI World Imagery satellite photography.

This is particularly useful for rural and off-grid deployments where road names are less meaningful than terrain, tree cover, building rooftops, and visible landmarks. Toggle back at any time — node placements, overlays, and analysis results are unaffected by the base layer choice.

Satellite tiles cache locally after first view of any area. Once cached, satellite view works fully offline — same as street map tiles.

> **Note:** Satellite tiles require an internet connection the first time you view a new area. Subsequent views use the local tile cache.

> **Attribution:** Satellite imagery © Esri — Source: Esri, i-cubed, USDA, USGS, AEX, GeoEye, Getmapping, Aerogrid, IGN, IGP, UPR-EGP, and the GIS User Community.

![Satellite View — node placement near Longmont, CO with ESRI imagery](screenshots/SatelliteView.png)

*Three nodes placed against ESRI satellite imagery near Longmont, CO. Park Relay, Home Base, and School Rooftop are clearly identifiable against real-world terrain and structures.*

---

## Under the Hood

- CI: self-hosted macOS runner now recreates the x86_64 Python venv with `--clear` on every build, preventing stale `/tmp` state from breaking Intel DMG builds across runs.
- CI: GitHub Actions updated to Node.js 24 runtime ahead of the June 2026 deprecation deadline.
- Security: ESRI tile origin (`server.arcgisonline.com`) added to Content-Security-Policy `img-src` directive.

---

**Download:** See the [GitHub Releases page](https://github.com/PapaSierra555/MeshCommunityPlanner/releases/tag/v1.3.4) for Windows, macOS (Apple Silicon + Intel), and Linux installers.
