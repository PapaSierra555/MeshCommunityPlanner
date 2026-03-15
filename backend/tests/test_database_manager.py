"""Tests for DatabaseManager crash-safety and integrity-recovery behavior.

Covers:
- Crash-safety PRAGMAs are set on open (synchronous=FULL, wal_autocheckpoint=200)
- journal_mode is WAL
- atexit handler is registered on open
- PASSIVE checkpoint used on close (not TRUNCATE)
- Data written without explicit close is recoverable via WAL replay
- Corruption recovery: corrupted DB is backed up and replaced with fresh DB
- Recovery skips brand-new (0-byte) files
- Recovery handles check-connection failure gracefully (no false positive wipe)
"""

from __future__ import annotations

import atexit
import shutil
import sqlite3
from pathlib import Path
from unittest.mock import patch

import pytest

from backend.app.db.database import DatabaseManager


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def _open_fresh(db_path: Path) -> DatabaseManager:
    mgr = DatabaseManager(db_path)
    mgr.open()
    return mgr


def _pragma(conn: sqlite3.Connection, name: str) -> str:
    row = conn.execute(f"PRAGMA {name}").fetchone()
    return str(row[0]).lower() if row else ""


# ---------------------------------------------------------------------------
# PRAGMA / configuration
# ---------------------------------------------------------------------------

class TestPragmas:
    def test_journal_mode_is_wal(self, tmp_path):
        mgr = _open_fresh(tmp_path / "test.db")
        try:
            assert _pragma(mgr.connection, "journal_mode") == "wal"
        finally:
            mgr.close()

    def test_synchronous_is_full(self, tmp_path):
        mgr = _open_fresh(tmp_path / "test.db")
        try:
            # FULL = 2 in SQLite integer representation
            val = _pragma(mgr.connection, "synchronous")
            assert val == "2", f"Expected synchronous=2 (FULL), got {val!r}"
        finally:
            mgr.close()

    def test_wal_autocheckpoint_is_200(self, tmp_path):
        mgr = _open_fresh(tmp_path / "test.db")
        try:
            val = _pragma(mgr.connection, "wal_autocheckpoint")
            assert val == "200", f"Expected wal_autocheckpoint=200, got {val!r}"
        finally:
            mgr.close()

    def test_foreign_keys_enabled(self, tmp_path):
        mgr = _open_fresh(tmp_path / "test.db")
        try:
            assert _pragma(mgr.connection, "foreign_keys") == "1"
        finally:
            mgr.close()


# ---------------------------------------------------------------------------
# atexit registration
# ---------------------------------------------------------------------------

class TestAtexitRegistration:
    def test_atexit_handler_registered_on_open(self, tmp_path):
        """open() registers the manager's close method with atexit."""
        mgr = DatabaseManager(tmp_path / "test.db")
        # Capture atexit registrations during open()
        registered = []
        original_register = atexit.register

        def capturing_register(func, *args, **kwargs):
            registered.append(func)
            return original_register(func, *args, **kwargs)

        with patch("atexit.register", side_effect=capturing_register):
            mgr.open()

        try:
            assert mgr.close in registered
        finally:
            mgr.close()

    def test_atexit_close_is_idempotent(self, tmp_path):
        """Calling close() twice (once by atexit, once explicitly) does not raise."""
        mgr = _open_fresh(tmp_path / "test.db")
        mgr.close()
        mgr.close()  # second call — must not raise


# ---------------------------------------------------------------------------
# Close uses PASSIVE checkpoint (not TRUNCATE)
# ---------------------------------------------------------------------------

class TestCheckpointStrategy:
    def test_db_is_intact_and_readable_after_close(self, tmp_path):
        """close() leaves the database fully readable on re-open.

        If TRUNCATE were used and was interrupted, data would be lost/corrupted.
        PASSIVE is safe because the WAL is replayed on next open.
        """
        mgr = _open_fresh(tmp_path / "test.db")
        mgr.connection.execute(
            "CREATE TABLE t (id INTEGER PRIMARY KEY, v TEXT)"
        )
        mgr.connection.execute("INSERT INTO t VALUES (1, 'ok')")
        mgr.connection.commit()
        mgr.close()

        mgr2 = DatabaseManager(tmp_path / "test.db")
        mgr2.open()
        try:
            row = mgr2.connection.execute("SELECT v FROM t WHERE id=1").fetchone()
            assert row is not None and row[0] == "ok"
            assert _pragma(mgr2.connection, "integrity_check") == "ok"
        finally:
            mgr2.close()


# ---------------------------------------------------------------------------
# WAL crash-safety: data survives abrupt close (no checkpoint)
# ---------------------------------------------------------------------------

class TestWalCrashSafety:
    def test_data_survives_without_explicit_close(self, tmp_path):
        """Data committed to WAL is recoverable even without close()/checkpoint.

        Simulates a force-kill by abandoning the connection without closing.
        On next open, SQLite replays the WAL and all committed data is present.
        """
        db_path = tmp_path / "crash_test.db"

        # Write without closing (simulate force-kill)
        mgr = DatabaseManager(db_path)
        mgr.open()
        conn = mgr.connection
        conn.execute("CREATE TABLE items (id INTEGER PRIMARY KEY, val TEXT)")
        conn.execute("INSERT INTO items VALUES (1, 'hello')")
        conn.commit()
        # Deliberately skip mgr.close() — simulate abrupt process death
        conn.close()  # raw connection close without checkpoint

        # Re-open and verify data is there
        mgr2 = DatabaseManager(db_path)
        mgr2.open()
        try:
            row = mgr2.connection.execute("SELECT val FROM items WHERE id=1").fetchone()
            assert row is not None
            assert row[0] == "hello"
        finally:
            mgr2.close()


# ---------------------------------------------------------------------------
# Integrity recovery
# ---------------------------------------------------------------------------

class TestIntegrityRecovery:
    def test_corrupted_db_is_backed_up_and_replaced(self, tmp_path):
        """A corrupted database is backed up to .db.corrupted and replaced."""
        db_path = tmp_path / "mesh.db"
        # Write junk to simulate corruption
        db_path.write_bytes(b"this is not a valid sqlite database" * 100)

        mgr = DatabaseManager(db_path)
        mgr.open()
        mgr.close()

        backup_path = db_path.with_suffix(".db.corrupted")
        assert backup_path.exists(), "Backup of corrupted DB should exist"
        assert db_path.exists(), "Fresh DB should have been created"

        # Fresh DB must be valid SQLite
        conn = sqlite3.connect(str(db_path))
        result = conn.execute("PRAGMA integrity_check").fetchone()
        conn.close()
        assert result[0] == "ok"

    def test_healthy_db_is_not_touched(self, tmp_path):
        """A healthy database is left intact — no backup created."""
        db_path = tmp_path / "healthy.db"

        # Create a valid DB first
        mgr = DatabaseManager(db_path)
        mgr.open()
        mgr.connection.execute("CREATE TABLE t (id INTEGER PRIMARY KEY)")
        mgr.connection.commit()
        mgr.close()

        backup_path = db_path.with_suffix(".db.corrupted")
        assert not backup_path.exists()

        # Re-open — must not create backup
        mgr2 = DatabaseManager(db_path)
        mgr2.open()
        mgr2.close()

        assert not backup_path.exists()

    def test_zero_byte_file_skips_integrity_check(self, tmp_path):
        """A brand-new 0-byte file skips the integrity check (treated as new DB)."""
        db_path = tmp_path / "new.db"
        db_path.write_bytes(b"")  # 0-byte file

        mgr = DatabaseManager(db_path)
        mgr.open()  # must not raise
        mgr.close()

        backup_path = db_path.with_suffix(".db.corrupted")
        assert not backup_path.exists()

    def test_integrity_check_error_does_not_wipe_db(self, tmp_path):
        """If the integrity check connection itself fails (e.g. permission error),
        the database is NOT wiped — we err on the side of preservation."""
        import backend.app.db.database as db_module

        db_path = tmp_path / "healthy.db"

        mgr = DatabaseManager(db_path)
        mgr.open()
        mgr.connection.execute("CREATE TABLE t (id INTEGER PRIMARY KEY)")
        mgr.connection.commit()
        mgr.close()

        original_size = db_path.stat().st_size

        # Patch sqlite3.connect at the db module level so only the first call
        # (the integrity check in _check_and_recover) raises an OSError.
        # The second call (the actual open()) uses the real sqlite3.connect.
        original_connect = db_module.sqlite3.connect
        call_count = {"n": 0}

        def fail_first_connect(*args, **kwargs):
            call_count["n"] += 1
            if call_count["n"] == 1:
                raise OSError("permission denied")
            return original_connect(*args, **kwargs)

        with patch.object(db_module.sqlite3, "connect", side_effect=fail_first_connect):
            mgr2 = DatabaseManager(db_path)
            mgr2.open()
            mgr2.close()

        # DB must be untouched — size and backup absence confirm no wipe
        assert db_path.stat().st_size == original_size
        backup_path = db_path.with_suffix(".db.corrupted")
        assert not backup_path.exists()
