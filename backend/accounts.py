import hashlib
import hmac
import random
import re
import secrets
import sqlite3
from datetime import datetime, timedelta, timezone

import config
from db import connect

EMAIL_PATTERN = re.compile(r"^[^@\s]+@[^@\s]+\.[^@\s]+$")


class AccountError(Exception):
    """A problem the user can fix (bad email, wrong password...). Safe to show them."""


def _hash_password(password: str, salt: bytes) -> str:
    return hashlib.pbkdf2_hmac("sha256", password.encode(), salt, 200_000).hex()


def _now() -> datetime:
    return datetime.now(timezone.utc)


def _new_session(conn, user_id: int) -> str:
    token = secrets.token_urlsafe(32)
    expires = (_now() + timedelta(days=config.SESSION_DAYS)).isoformat()
    conn.execute("INSERT INTO sessions (token, user_id, expires_at) VALUES (?, ?, ?)", (token, user_id, expires))
    return token


def _profile(row) -> dict:
    """Turn a database row into the dict we send to the frontend (never includes the password)."""
    return {
        "id": row["id"],
        "email": row["email"],
        "demo_number": row["demo_number"],
        "sim_status": row["sim_status"],
        "plan_name": row["plan_name"],
        "plan_expires_at": row["plan_expires_at"],
        "airtime_naira": row["airtime_naira"],
        "data_mb": row["data_mb"],
    }


def sign_up(email: str, password: str) -> tuple[str, dict]:
    email = email.strip().lower()
    if not EMAIL_PATTERN.match(email):
        raise AccountError("Please enter a valid email address.")
    if len(password) < 6:
        raise AccountError("Password must be at least 6 characters.")

    salt = secrets.token_bytes(16)
    # Clearly fake number so nobody mistakes a demo account for a real SIM
    demo_number = f"DEMO-{random.randint(100000, 999999)}"

    with connect() as conn:
        try:
            cur = conn.execute(
                "INSERT INTO users (email, password_hash, salt, demo_number, airtime_naira, data_mb) "
                "VALUES (?, ?, ?, ?, ?, ?)",
                (email, _hash_password(password, salt), salt.hex(), demo_number,
                 config.STARTING_AIRTIME_NAIRA, config.STARTING_DATA_MB),
            )
        except sqlite3.IntegrityError:
            raise AccountError("An account with this email already exists. Try logging in.")
        user_id = cur.lastrowid
        conn.execute(
            "INSERT INTO transactions (user_id, kind, description, amount_naira, data_mb) VALUES (?, 'credit', ?, ?, ?)",
            (user_id, "Welcome demo credit", config.STARTING_AIRTIME_NAIRA, config.STARTING_DATA_MB),
        )
        token = _new_session(conn, user_id)
        row = conn.execute("SELECT * FROM users WHERE id = ?", (user_id,)).fetchone()
        return token, _profile(row)


def log_in(email: str, password: str) -> tuple[str, dict]:
    email = email.strip().lower()
    with connect() as conn:
        row = conn.execute("SELECT * FROM users WHERE email = ?", (email,)).fetchone()
        # Same message for "no such email" and "wrong password", so we don't reveal which emails exist
        if row is None:
            raise AccountError("Incorrect email or password.")
        expected = row["password_hash"]
        actual = _hash_password(password, bytes.fromhex(row["salt"]))
        if not hmac.compare_digest(expected, actual):
            raise AccountError("Incorrect email or password.")
        return _new_session(conn, row["id"]), _profile(row)


def log_out(token: str) -> None:
    with connect() as conn:
        conn.execute("DELETE FROM sessions WHERE token = ?", (token,))


def get_user_by_token(token: str) -> dict | None:
    """Return the profile for a valid, unexpired session token, or None."""
    with connect() as conn:
        row = conn.execute(
            "SELECT u.*, s.expires_at AS session_expires FROM sessions s "
            "JOIN users u ON u.id = s.user_id WHERE s.token = ?",
            (token,),
        ).fetchone()
        if row is None:
            return None
        if datetime.fromisoformat(row["session_expires"]) < _now():
            conn.execute("DELETE FROM sessions WHERE token = ?", (token,))
            return None
        return _profile(row)


def get_profile(user_id: int) -> dict | None:
    with connect() as conn:
        row = conn.execute("SELECT * FROM users WHERE id = ?", (user_id,)).fetchone()
        return _profile(row) if row else None


def list_transactions(user_id: int, limit: int = 50) -> list[dict]:
    with connect() as conn:
        rows = conn.execute(
            "SELECT id, kind, description, amount_naira, data_mb, created_at FROM transactions "
            "WHERE user_id = ? ORDER BY id DESC LIMIT ?",
            (user_id, limit),
        ).fetchall()
        return [dict(r) for r in rows]