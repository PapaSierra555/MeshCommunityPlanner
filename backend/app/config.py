"""Application configuration and mode detection."""

import json
import os
import sys
from dataclasses import dataclass
from pathlib import Path
from typing import Any

class ConfigurationError(Exception):
    """Raised when application configuration is invalid."""

CONFIG_FILENAME = "config.json"
DEFAULT_HOST = "127.0.0.1"
DEFAULT_PORT = 8321

# Module-level cache so configuration is parsed only once per process
_CACHED_CONFIG: "AppConfig | None" = None


@dataclass
class AppConfig:
    """Configuration values loaded from file and environment."""

    bind_host: str = DEFAULT_HOST
    webui_port: int = DEFAULT_PORT
    app_mode: bool = True


def is_test_mode() -> bool:
    """Check if running in test mode (MESH_PLANNER_TEST_TOKEN env var set)."""
    return "MESH_PLANNER_TEST_TOKEN" in os.environ


def get_data_dir() -> Path:
    """Get the platform-appropriate data directory."""
    if custom := os.environ.get("MESH_PLANNER_DATA_DIR"):
        return Path(custom)

    if sys.platform == "win32":
        base = Path(os.environ.get("LOCALAPPDATA", Path.home() / "AppData" / "Local"))
        return base / "MeshCommunityPlanner"
    elif sys.platform == "darwin":
        return Path.home() / "Library" / "Application Support" / "MeshCommunityPlanner"
    else:
        return Path.home() / ".local" / "share" / "mesh-community-planner"


def get_config_path() -> Path:
    """Return the path to the main application config file."""
    return get_data_dir() / CONFIG_FILENAME


def ensure_default_config() -> None:
    """Create a default configuration file if none exists.

    The default values are:
    - bind_host: 127.0.0.1
    - webui_port: 8321
    - app_mode: True
    """
    path = get_config_path()
    data_dir = path.parent

    try:
        data_dir.mkdir(parents=True, exist_ok=True)
    except OSError as e:
        msg = f"Unable to create configuration directory {data_dir}: {e}"
        raise ConfigurationError(msg) from e

    if path.exists():
        return

    default_config = {
        "bind_host": DEFAULT_HOST,
        "webui_port": DEFAULT_PORT,
        "app_mode": True,
    }

    try:
        path.write_text(json.dumps(default_config, indent=2), encoding="utf-8")
    except OSError as e:
        msg = f"Unable to write default configuration file at {path}: {e}"
        raise ConfigurationError(msg) from e


def _load_config_from_file(path: Path) -> dict[str, Any]:
    """Load raw configuration mapping from a JSON file.

    Returns an empty mapping if the file does not exist.
    Raises ConfigurationError on parse errors.
    """
    if not path.exists():
        return {}

    try:
        text = path.read_text(encoding="utf-8")
    except OSError as e:
        msg = f"Unable to read configuration file at {path}: {e}"
        raise ConfigurationError(msg) from e

    try:
        raw = json.loads(text)
    except json.JSONDecodeError as e:
        msg = f"Invalid JSON in configuration file {path}: {e}"
        raise ConfigurationError(msg) from e

    if not isinstance(raw, dict):
        msg = f"Configuration file {path} must contain a JSON object at the top level"
        raise ConfigurationError(msg)

    return raw


def _validate_bind_host(host_value: str, source: str) -> str:
    """Validate bind_host value from config file or environment."""
    if not host_value or host_value.strip() != host_value:
        msg = f"{source} must be a non-empty string without leading/trailing whitespace"
        raise ConfigurationError(msg)
    return host_value


def load_app_config() -> AppConfig:
    """Load the effective application configuration.

    Precedence (lowest to highest):
    1. Built-in defaults
    2. Values from config.json (bind_host, webui_port, app_mode)
    3. Environment variables MESH_PLANNER_HOST, MESH_PLANNER_PORT
    """
    global _CACHED_CONFIG  # noqa: PLW0603

    if _CACHED_CONFIG is not None:
        return _CACHED_CONFIG

    # Ensure a default config file exists on first boot
    ensure_default_config()

    cfg = AppConfig()

    # 1/2. Load from config file if present
    raw = _load_config_from_file(get_config_path())
    if "bind_host" in raw:
        host_value = str(raw["bind_host"])
        cfg.bind_host = _validate_bind_host(host_value, "bind_host")
    if "webui_port" in raw:
        try:
            cfg.webui_port = int(raw["webui_port"])
        except (TypeError, ValueError) as e:
            msg = f"webui_port in configuration must be an integer: {e}"
            raise ConfigurationError(msg) from e
    if "app_mode" in raw:
        value = raw["app_mode"]
        if isinstance(value, bool):
            cfg.app_mode = value
        else:
            msg = "app_mode in configuration must be a boolean"
            raise ConfigurationError(msg)

    # 3. Environment overrides
    if host_env := os.environ.get("MESH_PLANNER_HOST"):
        cfg.bind_host = _validate_bind_host(host_env, "MESH_PLANNER_HOST")
    if port_env := os.environ.get("MESH_PLANNER_PORT"):
        try:
            cfg.webui_port = int(port_env)
        except (TypeError, ValueError) as e:
            msg = f"MESH_PLANNER_PORT must be an integer: {e}"
            raise ConfigurationError(msg) from e

    _CACHED_CONFIG = cfg
    return cfg


def get_bind_host() -> str:
    """Return the IP address or hostname to bind the WebUI server to."""
    cfg = load_app_config()
    return cfg.bind_host

def get_app_mode() -> bool:
    """Return True when running in desktop app mode."""
    cfg = load_app_config()
    return cfg.app_mode


def get_port() -> int:
    """Get the WebUI server port from config/env or default.

    Validates port is in range 1-65535.
    """
    cfg = load_app_config()
    port = cfg.webui_port
    if not 1 <= port <= 65535:
        msg = f"Invalid port {port}: must be 1-65535"
        raise ConfigurationError(msg)
    return port


def get_db_path() -> Path:
    """Get the database file path."""
    return get_data_dir() / "db" / "mesh_planner.db"


def find_available_port(host: str = "127.0.0.1") -> int:
    """Find an available port using a three-tier strategy.

    1. Try the preferred port (from MESH_PLANNER_PORT env or default 8321)
    2. Scan a small range above it (preferred+1 through preferred+9)
    3. Fall back to OS-assigned ephemeral port

    Returns an available port number.
    """
    import socket

    preferred = get_port()

    # Tier 1: preferred port
    if _port_is_free(host, preferred):
        return preferred

    # Tier 2: scan range
    for port in range(preferred + 1, preferred + 10):
        if _port_is_free(host, port):
            return port

    # Tier 3: OS-assigned
    with socket.socket(socket.AF_INET, socket.SOCK_STREAM) as s:
        s.bind((host, 0))
        return s.getsockname()[1]


def _port_is_free(host: str, port: int) -> bool:
    """Check if a port is available for binding."""
    import socket

    try:
        with socket.socket(socket.AF_INET, socket.SOCK_STREAM) as s:
            # Allow rebinding promptly after a browser refresh/tab close leaves
            # old TCP connections in TIME_WAIT/FIN_WAIT states.
            s.setsockopt(socket.SOL_SOCKET, socket.SO_REUSEADDR, 1)
            s.bind((host, port))
            return True
    except OSError:
        return False


def is_production_mode() -> bool:
    """Production mode: debug off, docs off, test tokens rejected."""
    return not is_test_mode() and os.environ.get("MESH_PLANNER_ENV") != "development"



def validate_config() -> list[str]:
    """Validate all configuration at startup.

    Returns list of warning messages for non-critical issues.
    Raises ConfigurationError for critical issues.
    """
    warnings = []

    # Validate bind host and port (via AppConfig / get_port)
    get_port()

    # Validate data directory is writable
    data_dir = get_data_dir()
    if str(data_dir) != ":memory:":
        try:
            data_dir.mkdir(parents=True, exist_ok=True)
            test_file = data_dir / ".config_test"
            test_file.write_text("test", encoding="utf-8")
            test_file.unlink()
        except OSError as e:
            msg = f"Data directory not writable: {data_dir} ({e})"
            raise ConfigurationError(msg) from e

    # Validate MESH_PLANNER_ENV if set
    env_mode = os.environ.get("MESH_PLANNER_ENV", "")
    valid_modes = {"", "development", "production", "test"}
    if env_mode and env_mode not in valid_modes:
        warnings.append(f"Unknown MESH_PLANNER_ENV '{env_mode}', expected: development, production, test")

    # Warn if test token set in production mode
    if os.environ.get("MESH_PLANNER_ENV") == "production" and is_test_mode():
        warnings.append("MESH_PLANNER_TEST_TOKEN is set in production mode — this is insecure")

    return warnings
