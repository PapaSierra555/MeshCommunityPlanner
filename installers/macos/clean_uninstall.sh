#!/bin/bash
# =============================================================================
# Mesh Community Planner — macOS Clean Uninstall
# =============================================================================
#
# Removes ALL traces of Mesh Community Planner from this Mac:
#   - Application bundles from /Applications
#   - Mounted DMG volumes
#   - Application logs
#   - Local data directory
#   - Cloned source repo (if in ~/MeshCommunityPlanner)
#
# Usage:
#   chmod +x clean_uninstall.sh
#   ./clean_uninstall.sh
#
# Safe to run multiple times. Will not error if files are already gone.
#
# If you forked this repo and are building locally, run this before
# each fresh build/test cycle to ensure no stale artifacts remain.
# =============================================================================

set -euo pipefail

echo "=== Mesh Community Planner — macOS Clean Uninstall ==="
echo ""

# 1. Remove installed app bundles
# DMG installs as MeshCommunityPlanner.app (spaces stripped by build_dmg.sh).
# Also remove the spaced name in case an older build is present.
echo "[1/6] Removing application bundles from /Applications..."
rm -rf /Applications/MeshCommunityPlanner.app
rm -rf "/Applications/Mesh Community Planner.app"

# 2. Eject mounted DMG volume if present
echo "[2/6] Ejecting mounted DMG volume..."
hdiutil detach "/Volumes/Mesh Community Planner" 2>/dev/null || true

# 3. Remove application logs
echo "[3/6] Removing application logs..."
rm -rf ~/Library/Logs/MeshCommunityPlanner.log

# 4. Remove local data directories (macOS and Linux paths)
echo "[4/6] Removing local data directories..."
rm -rf ~/Library/"Application Support"/MeshCommunityPlanner
rm -rf ~/.local/share/MeshCommunityPlanner

# 5. Remove source repo clone (default location)
echo "[5/6] Removing source repo clone (~/MeshCommunityPlanner)..."
rm -rf ~/MeshCommunityPlanner

# 6. Verify cleanup
echo "[6/6] Verifying cleanup..."
echo ""
CLEAN=true

if ls /Applications/ 2>/dev/null | grep -qi mesh; then
    echo "  [WARN] Found leftover in /Applications:"
    ls /Applications/ | grep -i mesh
    CLEAN=false
fi

if ls ~/Library/Logs/ 2>/dev/null | grep -qi mesh; then
    echo "  [WARN] Found leftover logs:"
    ls ~/Library/Logs/ | grep -i mesh
    CLEAN=false
fi

if [ -d ~/Library/"Application Support"/MeshCommunityPlanner ]; then
    echo "  [WARN] Data directory still exists: ~/Library/Application Support/MeshCommunityPlanner"
    CLEAN=false
fi

if [ -d ~/.local/share/MeshCommunityPlanner ]; then
    echo "  [WARN] Data directory still exists: ~/.local/share/MeshCommunityPlanner"
    CLEAN=false
fi

if [ -d ~/MeshCommunityPlanner ]; then
    echo "  [WARN] Source repo still exists: ~/MeshCommunityPlanner"
    CLEAN=false
fi

if $CLEAN; then
    echo "  [OK] All clear — no traces of Mesh Community Planner found."
fi

echo ""
echo "=== Uninstall complete ==="
