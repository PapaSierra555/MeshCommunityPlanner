"""
Internet Map Import API — proxy endpoint for fetching nodes from public mesh network maps.

Supports:
- MeshCore Map (map.meshcore.dev) — returns msgpack binary, decoded here and normalized

Returns a JSON-serializable list of node-like dicts with: name, lat, lon, description.
The frontend calls this proxy rather than the external API directly to avoid CORS issues
and to keep external network calls server-side.
"""

from __future__ import annotations

import logging
from typing import Any

import httpx
import msgpack
from fastapi import APIRouter, HTTPException, Query

logger = logging.getLogger(__name__)

router = APIRouter()

MESHCORE_API_URL = "https://map.meshcore.dev/api/v1/nodes?binary=1&short=1"

# Node type labels from the MeshCore map source
_NODE_TYPE_LABELS: dict[int, str] = {
    1: "Client",
    2: "Repeater",
    3: "Room Server",
    4: "Sensor",
}


def _normalize_meshcore_nodes(raw_nodes: list[Any]) -> list[dict[str, Any]]:
    """Normalize raw MeshCore msgpack node objects into our standard shape.

    Each raw node (short=1 format) has keys:
      n  = adv_name (string)
      la = last_advert (timestamp)
      t  = type (int: 1=Client, 2=Repeater, 3=Room Server, 4=Sensor)
      p  = params dict (freq, bw, sf, cr)
      lat, lon = coordinates (float)
      pk = public_key bytes or hex string

    We map to: name, lat, lon, description (optional extra info).
    """
    normalized: list[dict[str, Any]] = []

    for node in raw_nodes:
        if not isinstance(node, dict):
            continue

        # Extract coordinates — skip nodes with no valid position
        lat = node.get("lat")
        lon = node.get("lon")
        if lat is None or lon is None:
            continue
        try:
            lat = float(lat)
            lon = float(lon)
        except (TypeError, ValueError):
            continue
        if not (-90.0 <= lat <= 90.0) or not (-180.0 <= lon <= 180.0):
            continue

        # Name
        name = node.get("n") or node.get("adv_name") or ""
        if isinstance(name, bytes):
            name = name.decode("utf-8", errors="replace")
        name = str(name).strip()
        if not name:
            continue

        # Build description from type + radio params
        desc_parts: list[str] = []

        node_type = node.get("t")
        if node_type is not None:
            type_label = _NODE_TYPE_LABELS.get(int(node_type), f"Type {node_type}")
            desc_parts.append(f"Type: {type_label}")

        params = node.get("p")
        if isinstance(params, dict):
            freq = params.get("freq") or params.get("f")
            bw = params.get("bw") or params.get("b")
            sf = params.get("sf") or params.get("s")
            if freq:
                desc_parts.append(f"Freq: {freq} MHz")
            if bw:
                desc_parts.append(f"BW: {bw} kHz")
            if sf:
                desc_parts.append(f"SF: {sf}")

        description = ", ".join(desc_parts) if desc_parts else ""

        normalized.append(
            {
                "name": name,
                "lat": round(lat, 6),
                "lon": round(lon, 6),
                "description": description,
            }
        )

    return normalized


@router.get("/import/internet-map/ping")
async def ping_internet_map() -> dict[str, bool]:
    """Fast connectivity probe — HEAD request to map.meshcore.dev with a 3s timeout.

    Returns:
        JSON: {"online": true} if reachable, {"online": false} otherwise.
    """
    try:
        async with httpx.AsyncClient(timeout=3.0) as client:
            await client.head("https://map.meshcore.dev", follow_redirects=True)
        return {"online": True}
    except Exception:
        return {"online": False}


@router.get("/import/internet-map")
async def fetch_internet_map_nodes(
    source: str = Query(default="meshcore", description="Map source: 'meshcore'"),
) -> dict[str, Any]:
    """Proxy endpoint — fetch nodes from a public mesh network map and normalize them.

    Args:
        source: Which map to fetch from. Currently supports 'meshcore'.

    Returns:
        JSON: {"source": str, "nodes": [...], "count": int}

    Raises:
        HTTPException 400: Unknown source
        HTTPException 503: Upstream fetch failed
    """
    if source != "meshcore":
        raise HTTPException(status_code=400, detail=f"Unknown source: '{source}'. Supported: 'meshcore'")

    try:
        async with httpx.AsyncClient(timeout=15.0) as client:
            response = await client.get(
                MESHCORE_API_URL,
                headers={"Accept": "application/octet-stream"},
                follow_redirects=True,
            )
            response.raise_for_status()
            raw_bytes = response.content
    except httpx.TimeoutException:
        logger.warning("MeshCore map API timed out")
        raise HTTPException(
            status_code=503,
            detail="MeshCore map API timed out. Please try again.",
        )
    except httpx.HTTPStatusError as exc:
        logger.warning("MeshCore map API returned HTTP %d", exc.response.status_code)
        raise HTTPException(
            status_code=503,
            detail=f"MeshCore map API returned HTTP {exc.response.status_code}.",
        )
    except httpx.RequestError as exc:
        logger.warning("MeshCore map API request error: %s", exc)
        raise HTTPException(
            status_code=503,
            detail="Could not reach MeshCore map API. Check internet connectivity.",
        )

    # Decode msgpack binary
    try:
        raw_nodes = msgpack.unpackb(raw_bytes, raw=False, strict_map_key=False)
    except Exception as exc:
        logger.error("Failed to decode MeshCore msgpack response: %s", exc)
        raise HTTPException(
            status_code=503,
            detail="MeshCore map API returned unreadable data.",
        )

    if not isinstance(raw_nodes, list):
        # Sometimes the response is a dict with a nodes key
        if isinstance(raw_nodes, dict):
            raw_nodes = raw_nodes.get("nodes") or raw_nodes.get("data") or []
        else:
            raw_nodes = []

    nodes = _normalize_meshcore_nodes(raw_nodes)

    logger.info("MeshCore import: fetched %d raw nodes, normalized %d with coordinates", len(raw_nodes), len(nodes))

    return {
        "source": "meshcore",
        "nodes": nodes,
        "count": len(nodes),
    }
