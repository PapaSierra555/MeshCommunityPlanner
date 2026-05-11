"""FastAPI application entry point — merged from W1 + W2 + W3.

Configures middleware stack per Decision 12:
1. SecurityHeadersMiddleware (outermost — always runs)
2. CORSMiddleware (origin check)
3. RequestSizeLimitMiddleware (10 MB max body)
4. AuthMiddleware (per-route via middleware, /health bypassed)
Auth + rate limiting applied per-route.

Registers all routers:
- W2: 8 REST API routers (plans, nodes, catalog, regulatory, etc.)
- W3: engine router (propagation, topology, power, BOM, file I/O, WebSocket)

Database lifecycle:
- Lifespan startup: open DB, run migrations, load seed data, init shared dependency
- Lifespan shutdown: close DB
"""

from __future__ import annotations

import json
import logging
import logging.handlers
from contextlib import asynccontextmanager
from pathlib import Path

from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import HTMLResponse
from fastapi.staticfiles import StaticFiles

from backend.app.auth.middleware import AuthMiddleware
from backend.app.auth.token import get_token
from backend.app.config import (
    find_available_port,
    get_app_mode,
    get_bind_host,
    get_data_dir,
    get_db_path,
    get_port,
    is_production_mode,
    is_test_mode,
)
from backend.app.lifecycle import ShutdownManager, cleanup_stale_instance, install_signal_handlers, write_pid_file
from backend.app.db.connection import init_db_manager
from backend.app.db.database import DatabaseManager, run_migrations
from backend.app.db.write_lock_middleware import WriteSerializationMiddleware
from backend.app.db.seed.loader import load_sample_plans, load_seed_data, load_settings_defaults
from backend.app.security.headers import SecurityHeadersMiddleware
from backend.app.security.rate_limit import configure_rate_limiting
from backend.app.security.request_size import RequestSizeLimitMiddleware
from backend.app.websocket.ticket import TicketManager

logger = logging.getLogger(__name__)

# Module-level token — generated once at app creation, lives in process memory only
_app_token: str | None = None

# Lazily-initialized FastAPI app (created after port resolution when possible)
_app: FastAPI | None = None

# Module-level database manager — lives for the process lifetime
_db_manager: DatabaseManager | None = None

# Module-level shutdown manager — registered cleanup callbacks run on exit
_shutdown_mgr = ShutdownManager()


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Application startup and shutdown lifecycle."""
    global _db_manager  # noqa: PLW0603

    # --- Startup ---
    # Open database, run migrations, seed catalog data.
    # Note: test-token auth is useful for local dev, but this app still needs
    # the database initialized in that mode for plans/catalog/settings to work.
    db_path = get_db_path()
    _db_manager = DatabaseManager(db_path)
    _db_manager.open()
    conn = _db_manager.connection

    run_migrations(conn)
    load_seed_data(conn)
    load_settings_defaults(conn)
    load_sample_plans(conn)
    init_db_manager(_db_manager)

    # Register DB close as a shutdown callback so it runs even on
    # Ctrl+C / console close (via lifecycle signal handlers)
    _shutdown_mgr.on_shutdown(_db_manager.close)

    logger.info("Database initialized at %s", db_path)

    yield

    # --- Shutdown (normal uvicorn stop) ---
    if _db_manager is not None:
        _db_manager.close()
        logger.info("Database connection closed")


def _register_w2_routers(app: FastAPI) -> None:
    """Register core REST API routers under /api."""
    import os as _os

    from backend.app.api.health import router as health_router
    from backend.app.api.plans import router as plans_router
    from backend.app.api.nodes import router as nodes_router
    from backend.app.api.sites import router as sites_router
    from backend.app.api.mounts import router as mounts_router
    from backend.app.api.radio_profiles import router as radio_profiles_router
    from backend.app.api.catalog import router as catalog_router
    from backend.app.api.internet_map import router as internet_map_router
    from backend.app.api.signal_import import router as signal_import_router
    from backend.app.api.field_observations import router as field_observations_router

    app.include_router(health_router, prefix="/api")
    app.include_router(plans_router, prefix="/api")
    app.include_router(nodes_router, prefix="/api")
    app.include_router(sites_router, prefix="/api")
    app.include_router(mounts_router, prefix="/api")
    app.include_router(radio_profiles_router, prefix="/api")
    app.include_router(catalog_router, prefix="/api")
    app.include_router(internet_map_router, prefix="/api")
    app.include_router(signal_import_router, prefix="/api")
    app.include_router(field_observations_router, prefix="/api")

    # Mount static files (icons for KML overlays, etc.)
    _static_dir = _os.path.join(_os.path.dirname(__file__), "static")
    if _os.path.isdir(_static_dir):
        app.mount("/static", StaticFiles(directory=_static_dir), name="static")


def _register_w3_router(app: FastAPI, ticket_manager: TicketManager) -> None:
    """Register W3 engine router with WebSocket wiring.

    W3's router already has /api prefix built in — include with NO prefix kwarg.
    """
    from backend.app.websocket.handler import WebSocketHandler
    from backend.app.websocket.progress import ProgressManager
    from backend.app.api.router import create_w3_router
    from backend.app.services.propagation.srtm import SRTMManager

    progress_manager = ProgressManager()
    ws_handler = WebSocketHandler(ticket_manager, progress_manager)

    # Initialize SRTM terrain data manager for LOS elevation queries
    data_dir = get_data_dir()
    srtm_dir = str(data_dir / "srtm")
    sdf_dir = str(data_dir / "sdf")
    srtm_manager = SRTMManager(srtm_dir=srtm_dir, sdf_dir=sdf_dir)
    logger.info("SRTM manager initialized (srtm=%s, sdf=%s)", srtm_dir, sdf_dir)

    w3_router = create_w3_router(ws_handler=ws_handler, auth_token=_app_token, srtm_manager=srtm_manager)  # auth_token for tile query-param auth
    app.include_router(w3_router)


def _register_error_handlers(app: FastAPI) -> None:
    """Register W2 custom error handlers if available."""
    try:
        from backend.app.api.error_handlers import register_error_handlers
        register_error_handlers(app)
    except ImportError:
        pass  # W2 error handlers not yet merged


def create_app(port: int | None = None) -> FastAPI:
    """Create and configure the FastAPI application."""
    global _app_token  # noqa: PLW0603

    production = is_production_mode()

    app = FastAPI(
        title="Mesh Community Planner",
        version="0.1.0",
        description="Desktop web application for planning LoRa mesh network deployments",
        docs_url="/docs",
        redoc_url="/redoc",
        lifespan=lifespan,
    )

    # Generate auth token (once per app creation)
    _app_token = get_token()

    # --- Middleware stack (order matters: last added = outermost) ---
    # Write serialization (innermost — serializes POST/PUT/PATCH/DELETE through a lock)
    app.add_middleware(WriteSerializationMiddleware)

    # Auth check (after size/CORS/headers/versioning)
    app.add_middleware(AuthMiddleware, token=_app_token)

    # Request size limit
    app.add_middleware(RequestSizeLimitMiddleware, max_size=15 * 1024 * 1024)

    # CORS
    if port is None:
        port = get_port()
    host = get_bind_host()
    app.add_middleware(
        CORSMiddleware,
        allow_origins=[
            f"http://{host}:{port}",
            f"http://127.0.0.1:{port}",
            "http://127.0.0.1:5173",
        ],
        allow_methods=["*"],
        allow_headers=["Authorization", "Content-Type"],
    )

    # Security headers (outermost — always runs)
    app.add_middleware(SecurityHeadersMiddleware)

    # Rate limiting
    configure_rate_limiting(app)

    # --- WebSocket ticket manager (shared between W1 ticket endpoint and W3 router) ---
    ticket_manager = TicketManager()

    # --- Register routers ---
    # W2 REST API routers (try/except for pre-merge when W2 code isn't present)
    w2_available = False
    try:
        _register_w2_routers(app)
        w2_available = True
    except ImportError as e:
        logger.warning("W2 routers not available — running without REST API endpoints")
        logger.error(f"Import error details: {e}", exc_info=True)

    # Fallback health endpoint when W2 health router isn't available
    if not w2_available:
        from fastapi.responses import JSONResponse

        @app.get("/api/health")
        async def health():
            return JSONResponse(content={"status": "ok"})

    # W3 engine router (try/except for pre-merge when W3 code isn't present)
    try:
        _register_w3_router(app, ticket_manager)
    except ImportError:
        logger.warning("W3 router not available — running without engine endpoints")

    # W2 error handlers
    _register_error_handlers(app)

    # Silence Chrome DevTools .well-known probe (returns 204 instead of 404 log noise)
    from fastapi.responses import Response

    @app.get("/.well-known/{path:path}", include_in_schema=False)
    async def well_known_sink(path: str):
        return Response(status_code=204)

    # --- Shutdown endpoint (desktop app: browser tab close triggers server exit) ---
    if production and get_app_mode():
        from fastapi.responses import JSONResponse as _JSONResp

        @app.post("/api/shutdown", include_in_schema=False)
        async def shutdown(request: Request):
            """Graceful shutdown — called by frontend on beforeunload.

            Only local browser sessions may stop the desktop server. When the
            app is bound to 0.0.0.0 for Tailscale/LAN access, remote tabs must
            not be able to terminate the process on refresh or close.
            """
            import os, signal, threading

            client_host = request.client.host if request.client else ""
            if client_host not in {"127.0.0.1", "::1", "localhost"}:
                return _JSONResp(content={"status": "ignored", "reason": "remote_client"})

            def _deferred_exit():
                import time
                time.sleep(0.5)  # Let the response flush
                os.kill(os.getpid(), signal.SIGTERM)

            threading.Thread(target=_deferred_exit, daemon=True).start()
            return _JSONResp(content={"status": "shutting_down"})

    # --- Frontend auth token injection (Task 3.12) ---
    # In PyInstaller bundles, sys._MEIPASS points to the _internal/ directory
    import sys
    if getattr(sys, '_MEIPASS', None):
        frontend_dist = Path(sys._MEIPASS) / "frontend" / "dist"
    else:
        frontend_dist = Path(__file__).resolve().parent.parent.parent / "frontend" / "dist"

    if frontend_dist.is_dir():
        index_html_path = frontend_dist / "index.html"

        # Cache the injected HTML at startup (token is stable for the process lifetime)
        _cached_index: str | None = None
        if index_html_path.exists():
            _raw_html = index_html_path.read_text(encoding="utf-8")
            injection = (
                f"<script>window.__MESH_PLANNER_AUTH__ = {json.dumps(_app_token)};</script>"
            )
            _cached_index = _raw_html.replace("</head>", f"{injection}</head>")

        @app.get("/", response_class=HTMLResponse)
        async def serve_index():
            """Serve index.html with auth token injected."""
            if _cached_index is not None:
                return HTMLResponse(content=_cached_index)
            return HTMLResponse(content="<html><body>Frontend not built</body></html>")

        app.mount(
            "/", StaticFiles(directory=str(frontend_dist), html=False), name="frontend"
        )

    return app


def get_app(port: int | None = None) -> FastAPI:
    """Return the module's FastAPI app, creating it lazily if needed."""
    global _app  # noqa: PLW0603
    if _app is None:
        _app = create_app(port=port)
    return _app


def __getattr__(name: str):
    """Provide lazy `app` attribute for `uvicorn backend.app.main:app`."""
    if name == "app":
        return get_app()
    raise AttributeError(name)


if __name__ == "__main__":
    import os
    import sys
    import traceback
    import uvicorn

    # ---- Windowless mode (console=False on Windows) ----
    # When PyInstaller builds with console=False, sys.stdout/stderr are None.
    # Redirect them to devnull so logging, uvicorn, and print() don't crash.
    if sys.stdout is None:
        sys.stdout = open(os.devnull, "w", encoding="utf-8")
    if sys.stderr is None:
        sys.stderr = open(os.devnull, "w", encoding="utf-8")

    # ---- Crash log setup ----
    # Write a persistent crash log so errors survive console window closing
    _crash_log_path = get_data_dir() / "crash.log"

    def _write_crash_log(header: str, detail: str) -> None:
        """Append a timestamped crash entry to the crash log file."""
        try:
            from datetime import datetime, timezone
            ts = datetime.now(timezone.utc).isoformat()
            with open(_crash_log_path, "a", encoding="utf-8") as f:
                f.write(f"\n{'=' * 60}\n")
                f.write(f"[{ts}] {header}\n")
                f.write(f"{detail}\n")
        except Exception:
            pass  # Can't do anything if crash logging itself fails

    # ---- Global exception hook ----
    # Catches ALL unhandled exceptions and writes them to the crash log
    _original_excepthook = sys.excepthook

    def _crash_excepthook(exc_type, exc_value, exc_tb):
        detail = "".join(traceback.format_exception(exc_type, exc_value, exc_tb))
        _write_crash_log("UNHANDLED EXCEPTION", detail)
        # Also print to stderr (visible if console is still open)
        sys.stderr.write(f"\n[CRASH] Unhandled exception — see {_crash_log_path}\n")
        sys.stderr.write(detail)
        sys.stderr.flush()
        _original_excepthook(exc_type, exc_value, exc_tb)

    sys.excepthook = _crash_excepthook

    # ---- Unhandled async exception hook ----
    import asyncio

    def _async_exception_handler(loop, context):
        exc = context.get("exception")
        msg = context.get("message", "")
        if exc:
            detail = "".join(traceback.format_exception(type(exc), exc, exc.__traceback__))
        else:
            detail = msg
        _write_crash_log("ASYNC EXCEPTION", detail)
        logger.error("Async exception: %s", detail)

    # ---- Configure standard logging ----
    # Without this, logging.getLogger(__name__) loggers have no handlers
    # and messages below WARNING are silently dropped
    import logging as _logging
    get_data_dir().mkdir(parents=True, exist_ok=True)
    _log_file = get_data_dir() / "server.log"
    _logging.basicConfig(
        level=_logging.INFO,
        format="%(asctime)s [%(levelname)s] %(name)s: %(message)s",
        handlers=[
            _logging.StreamHandler(sys.stderr),
            _logging.handlers.RotatingFileHandler(
                str(_log_file), maxBytes=5 * 1024 * 1024, backupCount=3,
                encoding="utf-8",
            ),
        ],
    )

    # ---- Main startup ----
    try:
        # 1. Clean up any stale instance from a previous run
        cleanup_stale_instance()

        # 2. Install signal/console handlers that do cleanup before os._exit()
        #    (closes DB, removes PID file — then force-exits to bypass uvicorn hang)
        install_signal_handlers(_shutdown_mgr)

        # 3. Find an available port
        host = get_bind_host()
        port = get_port()

        available_port = find_available_port(host)

        # If app_mode is true, find other available port if needed
        if available_port != port:
            if get_app_mode():
                print(f"Port {port} in use \u2014 using port {available_port} instead")    
                port = available_port
            else: 
                print(f"Port {port} already in use \u2014")

        # 4. Write PID + port files for single-instance enforcement
        write_pid_file(port)

        print(f"Starting Mesh Community Planner at http://{host}:{port}")

        # Install async exception handler once the event loop exists
        loop = asyncio.new_event_loop()
        loop.set_exception_handler(_async_exception_handler)
        asyncio.set_event_loop(loop)

        production = is_production_mode()

        # Create the FastAPI app after resolving the final port so CORS matches.
        app = get_app(port=port)

        # Auto-open browser once server is ready (production/PyInstaller only, app_mode enabled).
        # Linux launcher scripts open the browser themselves and set
        # MESH_PLANNER_NO_BROWSER=1 to prevent a duplicate tab.
        # macOS and Windows use this code path directly (no launcher wrapper).
        if production and get_app_mode() and not os.environ.get("MESH_PLANNER_NO_BROWSER"):
            import threading
            import webbrowser
            import urllib.request

            def _open_browser_when_ready():
                url = f"http://{host}:{port}"
                for _ in range(30):
                    import time
                    time.sleep(1)
                    try:
                        urllib.request.urlopen(f"{url}/api/health", timeout=2)
                        webbrowser.open(url)
                        return
                    except Exception:
                        continue

            threading.Thread(target=_open_browser_when_ready, daemon=True).start()

        os.environ["MESH_PLANNER_PORT"] = str(port)
        os.environ["MESH_PLANNER_HOST"] = host

        uvicorn.run(
            app if production else "backend.app.main:get_app",
            factory=not production,
            host=host,
            port=port,
            reload=not production,
            timeout_graceful_shutdown=3,
        )

    except KeyboardInterrupt:
        print("\nShutting down (Ctrl+C)...")

    except SystemExit:
        pass  # Normal exit via os._exit() or sys.exit()

    except Exception:
        detail = traceback.format_exc()
        _write_crash_log("SERVER CRASH", detail)
        sys.stderr.write(f"\n{'=' * 60}\n")
        sys.stderr.write(f"FATAL: Server crashed — log saved to {_crash_log_path}\n")
        sys.stderr.write(f"{'=' * 60}\n")
        sys.stderr.write(detail)
        sys.stderr.write(f"\n{'=' * 60}\n")
        sys.stderr.flush()
        # Keep console open so user can read the error
        if is_production_mode():
            try:
                input("Press Enter to close this window...")
            except EOFError:
                pass
