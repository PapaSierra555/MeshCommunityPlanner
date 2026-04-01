# Mesh Community Planner -- Build & Installation Guide

**Version:** 1.3.5
**Date:** 2026-03-31

---

## Overview

Mesh Community Planner is a desktop application that runs a local web server (FastAPI on port 8321) and opens in your browser. It is built with PyInstaller into a self-contained executable -- no Python or Node.js installation is needed to **run** the built app.

To **build from source**, you need Python, Node.js, and PyInstaller.

---

## System Requirements

### To Run the Built Application

- **Windows 10/11** (64-bit), **macOS 11+** (Big Sur), or **Linux** (Ubuntu 20.04+ / Fedora 35+, x86_64 or aarch64)
- 4 GB RAM, 500 MB disk space
- Internet connection (for map tiles and elevation data on first use)
- Browser: Chrome 100+, Edge 100+, Firefox 98+, or Safari 15+

> **Linux architecture:** Two AppImage builds are provided — `x86_64` (standard PC/laptop) and `aarch64` (Raspberry Pi 4/5, Qualcomm Snapdragon X, and other 64-bit ARM). Run `uname -m` to check your architecture.

### To Build from Source

- **Python 3.9+** with pip
- **Node.js 18+** with npm
- **PyInstaller 6.x** (`pip install pyinstaller`)
- Platform-specific tools (see per-platform sections below)

---

## Quick Reference -- Build Commands

All platforms follow the same three steps:

```bash
# 1. Clone and install dependencies
git clone https://github.com/PapaSierra555/MeshCommunityPlanner.git
cd MeshCommunityPlanner
pip install -r requirements.txt
pip install pyinstaller
cd frontend && npm install && cd ..

# 2. Build frontend + PyInstaller bundle
cd frontend && npx vite build && cd ..
python -m PyInstaller installers/mesh_planner.spec --noconfirm

# 3. Run it
# Windows:  dist\MeshCommunityPlanner\MeshCommunityPlanner.exe
# macOS:    dist/MeshCommunityPlanner/MeshCommunityPlanner
# Linux:    dist/MeshCommunityPlanner/MeshCommunityPlanner
```

Then open http://127.0.0.1:8321 in your browser.

---

## Windows

### Build

```powershell
# Prerequisites: Python 3.9+, Node.js 18+ (both on PATH)

git clone https://github.com/PapaSierra555/MeshCommunityPlanner.git
cd MeshCommunityPlanner

pip install -r requirements.txt
pip install pyinstaller

cd frontend
npm install
npx vite build
cd ..

python -m PyInstaller installers/mesh_planner.spec --noconfirm
```

### Run

```powershell
dist\MeshCommunityPlanner\MeshCommunityPlanner.exe
```

The app starts a local server and prints the URL. Open http://127.0.0.1:8321 in your browser. Close the console window to stop the server.

### Verify

```powershell
curl http://127.0.0.1:8321/api/health
# Should return: {"status":"ok", ...}
```

---

## macOS

> **macOS downloads:** Two DMGs are available — `MeshCommunityPlanner-1.3.5.dmg` (Apple Silicon / M1–M4) and `MeshCommunityPlanner-1.3.5-x86_64.dmg` (Intel). Download the one that matches your Mac's processor. If unsure, click  → About This Mac and check the Chip field.

### Prerequisites

```bash
# Install Homebrew (if not installed)
/bin/bash -c "$(curl -fsSL https://raw.githubusercontent.com/Homebrew/install/HEAD/install.sh)"

# Install Python and Node
brew install python@3.13 node

# Install PyInstaller
pip3 install pyinstaller
```

### Build

```bash
git clone https://github.com/PapaSierra555/MeshCommunityPlanner.git
cd MeshCommunityPlanner

pip3 install -r requirements.txt

cd frontend
npm install
npx vite build
cd ..

python3 -m PyInstaller installers/mesh_planner.spec --noconfirm
```

### Run (command line)

```bash
./dist/MeshCommunityPlanner/MeshCommunityPlanner &
open http://127.0.0.1:8321
```

### Build .app Bundle + DMG (optional)

This wraps the PyInstaller output in a macOS `.app` bundle with a launcher that auto-opens the browser:

```bash
chmod +x installers/macos/build_dmg.sh
./installers/macos/build_dmg.sh
```

Output: `installers/dist/MeshCommunityPlanner-1.3.5.dmg`

To install: mount the DMG, drag "Mesh Community Planner" to Applications.

### ⚠️  IMPORTANT: macOS will block the app on first launch

> **This is expected and is NOT a virus warning.** macOS blocks any app that
> was not purchased through the App Store or signed with a paid Apple Developer
> certificate ($99/year). Mesh Community Planner is free, non-commercial
> open-source software. The app is safe; you can read every line of source
> code in this repository.

#### Why does this happen?

Apple's **Gatekeeper** feature checks every app for a code-signing certificate
before allowing it to run. Apps downloaded outside the App Store that are not
signed show a "Apple cannot verify this app" or "app is damaged" dialog. This
is a business/policy restriction, not a security finding. The app contains no
malware, spyware, or network calls outside of what is documented.

#### Option A — Right-click method (no Terminal needed)

1. Open **Finder** and navigate to **Applications**
2. **Right-click** (or Control-click) `MeshCommunityPlanner`
3. Select **Open** from the context menu
4. Click **Open** in the dialog that appears
5. The app launches. macOS remembers your choice — you only do this once.

#### Option B — Terminal command

```bash
xattr -cr /Applications/MeshCommunityPlanner.app
```

**What this command does:** `xattr` manages extended file attributes on macOS.
The `-c` flag clears all quarantine attributes (the "downloaded from internet"
flag that Gatekeeper checks), and `-r` applies it recursively to all files
inside the bundle. This is the same action macOS itself performs when you
click "Open" in the right-click dialog — it just does it in one step.
Running this command does not change, patch, or weaken the app in any way.
After running it, launch the app normally by double-clicking.

#### Why is this required on older Macs?

On macOS 13 (Ventura) and older, the right-click method sometimes fails to
show the "Open" option and the "app is damaged" message appears instead. In
that case, the Terminal command above is the only reliable method. This is a
known macOS quirk unrelated to the app itself.

### Optional: Ad-hoc code signing

```bash
codesign --force --deep --sign - dist/"Mesh Community Planner.app"
```

### macOS Troubleshooting

| Issue | Fix |
|-------|-----|
| `pip3: command not found` | `brew install python@3.13` then restart terminal |
| `node: command not found` | `brew install node` |
| PyInstaller: `No module named _tkinter` | Ignore -- tkinter is not used |
| "app is damaged" or Gatekeeper blocks | See Gatekeeper section above |
| Port 8321 in use | `lsof -i :8321` then `kill <PID>` |

---

## Linux

### Prerequisites (Ubuntu/Debian)

```bash
sudo apt update
sudo apt install python3 python3-pip python3-venv nodejs npm
pip3 install pyinstaller
```

### Prerequisites (Fedora/RHEL)

```bash
sudo dnf install python3 python3-pip nodejs npm
pip3 install pyinstaller
```

### Build

```bash
git clone https://github.com/PapaSierra555/MeshCommunityPlanner.git
cd MeshCommunityPlanner

pip3 install -r requirements.txt

cd frontend
npm install
npx vite build
cd ..

python3 -m PyInstaller installers/mesh_planner.spec --noconfirm
```

### Alternate Build Instructions for Arch-based Distros

```bash
yay -S python313 python-pip npm

git clone https://github.com/PapaSierra555/MeshCommunityPlanner.git
cd MeshCommunityPlanner
python3.13 -m venv venv
source venv/bin/activate

pip install -r requirements.txt 
pip install pyinstaller

cd frontend
npm install
npx vite build
cd ..

python3 -m PyInstaller installers/mesh_planner.spec --noconfirm
```

### Run

```bash
./dist/MeshCommunityPlanner/MeshCommunityPlanner &
xdg-open http://127.0.0.1:8321
```

### Build AppImage (optional)

Creates a portable single-file executable. The script detects your architecture automatically (`x86_64` or `aarch64`).

```bash
# Install appimagetool first:
# https://github.com/AppImage/AppImageKit/releases

# x86_64:
wget https://github.com/AppImage/AppImageKit/releases/download/continuous/appimagetool-x86_64.AppImage
chmod +x appimagetool-x86_64.AppImage && sudo mv appimagetool-x86_64.AppImage /usr/local/bin/appimagetool

# aarch64 (Raspberry Pi 4/5, Snapdragon X, etc.):
wget https://github.com/AppImage/AppImageKit/releases/download/continuous/appimagetool-aarch64.AppImage
chmod +x appimagetool-aarch64.AppImage && sudo mv appimagetool-aarch64.AppImage /usr/local/bin/appimagetool

chmod +x installers/linux/build_appimage.sh
./installers/linux/build_appimage.sh
```

Output: `dist/MeshCommunityPlanner-1.3.5-x86_64.AppImage` (or `-aarch64.AppImage` on ARM)

Run it:
```bash
chmod +x dist/MeshCommunityPlanner-1.3.5-*.AppImage
./dist/MeshCommunityPlanner-1.3.5-*.AppImage
```

### Linux Troubleshooting

| Issue | Fix |
|-------|-----|
| Missing `libGL.so` | `sudo apt install libgl1` (Ubuntu) or `sudo dnf install mesa-libGL` (Fedora) |
| Missing `libglib-2.0` | `sudo apt install libglib2.0-0` |
| Permission denied on AppImage | `chmod +x *.AppImage` |
| Port 8321 in use | `lsof -i :8321` then `kill <PID>` |

---

## Signal-Server (RF Propagation Engine)

Mesh Community Planner uses **Signal-Server** for terrain-aware RF propagation analysis (coverage heatmaps, Longley-Rice/ITWOM modeling). This is an optional external binary — the rest of the app (node placement, LoS profiles, BOM generation, topology analysis) works normally without it.

### What it is

Signal-Server is the [W3AXL fork](https://github.com/Cloud-RF/Signal-Server) of the open-source CloudRF/Signal-Server RF propagation engine. It is invoked as a subprocess by the backend and returns coverage data over SRTM elevation terrain.

### How the app finds it

The app looks for the `signalserver` binary in two places, in order:

1. **Bundled binary** — `bin/signal-server/<platform>/signal-server[.exe]` relative to the executable. Pre-built binaries are not included in this repository (licensing). Pre-built releases on the GitHub Releases page do not bundle Signal-Server either.
2. **System PATH** — if no bundled binary is found, the app falls back to whatever `signalserver` resolves to on your PATH.

If neither is found, terrain propagation analysis is unavailable. A clear error is shown in the UI when you attempt to run a coverage analysis; all other features remain functional.

### Installing Signal-Server

Build from source (Linux/macOS):

```bash
git clone https://github.com/Cloud-RF/Signal-Server.git
cd Signal-Server
make
sudo cp signalserver /usr/local/bin/
```

Windows users can cross-compile via WSL or use a pre-built binary from the Signal-Server releases page.

After installing, verify:

```bash
signalserver --help
```

### Bundling it with your own build

Place the platform binary at the path the spec expects, then rebuild PyInstaller:

```
bin/
  signal-server/
    linux/signal-server
    macos/signal-server
    windows/signal-server.exe
```

The spec will detect the directory and bundle the binary automatically.

---

## Clean Rebuild (all platforms)

If you suspect stale build artifacts, do a full clean rebuild:

```bash
# Remove all build artifacts
rm -rf frontend/dist build dist

# Rebuild frontend
cd frontend && npx vite build && cd ..

# Rebuild PyInstaller bundle
python3 -m PyInstaller installers/mesh_planner.spec --noconfirm
```

**Important:** After any frontend code change, you MUST rebuild both Vite and PyInstaller. PyInstaller bundles `frontend/dist/` at build time -- if you only rebuild Vite, the `.exe` still serves the old assets.

---

## Verification

After building on any platform:

```bash
# 1. Start the app
./dist/MeshCommunityPlanner/MeshCommunityPlanner   # (or .exe on Windows)

# 2. Test the health endpoint
curl http://127.0.0.1:8321/api/health

# 3. Open in browser
# Navigate to http://127.0.0.1:8321
# You should see the map interface with a welcome tour
```

---

## How the Application Works

- The executable starts a **FastAPI** server on `http://127.0.0.1:8321`
- The server serves the frontend (React/TypeScript) as static files
- Data is stored in a local **SQLite** database (auto-created on first run)
- Map tiles are fetched from OpenStreetMap (requires internet)
- No accounts, no cloud services, no external dependencies at runtime
- You have the option to make it a more traditional server by changing the config (see [CONFIG.md](CONFIG.md))

---

## Project Structure (for builders)

```
MeshCommunityPlanner/
  backend/app/          # Python backend (FastAPI)
  frontend/src/         # TypeScript frontend (React + Leaflet)
  frontend/dist/        # Vite build output (generated)
  installers/
    mesh_planner.spec   # PyInstaller spec (cross-platform)
    macos/              # macOS .app bundle + DMG builder
    linux/              # AppImage + .deb builders
    windows/            # NSIS installer script
  requirements.txt      # Python dependencies
  dist/                 # PyInstaller output (generated)
```

---

*Last Updated: 2026-03-31*
