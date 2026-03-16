#!/bin/bash
# Build macOS DMG for Mesh Community Planner
#
# Prerequisites:
#   - PyInstaller .app bundle in dist/Mesh Community Planner.app/
#     (built by: python3 -m PyInstaller installers/mesh_planner.spec --noconfirm)
#
# Output: installers/dist/MeshCommunityPlanner-<version>.dmg
#         Set APP_VERSION env var to override default (e.g. from CI).

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
INSTALLERS_DIR="$(dirname "$SCRIPT_DIR")"
PROJECT_ROOT="$(dirname "$INSTALLERS_DIR")"

APP_NAME="Mesh Community Planner"
APP_VERSION="${APP_VERSION:-1.3.2}"
APP_BUNDLE="${APP_NAME}.app"
DMG_NAME="MeshCommunityPlanner-${APP_VERSION}.dmg"

# PyInstaller BUNDLE output (created by mesh_planner.spec on macOS)
PYINSTALLER_APP="${PROJECT_ROOT}/dist/${APP_BUNDLE}"

echo "[INFO] Building macOS DMG..."
echo "[INFO] Project root: ${PROJECT_ROOT}"

# Verify PyInstaller .app output exists
if [ ! -d "${PYINSTALLER_APP}" ]; then
    echo "[ERROR] PyInstaller .app bundle not found at ${PYINSTALLER_APP}"
    echo "[ERROR] Run: python3 -m PyInstaller installers/mesh_planner.spec --noconfirm"
    exit 1
fi

# Build .icns icon from PNGs using macOS iconutil
ICON_PNG_DIR="${PROJECT_ROOT}/branding/teal/png"
RESOURCES_DIR="${PYINSTALLER_APP}/Contents/Resources"
if [ -d "${ICON_PNG_DIR}" ] && [ -d "${RESOURCES_DIR}" ]; then
    echo "[INFO] Building AppIcon.icns from PNGs..."
    ICONSET="${RESOURCES_DIR}/AppIcon.iconset"
    mkdir -p "${ICONSET}"

    # macOS iconset requires specific filenames
    cp "${ICON_PNG_DIR}/icon-16x16.png"     "${ICONSET}/icon_16x16.png"
    cp "${ICON_PNG_DIR}/icon-32x32.png"     "${ICONSET}/icon_16x16@2x.png"
    cp "${ICON_PNG_DIR}/icon-32x32.png"     "${ICONSET}/icon_32x32.png"
    cp "${ICON_PNG_DIR}/icon-64x64.png"     "${ICONSET}/icon_32x32@2x.png"
    cp "${ICON_PNG_DIR}/icon-128x128.png"   "${ICONSET}/icon_128x128.png"
    cp "${ICON_PNG_DIR}/icon-256x256.png"   "${ICONSET}/icon_128x128@2x.png"
    cp "${ICON_PNG_DIR}/icon-256x256.png"   "${ICONSET}/icon_256x256.png"
    cp "${ICON_PNG_DIR}/icon-512x512.png"   "${ICONSET}/icon_256x256@2x.png"
    cp "${ICON_PNG_DIR}/icon-512x512.png"   "${ICONSET}/icon_512x512.png"
    cp "${ICON_PNG_DIR}/icon-1024x1024.png" "${ICONSET}/icon_512x512@2x.png"

    iconutil -c icns "${ICONSET}" -o "${RESOURCES_DIR}/AppIcon.icns"
    rm -rf "${ICONSET}"
    echo "[INFO] AppIcon.icns created"
else
    echo "[WARN] No PNG icons found at ${ICON_PNG_DIR} — app will have no icon"
fi

# PyInstaller's native bootloader is the CFBundleExecutable.
# It properly registers with macOS Launch Services, so Finder/open/Dock
# all work correctly. The Python main.py handles browser opening directly.
# No bash launcher script — that breaks Launch Services relaunch tracking.
echo "[INFO] .app bundle ready at ${PYINSTALLER_APP}"

# Build DMG
mkdir -p "${INSTALLERS_DIR}/dist"
DMG_PATH="${INSTALLERS_DIR}/dist/${DMG_NAME}"
rm -f "${DMG_PATH}"

if command -v create-dmg &> /dev/null; then
    echo "[INFO] Using create-dmg..."
    # create-dmg has a bug with spaces in paths;
    # copy source .app and icon to /tmp to avoid space issues
    TMP_SRC="/tmp/MeshPlannerDmgBuild"
    rm -rf "${TMP_SRC}"
    mkdir -p "${TMP_SRC}"
    cp -R "${PYINSTALLER_APP}" "${TMP_SRC}/MeshCommunityPlanner.app"

    VOLUME_ICON="${RESOURCES_DIR}/AppIcon.icns"
    if [ -f "${VOLUME_ICON}" ]; then
        cp "${VOLUME_ICON}" "${TMP_SRC}/volicon.icns"
        create-dmg \
            --volname "${APP_NAME}" \
            --window-size 600 400 \
            --icon-size 100 \
            --icon "MeshCommunityPlanner.app" 150 200 \
            --app-drop-link 450 200 \
            --volicon "${TMP_SRC}/volicon.icns" \
            "${DMG_PATH}" \
            "${TMP_SRC}/MeshCommunityPlanner.app"
    else
        create-dmg \
            --volname "${APP_NAME}" \
            --window-size 600 400 \
            --icon-size 100 \
            --icon "MeshCommunityPlanner.app" 150 200 \
            --app-drop-link 450 200 \
            "${DMG_PATH}" \
            "${TMP_SRC}/MeshCommunityPlanner.app"
    fi
    rm -rf "${TMP_SRC}"
else
    echo "[INFO] create-dmg not found, using hdiutil..."
    STAGING="${INSTALLERS_DIR}/dist/dmg_staging"
    rm -rf "${STAGING}"
    mkdir -p "${STAGING}"
    cp -R "${PYINSTALLER_APP}" "${STAGING}/"
    ln -s /Applications "${STAGING}/Applications"

    hdiutil create -volname "${APP_NAME}" \
        -srcfolder "${STAGING}" \
        -ov -format UDZO \
        "${DMG_PATH}"

    rm -rf "${STAGING}"
fi

echo "[OK] DMG created at ${DMG_PATH}"
