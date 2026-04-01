# Mesh Community Planner

A desktop application for planning LoRa mesh network deployments with terrain-aware RF propagation, hardware selection, and bill of materials generation.

![Version](https://img.shields.io/badge/version-1.3.3-blue)
![License](https://img.shields.io/badge/license-CC%20BY--NC--SA%204.0-green)
![Platforms](https://img.shields.io/badge/platforms-Windows%20%7C%20macOS%20%7C%20Linux-lightgrey)

---

## What It Does

Mesh Community Planner helps you design LoRa mesh networks before buying hardware. Place nodes on a map, simulate RF coverage using real terrain data, pick from a catalog of real devices, and generate a shopping list. Everything runs locally on your computer — no accounts, no cloud, no telemetry.

---

## Downloads

Download the latest release from the [GitHub Releases page](https://github.com/PapaSierra555/MeshCommunityPlanner/releases).

| Platform | Format | File |
|----------|--------|------|
| **Windows** | Portable (.zip) | `MeshCommunityPlanner-1.3.4-win.zip` |
| **macOS (Apple Silicon — M1/M2/M3/M4)** | Disk image (.dmg) | `MeshCommunityPlanner-1.3.4.dmg` |
| **macOS (Intel x86_64)** | Disk image (.dmg) | `MeshCommunityPlanner-1.3.4-x86_64.dmg` |
| **Linux (x86_64)** | AppImage | `MeshCommunityPlanner-1.3.4-x86_64.AppImage` |
| **Linux (aarch64 / arm64)** | AppImage | `MeshCommunityPlanner-1.3.4-aarch64.AppImage` |

All downloads are self-contained — no Python or Node.js installation required.

> **Linux architecture note:** Download the file matching your CPU. Run `uname -m` if unsure — `x86_64` is the standard PC/laptop architecture; `aarch64` covers Raspberry Pi 4/5, Qualcomm Snapdragon X, and other 64-bit ARM boards and devices.

> **macOS note:** On first launch, macOS will show a security warning — this is expected for unsigned apps. See [Opening on macOS](#opening-on-macos) below.

---

## Features

- **Interactive Map** — Place nodes on OpenStreetMap with drag-and-drop
- **Node Configuration Wizard** — Guided setup: Region, Firmware, Device, Radio, Antenna, Power
- **Hardware Catalog** — 11+ real LoRa devices across Meshtastic, MeshCore, and Reticulum/RNode
- **Terrain-Aware Propagation** — Longley-Rice/ITWOM with SRTM 30m elevation data
- **Elevation Heatmap** — On-demand terrain visualization with hypsometric tinting, adjustable opacity, and min/max range sliders
- **Line-of-Sight Analysis** — Terrain profiles with Fresnel zone clearance visualization
- **Network Topology** — Graph view with critical node detection and resilience metrics
- **Power Budgeting** — Battery and solar deployment recommendations per node
- **Bill of Materials** — Component list with pricing, CSV/PDF export, and deployment cards
- **Regulatory Presets** — US FCC 915, EU 868, EU 433, ANZ
- **Internet Map Import** — Pull live node positions from MeshCore Map (`map.meshcore.dev`) and Reticulum Network (`directory.rns.recipes`) directly into your plan; auto-disables when offline
- **Import/Export** — .meshplan JSON format, CSV node import, KML export
- **Offline Operation** — Works without internet after initial map/terrain caching
- **Privacy-First** — All data stays on your machine, no accounts or analytics
- **Accessibility** — WCAG 2.2 AA compliant with full keyboard navigation
- **Sample Plans** — 4 built-in example plans to explore on first launch

---

## Supported Firmware

- **Meshtastic** — Community mesh networking firmware
- **MeshCore** — Custom mesh protocol
- **Reticulum / RNode** — Cryptographic mesh networking

---

## 🍎 Opening on macOS

> **This is NOT a virus warning.** macOS blocks any app without a paid Apple code-signing certificate. Mesh Community Planner is free, non-commercial open-source software.

**Option A — Right-click method (no Terminal needed):**
1. Open Finder → Applications
2. Right-click `MeshCommunityPlanner` → **Open**
3. Click **Open** in the dialog
4. Done — macOS remembers this permanently

**Option B — Terminal (required on macOS 13 Ventura and older if right-click fails):**
```bash
xattr -cr /Applications/MeshCommunityPlanner.app
```
`xattr -cr` clears the quarantine flag macOS places on downloaded files. It does not modify the app — it performs the same action as clicking "Open" in the right-click dialog. After running it, double-click the app to launch normally.

---

## Build from Source

### Prerequisites

- Python 3.9+ with pip
- Node.js 18+ with npm
- PyInstaller 6.x (`pip install pyinstaller`)

### Build

```bash
git clone https://github.com/PapaSierra555/MeshCommunityPlanner.git
cd MeshCommunityPlanner

pip install -r requirements.txt
pip install pyinstaller

cd frontend && npm install && npx vite build && cd ..

python -m PyInstaller installers/mesh_planner.spec --noconfirm
```

### Run

```bash
# Windows
dist\MeshCommunityPlanner\MeshCommunityPlanner.exe

# macOS / Linux
./dist/MeshCommunityPlanner/MeshCommunityPlanner
```

The app starts a local server and opens your browser to `http://127.0.0.1:8321`.

See [docs/INSTALLATION_GUIDE.md](docs/INSTALLATION_GUIDE.md) for platform-specific details, DMG/AppImage packaging, and troubleshooting.

---

## Tech Stack

| Component | Technology |
|-----------|-----------|
| **Frontend** | React 18 + TypeScript + Vite |
| **State Management** | Zustand |
| **Mapping** | Leaflet + OpenStreetMap |
| **Visualization** | D3.js |
| **Backend** | Python 3.9+ + FastAPI |
| **Database** | SQLite (local) |
| **Propagation** | Longley-Rice / ITWOM |
| **Terrain Data** | SRTM 1-arc-second (30m resolution) |
| **Packaging** | PyInstaller |

---

## Documentation

All documentation lives in the [`docs/`](docs/) folder. Start with the User Guide for a comprehensive walkthrough of every feature.

- [User Guide](docs/USER_GUIDE.md) — Full feature walkthrough
- [Installation Guide](docs/INSTALLATION_GUIDE.md) — Build from source, platform-specific instructions
- [Quick Start Tutorials](docs/QUICK-START-TUTORIALS.md) — Step-by-step how-to guides
- [FAQ](docs/FAQ.md) — Common questions answered
- [Troubleshooting](docs/TROUBLESHOOTING.md) — Common issues and fixes
- [Known Issues](docs/KNOWN-ISSUES.md) — Current limitations
- [Release Notes v1.2.0](docs/RELEASE_NOTES_v1.2.0.md) — What's new in v1.2.0
- [Release Notes v1.2.0](docs/RELEASE_NOTES_v1.2.md) — Elevation Range Sliders
- [Release Notes v1.1](docs/RELEASE_NOTES_v1.1.md) — Elevation Heatmap and test suite
- [Release Notes v1.0](docs/RELEASE_NOTES_v1.0.md) — Initial release
- [Changelog](CHANGELOG.md) — Version history

---

## Contributing

Contributions are welcome! See [CONTRIBUTING.md](CONTRIBUTING.md) for guidelines on reporting bugs, requesting features, and submitting pull requests.

Please read our [Code of Conduct](CODE_OF_CONDUCT.md) before participating.

---

## License

Licensed under [Creative Commons Attribution-NonCommercial-ShareAlike 4.0 International (CC BY-NC-SA 4.0)](https://creativecommons.org/licenses/by-nc-sa/4.0/).

- **Share** — Copy and redistribute in any medium or format
- **Adapt** — Remix, transform, and build upon the material
- **Attribution** — Give appropriate credit
- **NonCommercial** — Not for commercial use
- **ShareAlike** — Distribute under the same license

See [LICENSE](LICENSE) for full terms.

---

## Acknowledgments

- **Signal-Server** by Alex Farrant — Open-source RF propagation engine
- **OpenStreetMap contributors** — Map data
- **USGS** — SRTM terrain elevation data
- **Meshtastic, MeshCore, Reticulum projects** — Inspiring this planning tool
