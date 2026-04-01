"""
Internet Map Import API — proxy endpoint for fetching nodes from public mesh network maps.

Supports:
- MeshCore Map (map.meshcore.dev) — returns msgpack binary, decoded here and normalized
- Reticulum Network (directory.rns.recipes) — returns JSON, submitted + discovered nodes

Returns a JSON-serializable list of node-like dicts with: name, lat, lon, description.
The frontend calls this proxy rather than the external API directly to avoid CORS issues
and to keep external network calls server-side.
"""

from __future__ import annotations

import asyncio
import json
import logging
import secrets
import threading
import time
from typing import Any

import httpx
import msgpack
from fastapi import APIRouter, HTTPException, Query

logger = logging.getLogger(__name__)

router = APIRouter()

MESHCORE_API_URL = "https://map.meshcore.dev/api/v1/nodes?binary=1&short=1"
RETICULUM_SUBMITTED_URL = "https://directory.rns.recipes/api/directory/submitted"
RETICULUM_DISCOVERED_URL = "https://directory.rns.recipes/api/directory/discovered"
MESHTASTIC_MQTT_DEFAULT_BROKER = "mqtt.meshtastic.org"
MESHTASTIC_MQTT_DEFAULT_TOPIC = "msh/+/+/json/#"
MESHTASTIC_MQTT_DEFAULT_PORT = 1883

# Node type labels from the MeshCore map source
_NODE_TYPE_LABELS: dict[int, str] = {
    1: "Client",
    2: "Repeater",
    3: "Room Server",
    4: "Sensor",
}

_RETICULUM_FETCH_HEADERS = {
    "Accept": "application/json",
    "X-Requested-With": "XMLHttpRequest",
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


def _parse_reticulum_location(location: Any) -> tuple[float, float] | None:
    """Parse a 'lat,lon' location string from directory.rns.recipes.

    Returns (lat, lon) floats, or None if the string is missing, empty,
    or does not contain valid coordinates.
    """
    if not location or not isinstance(location, str):
        return None
    parts = location.strip().split(",")
    if len(parts) != 2:
        return None
    try:
        lat = float(parts[0].strip())
        lon = float(parts[1].strip())
    except ValueError:
        return None
    if not (-90.0 <= lat <= 90.0) or not (-180.0 <= lon <= 180.0):
        return None
    # Nodes reported at 0,0 (null island) have no real position
    if lat == 0.0 and lon == 0.0:
        return None
    return lat, lon


def _normalize_reticulum_nodes(raw_nodes: list[Any]) -> list[dict[str, Any]]:
    """Normalize raw directory.rns.recipes JSON node objects into our standard shape.

    Each raw node has (at minimum):
      name         — display name
      typeName     — human-readable node type (e.g. "RNode", "NomadNet", "TCP")
      location     — "lat,lon" string (may be missing or empty)
      frequencyHuman — e.g. "915 MHz" (LoRa nodes only)
      bandwidthHuman — e.g. "250 kHz" (LoRa nodes only)
      spreadingFactor — int (LoRa nodes only)
      codingRate   — e.g. "4/5" (LoRa nodes only)

    Nodes without a valid location are skipped.
    Duplicate nodes (same name + rounded coords) from submitted+discovered are deduplicated.
    """
    seen: set[tuple[str, float, float]] = set()
    normalized: list[dict[str, Any]] = []

    for node in raw_nodes:
        if not isinstance(node, dict):
            continue

        # Must have a valid location
        coords = _parse_reticulum_location(node.get("location"))
        if coords is None:
            continue
        lat, lon = coords

        # Name — skip unnamed nodes
        name = str(node.get("name") or "").strip()
        if not name:
            continue

        # Deduplicate: same name + position (rounded to 4dp ≈ 11m precision)
        dedup_key = (name, round(lat, 4), round(lon, 4))
        if dedup_key in seen:
            continue
        seen.add(dedup_key)

        # Build description from node type + LoRa radio params
        desc_parts: list[str] = []
        type_name = node.get("typeName") or node.get("type_name") or ""
        if type_name:
            desc_parts.append(f"Type: {type_name}")

        freq = node.get("frequencyHuman") or node.get("frequency_human") or ""
        bw = node.get("bandwidthHuman") or node.get("bandwidth_human") or ""
        sf = node.get("spreadingFactor") or node.get("spreading_factor")
        cr = node.get("codingRate") or node.get("coding_rate") or ""

        if freq:
            desc_parts.append(f"Freq: {freq}")
        if bw:
            desc_parts.append(f"BW: {bw}")
        if sf:
            desc_parts.append(f"SF: {sf}")
        if cr:
            desc_parts.append(f"CR: {cr}")

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


def _collect_meshtastic_mqtt(broker: str, port: int, topic: str, duration: int) -> dict[str, dict]:
    """Connect to an MQTT broker, subscribe to Meshtastic JSON topic, collect nodes.

    Runs in a thread executor (blocking). Returns dict keyed by node_id str.
    Raises ValueError on connection failure.
    """
    try:
        import paho.mqtt.client as mqtt
    except ImportError:
        raise ValueError("paho-mqtt is not installed. Run: pip install paho-mqtt")

    nodes: dict[str, dict] = {}
    connect_event = threading.Event()
    connect_error: list[str] = []

    def on_connect(client, userdata, flags, reason_code, properties=None):
        if hasattr(reason_code, 'value'):
            rc = reason_code.value
        else:
            rc = int(reason_code)
        if rc == 0:
            client.subscribe(topic)
            connect_event.set()
        else:
            connect_error.append(f"Broker refused connection (code {rc})")
            connect_event.set()

    def on_message(client, userdata, msg):
        try:
            payload = json.loads(msg.payload.decode("utf-8", errors="replace"))
            msg_type = payload.get("type")
            from_id = str(payload.get("from", "")).strip()
            if not from_id or from_id == "0":
                return
            data = payload.get("payload") or {}

            if msg_type == "nodeinfo":
                name = (data.get("longname") or data.get("shortname") or "").strip()
                if not name:
                    name = f"Meshtastic-{from_id}"
                entry = nodes.setdefault(from_id, {"name": name, "lat": None, "lon": None, "description": ""})
                entry["name"] = name
                hw = data.get("hardware")
                if hw is not None:
                    entry["description"] = f"Hardware model {hw}"

            elif msg_type == "position":
                lat_i = data.get("latitude_i")
                lon_i = data.get("longitude_i")
                if lat_i is not None and lon_i is not None:
                    lat = lat_i / 1e7
                    lon = lon_i / 1e7
                    if -90.0 <= lat <= 90.0 and -180.0 <= lon <= 180.0 and not (lat == 0.0 and lon == 0.0):
                        entry = nodes.setdefault(from_id, {"name": f"Meshtastic-{from_id}", "lat": None, "lon": None, "description": ""})
                        entry["lat"] = round(lat, 6)
                        entry["lon"] = round(lon, 6)
        except Exception:
            pass

    try:
        client_id = f"meshplanner_{secrets.token_hex(4)}"
        try:
            # paho-mqtt 2.x
            client = mqtt.Client(mqtt.CallbackAPIVersion.VERSION2, client_id=client_id)
        except AttributeError:
            # paho-mqtt 1.x fallback
            client = mqtt.Client(client_id=client_id)
        client.on_connect = on_connect
        client.on_message = on_message
        client.connect(broker, port, keepalive=60)
    except Exception as exc:
        raise ValueError(f"Cannot connect to {broker}:{port} — {exc}")

    client.loop_start()
    connected = connect_event.wait(timeout=10)
    if not connected or connect_error:
        client.loop_stop()
        client.disconnect()
        raise ValueError(connect_error[0] if connect_error else f"Timed out connecting to {broker}:{port}")

    time.sleep(duration)
    client.loop_stop()
    client.disconnect()
    return nodes


@router.get("/import/meshtastic-mqtt")
async def fetch_meshtastic_mqtt_nodes(
    broker: str = Query(default=MESHTASTIC_MQTT_DEFAULT_BROKER, description="MQTT broker hostname or IP"),
    port: int = Query(default=MESHTASTIC_MQTT_DEFAULT_PORT, ge=1, le=65535, description="MQTT broker port"),
    topic: str = Query(default=MESHTASTIC_MQTT_DEFAULT_TOPIC, description="MQTT topic filter"),
    duration: int = Query(default=15, ge=5, le=60, description="Listen duration in seconds"),
) -> dict[str, Any]:
    """Collect Meshtastic node positions via MQTT and return normalized node list.

    Subscribes to the broker for `duration` seconds, collects nodeinfo and position
    messages, and returns nodes that have both a name and GPS coordinates.
    """
    loop = asyncio.get_event_loop()
    try:
        nodes_dict = await loop.run_in_executor(
            None, _collect_meshtastic_mqtt, broker, port, topic, duration
        )
    except ValueError as exc:
        raise HTTPException(status_code=503, detail=str(exc))

    result = [
        {
            "name": v["name"],
            "lat": v["lat"],
            "lon": v["lon"],
            "description": v.get("description", ""),
        }
        for v in nodes_dict.values()
        if v.get("lat") is not None and v.get("lon") is not None
    ]

    logger.info(
        "Meshtastic MQTT import: %d raw nodes tracked, %d with position",
        len(nodes_dict), len(result),
    )
    return {"source": "meshtastic_mqtt", "nodes": result, "count": len(result)}


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
    source: str = Query(default="meshcore", description="Map source: 'meshcore' or 'reticulum'"),
) -> dict[str, Any]:
    """Proxy endpoint — fetch nodes from a public mesh network map and normalize them.

    Args:
        source: Which map to fetch from. Supported: 'meshcore', 'reticulum'.

    Returns:
        JSON: {"source": str, "nodes": [...], "count": int}

    Raises:
        HTTPException 400: Unknown source
        HTTPException 503: Upstream fetch failed
    """
    if source == "meshcore":
        return await _fetch_meshcore()
    elif source == "reticulum":
        return await _fetch_reticulum()
    else:
        raise HTTPException(
            status_code=400,
            detail=f"Unknown source: '{source}'. Supported: 'meshcore', 'reticulum'",
        )


async def _fetch_meshcore() -> dict[str, Any]:
    """Fetch and normalize nodes from the MeshCore map (map.meshcore.dev)."""
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
        if isinstance(raw_nodes, dict):
            raw_nodes = raw_nodes.get("nodes") or raw_nodes.get("data") or []
        else:
            raw_nodes = []

    nodes = _normalize_meshcore_nodes(raw_nodes)
    logger.info(
        "MeshCore import: fetched %d raw nodes, normalized %d with coordinates",
        len(raw_nodes), len(nodes),
    )
    return {"source": "meshcore", "nodes": nodes, "count": len(nodes)}


async def _fetch_reticulum() -> dict[str, Any]:
    """Fetch and normalize nodes from directory.rns.recipes (submitted + discovered)."""
    all_raw: list[Any] = []

    for url in (RETICULUM_SUBMITTED_URL, RETICULUM_DISCOVERED_URL):
        try:
            async with httpx.AsyncClient(timeout=15.0) as client:
                response = await client.get(
                    url,
                    headers=_RETICULUM_FETCH_HEADERS,
                    follow_redirects=True,
                )
                response.raise_for_status()
                data = response.json()
        except httpx.TimeoutException:
            logger.warning("Reticulum directory timed out fetching %s", url)
            raise HTTPException(
                status_code=503,
                detail="Reticulum directory timed out. Please try again.",
            )
        except httpx.HTTPStatusError as exc:
            logger.warning("Reticulum directory returned HTTP %d for %s", exc.response.status_code, url)
            raise HTTPException(
                status_code=503,
                detail=f"Reticulum directory returned HTTP {exc.response.status_code}.",
            )
        except httpx.RequestError as exc:
            logger.warning("Reticulum directory request error: %s", exc)
            raise HTTPException(
                status_code=503,
                detail="Could not reach Reticulum directory. Check internet connectivity.",
            )
        except Exception as exc:
            logger.error("Reticulum directory JSON decode error: %s", exc)
            raise HTTPException(
                status_code=503,
                detail="Reticulum directory returned unreadable data.",
            )

        # Both endpoints return {"data": [...]}
        if isinstance(data, dict):
            entries = data.get("data") or data.get("nodes") or []
        elif isinstance(data, list):
            entries = data
        else:
            entries = []
        all_raw.extend(entries)

    nodes = _normalize_reticulum_nodes(all_raw)
    logger.info(
        "Reticulum import: fetched %d raw records, normalized %d with coordinates",
        len(all_raw), len(nodes),
    )
    return {"source": "reticulum", "nodes": nodes, "count": len(nodes)}
