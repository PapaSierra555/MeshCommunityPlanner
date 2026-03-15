"""SQLite connection manager and migration framework.

Provides DatabaseManager for connection lifecycle with WAL mode, file permissions,
and foreign keys. Includes a simple version-based migration framework per Decision 14.

Thread safety: FastAPI async handlers run across multiple threads. The single
shared connection uses check_same_thread=False with a threading lock to
serialize write operations.  WAL mode allows concurrent reads while writes
are serialized by the lock + busy_timeout.
"""

from __future__ import annotations

import atexit
import logging
import os
import shutil
import sqlite3
import sys
import threading
from pathlib import Path

logger = logging.getLogger(__name__)


class DatabaseManager:
    """Manages SQLite database connections with proper configuration.

    Features:
    - WAL journal mode for concurrent reads
    - Foreign keys enabled
    - busy_timeout for write contention handling
    - Threading lock for write serialization
    - Startup integrity check with auto-recovery
    - User-only file permissions (600 on Unix)
    - Row factory for dict-like row access
    - Context manager support
    """

    def __init__(self, db_path: Path | str, check_same_thread: bool = False):
        self._db_path = Path(db_path)
        self._connection: sqlite3.Connection | None = None
        self._check_same_thread = check_same_thread
        self._write_lock = threading.Lock()

    def open(self) -> None:
        """Open a connection to the database, creating file and dirs if needed."""
        # Create parent directories
        self._db_path.parent.mkdir(parents=True, exist_ok=True)

        # Check integrity of existing database before opening
        # Skip check for brand-new (0-byte) databases
        if self._db_path.exists() and self._db_path.stat().st_size > 0:
            self._check_and_recover()

        self._connection = sqlite3.connect(
            str(self._db_path),
            check_same_thread=self._check_same_thread,
            timeout=10,  # Wait up to 10s for locks
        )
        self._connection.row_factory = sqlite3.Row

        # Enable WAL mode, foreign keys, busy timeout, and crash-safety pragmas
        self._connection.execute("PRAGMA journal_mode=WAL")
        self._connection.execute("PRAGMA foreign_keys=ON")
        self._connection.execute("PRAGMA busy_timeout=5000")
        # FULL synchronous: fsync after every write — survives OS crash or force-kill
        self._connection.execute("PRAGMA synchronous=FULL")
        # Auto-checkpoint at 200 pages (default 1000) — keeps WAL small,
        # reduces replay time on recovery, and limits corruption surface area
        self._connection.execute("PRAGMA wal_autocheckpoint=200")

        # Register a lightweight checkpoint as atexit so Ctrl+C and normal
        # Python exits in dev workflows also close the DB gracefully.
        # Has no effect if close() already ran (connection will be None).
        atexit.register(self.close)

        # Set file permissions (Unix only)
        self._set_file_permissions()

    def _check_and_recover(self) -> None:
        """Check database integrity and recover from corruption if needed.

        If the database is corrupted, backs it up and deletes the original
        so the app can re-create and re-seed a fresh database.
        """
        is_corrupted = False
        check_conn = None
        try:
            check_conn = sqlite3.connect(str(self._db_path), timeout=5)
            result = check_conn.execute("PRAGMA integrity_check").fetchone()
            if result and result[0] == "ok":
                return  # Database is healthy
            logger.error("Database integrity check failed: %s", result)
            is_corrupted = True
        except sqlite3.DatabaseError as e:
            logger.error("Database corruption detected: %s", e)
            is_corrupted = True
        except Exception as e:
            logger.warning("Could not check database integrity: %s", e)
        finally:
            # CRITICAL: close the check connection BEFORE attempting file ops
            if check_conn is not None:
                try:
                    check_conn.close()
                except Exception:
                    pass

        if not is_corrupted:
            return

        # Database is corrupted — back it up and delete
        backup_path = self._db_path.with_suffix(".db.corrupted")
        try:
            shutil.copy2(self._db_path, backup_path)
            logger.warning("Backed up corrupted database to %s", backup_path)
        except Exception:
            pass

        # On Windows, file locks can linger briefly after close
        import time
        time.sleep(0.2)

        try:
            self._db_path.unlink()
            # Also remove WAL and SHM files
            for suffix in (".db-wal", ".db-shm"):
                wal_path = self._db_path.with_suffix(suffix)
                if wal_path.exists():
                    wal_path.unlink()
            logger.warning(
                "Deleted corrupted database — will re-create on startup"
            )
        except Exception as e:
            logger.error("Could not delete corrupted database: %s", e)
            # Last resort: rename the corrupted file out of the way
            try:
                renamed = self._db_path.with_suffix(".db.bad")
                self._db_path.rename(renamed)
                logger.warning("Renamed corrupted database to %s", renamed)
            except Exception:
                logger.error(
                    "FATAL: Cannot remove corrupted database. "
                    "Please manually delete %s and restart.",
                    self._db_path,
                )

    def _set_file_permissions(self) -> None:
        """Set user-only file permissions on the database file."""
        if sys.platform != "win32" and self._db_path.exists():
            os.chmod(self._db_path, 0o600)

    @property
    def connection(self) -> sqlite3.Connection:
        """Get the active database connection."""
        if self._connection is None:
            msg = "Database not opened. Call open() first."
            raise RuntimeError(msg)
        return self._connection

    @property
    def write_lock(self) -> threading.Lock:
        """Threading lock for serializing write operations."""
        return self._write_lock

    def close(self) -> None:
        """Close the database connection."""
        if self._connection is not None:
            try:
                # PASSIVE checkpoint: only writes WAL frames not held by any
                # reader. Safe to interrupt — WAL remains intact if killed
                # mid-checkpoint, and SQLite replays it on next open.
                # Do NOT use TRUNCATE here: a force-kill during TRUNCATE
                # leaves partially-written main DB pages with the WAL gone.
                self._connection.execute("PRAGMA wal_checkpoint(PASSIVE)")
            except Exception:
                pass
            self._connection.close()
            self._connection = None

    def __enter__(self):
        self.open()
        return self

    def __exit__(self, exc_type, exc_val, exc_tb):
        self.close()
        return False


def get_schema_version(conn: sqlite3.Connection) -> int:
    """Get the current schema version from the meta table.

    Returns 0 if the meta table doesn't exist or has no schema_version entry.
    """
    try:
        row = conn.execute(
            "SELECT value FROM meta WHERE key = 'schema_version'"
        ).fetchone()
        if row is None:
            return 0
        return int(row[0])
    except sqlite3.OperationalError:
        # meta table doesn't exist yet
        return 0


def _ensure_meta_table(conn: sqlite3.Connection) -> None:
    """Create the meta table if it doesn't exist."""
    conn.execute(
        "CREATE TABLE IF NOT EXISTS meta (key TEXT PRIMARY KEY, value TEXT NOT NULL)"
    )


def _set_schema_version(conn: sqlite3.Connection, version: int) -> None:
    """Set the schema version in the meta table."""
    conn.execute(
        "INSERT OR REPLACE INTO meta (key, value) VALUES ('schema_version', ?)",
        (str(version),),
    )


def _apply_migration(conn: sqlite3.Connection, version: int, sql: str) -> None:
    """Apply a single migration inside a transaction.

    Rolls back on any failure, leaving the DB at the previous version.
    Splits SQL into individual statements and executes each within a
    single transaction (executescript does an implicit COMMIT first,
    which would break rollback semantics).
    """
    # Split on semicolons, filtering out empty/whitespace-only statements
    statements = [s.strip() for s in sql.split(";") if s.strip()]

    conn.execute("BEGIN")
    try:
        for stmt in statements:
            conn.execute(stmt)
        _set_schema_version(conn, version)
        conn.execute("COMMIT")
    except Exception:
        conn.execute("ROLLBACK")
        raise


def _get_migration_files() -> dict[int, Path]:
    """Discover migration SQL files in the migrations directory.

    Files must be named like: 001_description.sql
    Returns dict mapping version number to file path.
    """
    migrations_dir = Path(__file__).parent / "migrations"
    result = {}
    if not migrations_dir.is_dir():
        return result

    for f in sorted(migrations_dir.glob("*.sql")):
        # Extract version number from filename: "001_initial_schema.sql" -> 1
        try:
            version = int(f.stem.split("_", 1)[0])
            result[version] = f
        except (ValueError, IndexError):
            continue

    return result


def run_migrations(conn: sqlite3.Connection) -> None:
    """Run all pending migrations in order.

    Each migration runs in its own transaction. If a migration fails,
    it is rolled back and no further migrations are applied.
    """
    _ensure_meta_table(conn)
    current_version = get_schema_version(conn)
    migrations = _get_migration_files()

    for version in sorted(migrations):
        if version > current_version:
            sql = migrations[version].read_text(encoding="utf-8")
            _apply_migration(conn, version, sql)
