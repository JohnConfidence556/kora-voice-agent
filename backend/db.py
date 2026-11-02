import sqlite3
from contextlib import contextmanager

import config

SCHEMA = """
CREATE TABLE IF NOT EXISTS users (
    id               INTEGER PRIMARY KEY AUTOINCREMENT,
    email            TEXT NOT NULL UNIQUE,
    password_hash    TEXT NOT NULL,
    salt             TEXT NOT NULL,
    demo_number      TEXT NOT NULL,
    sim_status       TEXT NOT NULL DEFAULT 'Active',
    plan_name        TEXT NOT NULL DEFAULT 'Pay-as-you-go',
    plan_expires_at  TEXT,
    airtime_naira    INTEGER NOT NULL,
    data_mb          INTEGER NOT NULL,
    created_at       TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS sessions (
    token       TEXT PRIMARY KEY,
    user_id     INTEGER NOT NULL REFERENCES users(id),
    expires_at  TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS orders (
    id             TEXT PRIMARY KEY,
    user_id        INTEGER NOT NULL REFERENCES users(id),
    kind           TEXT NOT NULL,
    item_id        TEXT NOT NULL,
    description    TEXT NOT NULL,
    amount_naira   INTEGER NOT NULL,
    data_mb        INTEGER NOT NULL DEFAULT 0,
    validity_days  INTEGER NOT NULL DEFAULT 0,
    status         TEXT NOT NULL DEFAULT 'pending',
    created_at     TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    expires_at     TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS transactions (
    id            INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id       INTEGER NOT NULL REFERENCES users(id),
    kind          TEXT NOT NULL,
    description   TEXT NOT NULL,
    amount_naira  INTEGER NOT NULL,
    data_mb       INTEGER NOT NULL DEFAULT 0,
    created_at    TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);
"""


@contextmanager
def connect():
    """Open the database, commit on success, roll back on error, always close."""
    conn = sqlite3.connect(config.DB_PATH)
    conn.row_factory = sqlite3.Row          # lets us read columns by name
    conn.execute("PRAGMA foreign_keys = ON")
    try:
        yield conn
        conn.commit()
    except Exception:
        conn.rollback()
        raise
    finally:
        conn.close()


def init_db():
    """Create the tables if they don't exist yet. Safe to call every startup."""
    with connect() as conn:
        conn.executescript(SCHEMA)