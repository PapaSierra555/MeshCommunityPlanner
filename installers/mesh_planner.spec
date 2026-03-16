# -*- mode: python ; coding: utf-8 -*-
"""PyInstaller spec file for Mesh Community Planner.

Bundles:
- Python runtime + FastAPI + all dependencies
- Frontend build (static files from frontend/dist/)
- Signal-Server binary (platform-specific)
- Seed data JSON files
- Database migration SQL files

Usage:
    pyinstaller installers/mesh_planner.spec
"""

import sys
from pathlib import Path

# Project root (one level up from installers/)
PROJECT_ROOT = Path(SPECPATH).parent

# Platform-specific Signal-Server binary path
if sys.platform == "win32":
    signal_server_src = PROJECT_ROOT / "bin" / "signal-server" / "windows"
    signal_server_name = "signal-server.exe"
elif sys.platform == "darwin":
    signal_server_src = PROJECT_ROOT / "bin" / "signal-server" / "macos"
    signal_server_name = "signal-server"
else:
    signal_server_src = PROJECT_ROOT / "bin" / "signal-server" / "linux"
    signal_server_name = "signal-server"

# Collect data files to bundle
datas = []

# Frontend build output (static files)
frontend_dist = PROJECT_ROOT / "frontend" / "dist"
if frontend_dist.is_dir():
    datas.append((str(frontend_dist), "frontend/dist"))

# Seed data JSON files
seed_dir = PROJECT_ROOT / "backend" / "app" / "db" / "seed"
if seed_dir.is_dir():
    datas.append((str(seed_dir / "*.json"), "backend/app/db/seed"))

# Database migration SQL files
migrations_dir = PROJECT_ROOT / "backend" / "app" / "db" / "migrations"
if migrations_dir.is_dir():
    datas.append((str(migrations_dir), "backend/app/db/migrations"))

# Signal-Server binary
if signal_server_src.is_dir():
    datas.append((str(signal_server_src), "bin/signal-server"))

# Branding icon for runtime access (About dialog, etc.)
branding_icon = PROJECT_ROOT / "branding" / "teal" / "png" / "icon-128x128.png"
if branding_icon.exists():
    datas.append((str(branding_icon), "branding"))

# Sample plans (importable .meshplan.json files)
sample_plans_dir = PROJECT_ROOT / "test_plans"
if sample_plans_dir.is_dir():
    datas.append((str(sample_plans_dir / "*.meshplan.json"), "sample_plans"))

# Hidden imports that PyInstaller may not detect via static analysis
hiddenimports = [
    "uvicorn",
    "uvicorn.logging",
    "uvicorn.loops",
    "uvicorn.loops.auto",
    "uvicorn.protocols",
    "uvicorn.protocols.http",
    "uvicorn.protocols.http.auto",
    "uvicorn.protocols.websockets",
    "uvicorn.protocols.websockets.auto",
    "uvicorn.lifespan",
    "uvicorn.lifespan.on",
    "fastapi",
    "pydantic",
    "starlette",
    "starlette.middleware",
    "starlette.middleware.cors",
    "slowapi",
    "structlog",
    "httpx",
    "aiofiles",
    "keyring",
    "keyring.backends",
    "reportlab",
    "reportlab.lib",
    "reportlab.pdfgen",
    "sqlite3",
    "multiprocessing",
    "encodings",
    "encodings.utf_8",
    # API routers
    "backend.app.api.health",
    "backend.app.api.plans",
    "backend.app.api.nodes",
    "backend.app.api.catalog",
    "backend.app.api.error_handlers",
    # Engine router + handlers
    "backend.app.api.router",
    "backend.app.api.models",
    "backend.app.api.los",
    "backend.app.api.bom",
    "backend.app.api.integration",
    "backend.app.api.coverage_gap",
    "backend.app.api.network_optimize",
    "backend.app.api.coverage_terrain",
    # Services
    "backend.app.services.propagation.coverage_grid",
    "backend.app.services.propagation.srtm",
    "backend.app.services.propagation.engine",
    "backend.app.services.propagation.fspl",
    "backend.app.services.pdf_generator",
    "backend.app.services.bom_generator",
    "backend.app.services.node_placement",
    "backend.app.services.viewshed",
    "backend.app.services.link_analysis",
    # WebSocket
    "backend.app.websocket.handler",
    "backend.app.websocket.progress",
    # Models (required by API routers)
    "backend.app.models",
    "backend.app.models.bom",
    "backend.app.models.hardware",
    "backend.app.models.propagation",
    "backend.app.models.settings",
    "backend.app.models.node",
    "backend.app.models.template",
    "backend.app.models.plan",
    # Repositories (required by API routers)
    "backend.app.db.repositories",
    "backend.app.db.repositories.catalog_repo",
    "backend.app.db.repositories.settings_repo",
    "backend.app.db.repositories.template_repo",
    "backend.app.db.repositories.plan_repo",
    "backend.app.db.repositories.node_repo",
    "backend.app.db.repositories.node_repo_optimized",
    "backend.app.db.repositories.plan_repo_optimized",
    # Database connection
    "backend.app.db.connection",
    "backend.app.db.database",
]

# Modules to exclude (test-only, dev tools)
excludes = [
    "pytest",
    "pytest_asyncio",
    "pytest_cov",
    "ruff",
    "mypy",
    "black",
    "isort",
    "coverage",
    "_pytest",
    "test",
    "tests",
]

block_cipher = None

a = Analysis(
    [str(PROJECT_ROOT / "backend" / "app" / "main.py")],
    pathex=[str(PROJECT_ROOT)],
    binaries=[],
    datas=datas,
    hiddenimports=hiddenimports,
    hookspath=[],
    hooksconfig={},
    runtime_hooks=[],
    excludes=excludes,
    win_no_prefer_redirects=False,
    win_private_assemblies=False,
    cipher=block_cipher,
    noarchive=False,
)

pyz = PYZ(a.pure, a.zipped_data, cipher=block_cipher)

# macOS/Windows: console=False so the native bootloader registers as a GUI app
# with Launch Services (macOS) and hides the console window (Windows).
# Linux: console=True for terminal-based launcher scripts.
# argv_emulation is DISABLED — it causes hangs on macOS 12+ with PyInstaller.
_is_macos = sys.platform == "darwin"

exe = EXE(
    pyz,
    a.scripts,
    [],
    exclude_binaries=True,
    name="MeshCommunityPlanner",
    debug=False,
    bootloader_ignore_signals=False,
    strip=False,
    upx=True,
    console=(sys.platform == "linux"),  # Linux: keep console for launcher scripts; Windows/macOS: windowed (GUI app)
    disable_windowed_traceback=False,
    argv_emulation=False,  # DISABLED — causes hangs/crashes on macOS 12+
    target_arch=None,
    codesign_identity=None,
    entitlements_file=None,
    icon=str(PROJECT_ROOT / "branding" / "teal" / "mesh-community-planner.ico")
    if (PROJECT_ROOT / "branding" / "teal" / "mesh-community-planner.ico").exists()
    else None,
)

coll = COLLECT(
    exe,
    a.binaries,
    a.zipfiles,
    a.datas,
    strip=False,
    upx=True,
    upx_exclude=[],
    name="MeshCommunityPlanner",
)

# macOS: also create a proper .app bundle via BUNDLE
# This puts Python shared libraries in Contents/Frameworks/ where the
# bootloader expects them. build_dmg.sh wraps this into a DMG.
if sys.platform == "darwin":
    app = BUNDLE(
        coll,
        name="Mesh Community Planner.app",
        icon=str(PROJECT_ROOT / "branding" / "teal" / "png" / "icon-1024x1024.png")
        if (PROJECT_ROOT / "branding" / "teal" / "png" / "icon-1024x1024.png").exists()
        else None,
        bundle_identifier="com.meshcommunityplanner.app",
        info_plist={
            "CFBundleDisplayName": "Mesh Community Planner",
            "CFBundleVersion": "1.2.0",
            "CFBundleShortVersionString": "1.2.0",
            "LSMinimumSystemVersion": "11.0",
            "NSHighResolutionCapable": True,
            "LSApplicationCategoryType": "public.app-category.utilities",
            "NSHumanReadableCopyright": "Copyright 2024-2026 Mesh Community Planner Project. CC BY-NC-SA 4.0.",
            "LSBackgroundOnly": False,
            "LSUIElement": True,
        },
    )
