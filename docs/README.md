# Mesh Community Planner

A desktop application for planning LoRa mesh network deployments with terrain-aware RF propagation modeling, hardware catalog integration, and comprehensive bill of materials generation.

## Overview

Mesh Community Planner helps community groups, emergency preparedness teams, and mesh network enthusiasts design complete LoRa mesh deployments before purchasing hardware. The application provides an all-in-one planning experience: place nodes on a map, simulate coverage using terrain-aware propagation models, select from real hardware/firmware combinations, enforce regulatory constraints, and generate a complete shopping list with deployment instructions.

**Key Features:**
- Interactive map interface with coverage visualization and connectivity analysis
- Elevation heatmap with adjustable min/max range sliders for local terrain contrast
- Terrain-aware RF propagation (Longley-Rice/ITWOM)
- Hardware catalog with 11+ LoRa devices (Meshtastic, MeshCore, Reticulum/RNode)
- Regulatory presets for US FCC, EU 868 MHz, EU 433 MHz, and ANZ
- Power budgeting with solar deployment recommendations
- Bill of materials in multiple formats (CSV, PDF, deployment cards)
- Line-of-sight terrain profile visualization
- Network topology and resilience analysis
- Fully offline-capable after initial data caching
- Complete WCAG 2.2 AA + EN 301 549 accessibility compliance
- Privacy-first architecture (all data local, no telemetry)

## Minimum System Requirements

- **Operating System:**
  - Windows 10 or later
  - macOS 11 (Big Sur) or later
  - Ubuntu 20.04 LTS or equivalent Linux distribution
- **Memory:** 4 GB RAM (recommended)
- **Disk Space:**
  - 500 MB for application
  - Up to 2 GB for cached map tiles and terrain data
- **Internet Connection:**
  - Required for initial map tile and terrain data download
  - Optional after caching (offline operation supported)

## Installation

### Windows

1. Download the MSI installer from the [releases page](../../releases)
2. Double-click `mesh-community-planner-{version}.msi`
3. Follow the installation wizard
4. Launch from Start Menu or Desktop shortcut
5. The application will open in your default browser at `http://127.0.0.1:{port}`

### macOS

1. Download the DMG file from the [releases page](../../releases)
2. Open `mesh-community-planner-{version}.dmg`
3. Drag the Mesh Community Planner app to your Applications folder
4. Launch from Applications or Spotlight
5. The application will open in your default browser at `http://127.0.0.1:{port}`

**Note:** On first launch, you may need to right-click the app and select "Open" to bypass Gatekeeper.

### Linux

**AppImage (all distributions):**
```bash
chmod +x mesh-community-planner-{version}.AppImage
./mesh-community-planner-{version}.AppImage
```

**Debian/Ubuntu (.deb):**
```bash
sudo dpkg -i mesh-community-planner-{version}.deb
mesh-community-planner
```

**Fedora/RHEL (.rpm):**
```bash
sudo rpm -i mesh-community-planner-{version}.rpm
mesh-community-planner
```

The application will open in your default browser at `http://127.0.0.1:{port}`.

## Quick Start

1. **Create a new plan:** Click "New Plan" and give your network a name
2. **Place your first node:** Click on the map to place a node, then configure:
   - Region (US, EU 868, EU 433, ANZ)
   - Firmware (Meshtastic, MeshCore, or Reticulum/RNode)
   - Hardware (choose from catalog or define custom)
   - Radio parameters (modem preset or manual configuration)
   - Antenna, cable, and optional PA module
3. **View instant coverage:** Free-space path loss (FSPL) preview appears immediately
4. **Run terrain analysis:** Click "Run Propagation" for full terrain-aware coverage modeling
5. **Analyze connectivity:** View the topology graph to see mesh links and resilience metrics
6. **Generate BOM:** Click "Bill of Materials" to see complete hardware list with pricing
7. **Export deployment package:** Save your plan and export deployment cards for field installation

See [USERGUIDE.md](USERGUIDE.md) for detailed feature documentation.

## Technology Stack

| Layer | Technology | Purpose |
|-------|-----------|---------|
| **Frontend** | React 18 + TypeScript + Vite | Interactive UI, map, wizard, visualizations |
| **Backend** | Python 3.9+ + FastAPI | REST API, WebSocket, calculations |
| **Database** | SQLite | Local storage, hardware catalog, settings |
| **Maps** | Leaflet + OpenStreetMap | Interactive map with offline caching |
| **Propagation** | Signal-Server (Longley-Rice/ITWOM) | Terrain-aware RF coverage modeling |
| **Terrain Data** | SRTM 1-arc-second (30m resolution) | Elevation profiles for propagation |
| **Testing** | Vitest + pytest + Playwright + Newman | Unit, E2E, API contract, accessibility |
| **Packaging** | PyInstaller + platform installers | MSI, DMG, AppImage, .deb, .rpm |

## Development Setup

### Prerequisites

- **Python 3.9 or later** with pip
- **Node.js 18 or later** with npm
- **Git**
- **Signal-Server binary** (included in repository for Windows/Linux/macOS)

### Clone and Install

```bash
# Clone the repository
git clone https://github.com/PapaSierra555/MeshCommunityPlanner.git
cd mesh-community-planner

# Backend setup
cd backend
pip install -r requirements.txt

# Frontend setup
cd ../frontend
npm install

# Initialize database (creates SQLite DB and loads seed data)
cd ../backend
python -m app.db.database init
```

### Running in Development

**Terminal 1 (Backend):**
```bash
cd backend
python -m uvicorn app.main:app --reload --host 127.0.0.1 --port 8000
```

**Terminal 2 (Frontend):**
```bash
cd frontend
npm run dev
```

Open your browser to `http://localhost:5173` (Vite dev server).

### Build and Test Commands

**Backend:**
```bash
cd backend

# Run backend tests
python -m pytest tests/

# Backend lint/type tooling is not configured in this repo yet.
# Follow PEP 8 and rely on pytest plus focused review for backend changes.
```

**Frontend:**
```bash
cd frontend

# Run unit tests with coverage
npm test

# Run tests with accessibility checks
npm test -- --coverage

# Build for production
npm run build

# Lint
npm run lint

# Audit dependencies
npm audit
```

**E2E Tests:**
```bash
cd tests/e2e

# Run Playwright tests (all browsers)
npx playwright test

# Run specific browser
npx playwright test --project=chromium

# Run with UI
npx playwright test --ui

# Run accessibility tests only
npx playwright test --grep "accessibility"
```

**API Contract Tests:**
```bash
cd tests/postman

# Run Newman against test environment
npx newman run mesh-community-planner.postman_collection.json \
  -e test.postman_environment.json
```

## Contributing

We welcome contributions! Please see [CONTRIBUTING.md](../CONTRIBUTING.md) for:
- Code of conduct
- Development workflow
- Testing requirements (TDD with Red/Green/Refactor)
- Pull request process
- Commit message conventions

### Key Guidelines

- **Tests:** New features should include unit tests
- **Accessibility:** UI changes should pass axe-core checks and WCAG 2.2 AA
- **Security:** Use parameterized queries, validate all inputs

## File Formats

### .meshplan
Versioned JSON format containing plan configuration, all nodes, and metadata. Includes SHA-256 integrity checksum. Backwards-compatible from v1.0.

### .meshnode
Single node configuration export in JSON format with checksum.

### .meshtemplate
Node configuration template (excludes coordinates) in JSON format with checksum.

## Architecture

- **Single-process:** Backend serves frontend as static files on a single localhost port
- **Offline-first:** Full operation after initial map/terrain caching
- **Privacy-first:** All data local, no telemetry, explicit consent for external APIs
- **Security:** Localhost-only binding, parameterized queries
- **Accessibility:** WCAG 2.2 AA + EN 301 549 compliance with axe-core validation

See the [Installation Guide](INSTALLATION_GUIDE.md) for project structure details.

## External Services

The application fetches data from external services as needed:

- **OpenStreetMap:** Map tiles (when viewing the map)
- **USGS Earth Explorer:** SRTM terrain data (on-demand download for propagation analysis)
- **Nominatim:** Address search / geocoding (when using the search bar)

## Privacy & Security

- **No telemetry or analytics** — zero data collection
- **Local-only storage** — all plans and settings stay on your machine
- **Secure by default** — localhost-only binding, parameterized queries

See [SECURITY.md](../SECURITY.md) for the responsible disclosure process.

## Documentation

- **[User Guide](USER_GUIDE.md)** — Comprehensive feature walkthrough
- **[FAQ](FAQ.md)** — Common questions answered
- **[Installation Guide](INSTALLATION_GUIDE.md)** — Build from source, per-platform instructions
- **[Quick Start Tutorials](QUICK-START-TUTORIALS.md)** — Step-by-step how-to guides
- **[Troubleshooting](TROUBLESHOOTING.md)** — Common issues and fixes
- **[OpenAPI Docs](http://127.0.0.1:8321/docs)** — Interactive API documentation (when app is running)

## License

This project is licensed under [Creative Commons Attribution-NonCommercial-ShareAlike 4.0 International (CC BY-NC-SA 4.0)](../LICENSE).

**Note:** This application uses Signal-Server (GPL) as a subprocess for propagation calculations. Signal-Server is called as an external binary and not linked.

## Acknowledgments

- **Signal-Server** by Alex Farrant — Open-source RF propagation engine
- **OpenStreetMap contributors** — Map data
- **USGS** — SRTM terrain elevation data
- **Meshtastic, MeshCore, Reticulum projects** — Inspiring this planning tool

## Support

- **Issues:** [GitHub Issues](https://github.com/PapaSierra555/MeshCommunityPlanner/issues)
- **Discussions:** [GitHub Discussions](https://github.com/PapaSierra555/MeshCommunityPlanner/discussions)
- **Documentation:** [USERGUIDE.md](USERGUIDE.md)

## Changelog

See [CHANGELOG.md](../CHANGELOG.md) for version history and release notes.

---

**Built for the mesh community by the mesh community.**
