#!/bin/bash
# Build Linux AppImage for Mesh Community Planner
#
# Prerequisites:
#   - PyInstaller output in dist/MeshCommunityPlanner/
#   - appimagetool (https://github.com/AppImage/AppImageKit)
#
# Output: dist/MeshCommunityPlanner-<version>-<arch>.AppImage
#         Arch is detected automatically via uname -m (x86_64 or aarch64).
#         Set APP_VERSION env var to override default (e.g. from CI).

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
INSTALLERS_DIR="$(dirname "$SCRIPT_DIR")"
PROJECT_ROOT="$(dirname "$INSTALLERS_DIR")"

APP_NAME="MeshCommunityPlanner"
APP_VERSION="${APP_VERSION:-1.3.5}"
ARCH="$(uname -m)"
PYINSTALLER_DIST="${PROJECT_ROOT}/dist/MeshCommunityPlanner"
APPDIR="${PROJECT_ROOT}/dist/${APP_NAME}.AppDir"

echo "[INFO] Building Linux AppImage..."
echo "[INFO] Project root: ${PROJECT_ROOT}"

# Verify PyInstaller output exists
if [ ! -d "${PYINSTALLER_DIST}" ]; then
    echo "[ERROR] PyInstaller output not found at ${PYINSTALLER_DIST}"
    echo "[ERROR] Run: python3 -m PyInstaller installers/mesh_planner.spec --noconfirm"
    exit 1
fi

# Clean previous build
rm -rf "${APPDIR}"

# Create AppDir structure
mkdir -p "${APPDIR}/usr/bin"
mkdir -p "${APPDIR}/usr/share/applications"
mkdir -p "${APPDIR}/usr/share/icons/hicolor/256x256/apps"

# Copy PyInstaller output
cp -R "${PYINSTALLER_DIST}/"* "${APPDIR}/usr/bin/"

# Copy .desktop file
cp "${SCRIPT_DIR}/mesh-community-planner.desktop" "${APPDIR}/usr/share/applications/"
cp "${SCRIPT_DIR}/mesh-community-planner.desktop" "${APPDIR}/"

# Copy icon from branding
ICON_SRC="${PROJECT_ROOT}/branding/teal/png/icon-256x256.png"
if [ -f "${ICON_SRC}" ]; then
    cp "${ICON_SRC}" "${APPDIR}/usr/share/icons/hicolor/256x256/apps/mesh-community-planner.png"
    cp "${ICON_SRC}" "${APPDIR}/mesh-community-planner.png"
    echo "[INFO] Icon copied from branding"
else
    echo "[WARN] No icon found at ${ICON_SRC}"
fi

# Create AppRun entry point with health-check polling and signal trap
cat > "${APPDIR}/AppRun" << 'APPRUN_EOF'
#!/bin/bash
# AppRun entry point for Mesh Community Planner AppImage
SELF="$(readlink -f "$0")"
HERE="$(dirname "$SELF")"
LOG_FILE="${HOME}/.local/share/MeshCommunityPlanner/appimage.log"
mkdir -p "$(dirname "$LOG_FILE")"

echo "$(date): Starting Mesh Community Planner..." >> "${LOG_FILE}"

# Tell the backend not to open a browser — this launcher handles it
export MESH_PLANNER_NO_BROWSER=1

# Start the backend server
"${HERE}/usr/bin/MeshCommunityPlanner" >> "${LOG_FILE}" 2>&1 &
SERVER_PID=$!

# Kill the server when the AppImage is closed
cleanup() {
    echo "$(date): Shutting down server (PID ${SERVER_PID})..." >> "${LOG_FILE}"
    kill ${SERVER_PID} 2>/dev/null
    wait ${SERVER_PID} 2>/dev/null
    echo "$(date): Server stopped" >> "${LOG_FILE}"
}
trap cleanup EXIT TERM INT HUP

# Wait for server to be ready (up to 30 seconds)
STARTED=0
for i in $(seq 1 30); do
    if ! kill -0 ${SERVER_PID} 2>/dev/null; then
        echo "$(date): Server process died (exit early)" >> "${LOG_FILE}"
        break
    fi
    if curl -s -o /dev/null "http://127.0.0.1:8321/api/health" 2>/dev/null; then
        echo "$(date): Server ready after ${i}s — opening browser" >> "${LOG_FILE}"
        xdg-open "http://127.0.0.1:8321" 2>/dev/null || true
        STARTED=1
        break
    fi
    sleep 1
done

if [ ${STARTED} -eq 0 ]; then
    echo "$(date): Server failed to start within 30s — check ${LOG_FILE}" >> "${LOG_FILE}"
fi

# Wait for server process
wait ${SERVER_PID}
echo "$(date): Server exited" >> "${LOG_FILE}"
APPRUN_EOF
chmod +x "${APPDIR}/AppRun"

# Build the AppImage
APPIMAGE_OUTPUT="${PROJECT_ROOT}/dist/${APP_NAME}-${APP_VERSION}-${ARCH}.AppImage"

if command -v appimagetool &> /dev/null; then
    echo "[INFO] Creating AppImage with appimagetool (arch: ${ARCH})..."
    ARCH="${ARCH}" appimagetool "${APPDIR}" "${APPIMAGE_OUTPUT}"
else
    echo "[WARN] appimagetool not found. Install from:"
    echo "  https://github.com/AppImage/AppImageKit/releases"
    echo ""
    echo "  # x86_64:"
    echo "  wget https://github.com/AppImage/AppImageKit/releases/download/continuous/appimagetool-x86_64.AppImage"
    echo "  chmod +x appimagetool-x86_64.AppImage && sudo mv appimagetool-x86_64.AppImage /usr/local/bin/appimagetool"
    echo ""
    echo "  # aarch64:"
    echo "  wget https://github.com/AppImage/AppImageKit/releases/download/continuous/appimagetool-aarch64.AppImage"
    echo "  chmod +x appimagetool-aarch64.AppImage && sudo mv appimagetool-aarch64.AppImage /usr/local/bin/appimagetool"
    echo ""
    echo "[INFO] AppDir created at ${APPDIR} — run appimagetool manually"
    exit 1
fi

echo "[OK] AppImage created at ${APPIMAGE_OUTPUT}"
