import secrets
from datetime import datetime, timedelta, timezone

from catalog import AIRTIME_MAX, AIRTIME_MIN, DATA_PLANS
from db import connect

ORDER_TTL_MINUTES = 10   # a pending order expires if not confirmed in time
MAX_PENDING = 5          # stops anyone (or any AI) from piling up pending orders


class PurchaseError(Exception):
    """A problem the user can understand (not enough airtime, order expired...)."""


def _now() -> datetime:
    return datetime.now(timezone.utc)


def get_plan(item_id: str) -> dict | None:
    return next((p for p in DATA_PLANS if p["id"] == item_id), None)


def _order(row) -> dict:
    return {k: row[k] for k in (
        "id", "kind", "item_id", "description", "amount_naira", "data_mb",
        "validity_days", "status", "created_at", "expires_at",
    )}


def _expire_old(conn) -> None:
    conn.execute(
        "UPDATE orders SET status = 'expired' WHERE status = 'pending' AND expires_at < ?",
        (_now().isoformat(),),
    )


def prepare_order(user_id: int, kind: str, item_id: str | None = None, amount: int | None = None) -> dict:
    """Create a PENDING order. Nothing is charged until confirm_order is called."""
    if kind == "data":
        plan = get_plan(item_id or "")
        if plan is None:
            raise PurchaseError("That plan is not available.")
        description, price, data_mb, days = plan["name"], plan["price"], plan["data_mb"], plan["validity_days"]
        key = plan["id"]
    elif kind == "airtime":
        if not isinstance(amount, int) or not (AIRTIME_MIN <= amount <= AIRTIME_MAX):
            raise PurchaseError(f"Airtime amount must be between {AIRTIME_MIN} and {AIRTIME_MAX} naira.")
        description, price, data_mb, days = f"{amount} naira airtime top-up", amount, 0, 0
        key = f"airtime-{amount}"
    else:
        raise PurchaseError("Unknown purchase type.")

    with connect() as conn:
        _expire_old(conn)

        if kind == "data":
            balance = conn.execute("SELECT airtime_naira FROM users WHERE id = ?", (user_id,)).fetchone()["airtime_naira"]
            if balance < price:
                raise PurchaseError(f"Not enough airtime. {description} costs {price} naira and you have {balance} naira.")

        # If the same order is already waiting, return it instead of creating a duplicate
        existing = conn.execute(
            "SELECT * FROM orders WHERE user_id = ? AND status = 'pending' AND item_id = ?", (user_id, key)
        ).fetchone()
        if existing:
            return _order(existing)

        pending = conn.execute(
            "SELECT COUNT(*) AS n FROM orders WHERE user_id = ? AND status = 'pending'", (user_id,)
        ).fetchone()["n"]
        if pending >= MAX_PENDING:
            raise PurchaseError("You have too many orders waiting. Confirm or cancel some first.")

        order_id = secrets.token_urlsafe(8)
        expires = (_now() + timedelta(minutes=ORDER_TTL_MINUTES)).isoformat()
        conn.execute(
            "INSERT INTO orders (id, user_id, kind, item_id, description, amount_naira, data_mb, validity_days, expires_at) "
            "VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)",
            (order_id, user_id, kind, key, description, price, data_mb, days, expires),
        )
        return _order(conn.execute("SELECT * FROM orders WHERE id = ?", (order_id,)).fetchone())


def confirm_order(user_id: int, order_id: str) -> dict:
    """Actually move the (simulated) money. Safe to call twice: it only ever charges once."""
    with connect() as conn:
        conn.execute("BEGIN IMMEDIATE")   # lock the database so two clicks can't both succeed
        _expire_old(conn)
        row = conn.execute("SELECT * FROM orders WHERE id = ? AND user_id = ?", (order_id, user_id)).fetchone()
        if row is None:
            raise PurchaseError("Order not found.")
        if row["status"] == "confirmed":
            return {"order": _order(row), "already_confirmed": True}
        if row["status"] != "pending":
            raise PurchaseError(f"This order is {row['status']}. Please start a new one.")

        user = conn.execute("SELECT * FROM users WHERE id = ?", (user_id,)).fetchone()

        if row["kind"] == "data":
            if user["airtime_naira"] < row["amount_naira"]:
                raise PurchaseError("Not enough airtime to complete this purchase.")
            expires = _now() + timedelta(days=row["validity_days"])
            conn.execute(
                "UPDATE users SET airtime_naira = airtime_naira - ?, data_mb = data_mb + ?, "
                "plan_name = ?, plan_expires_at = ? WHERE id = ?",
                (row["amount_naira"], row["data_mb"], row["description"], expires.strftime("%d %b %Y, %H:%M UTC"), user_id),
            )
            conn.execute(
                "INSERT INTO transactions (user_id, kind, description, amount_naira, data_mb) VALUES (?, 'data_purchase', ?, ?, ?)",
                (user_id, f"Bought {row['description']}", -row["amount_naira"], row["data_mb"]),
            )
        else:  # airtime top-up: simulated payment adds to the airtime balance
            conn.execute("UPDATE users SET airtime_naira = airtime_naira + ? WHERE id = ?", (row["amount_naira"], user_id))
            conn.execute(
                "INSERT INTO transactions (user_id, kind, description, amount_naira, data_mb) VALUES (?, 'airtime_purchase', ?, ?, 0)",
                (user_id, "Airtime top-up (simulated payment)", row["amount_naira"]),
            )

        conn.execute("UPDATE orders SET status = 'confirmed' WHERE id = ?", (order_id,))
        done = conn.execute("SELECT * FROM orders WHERE id = ?", (order_id,)).fetchone()
        return {"order": _order(done), "already_confirmed": False}


def cancel_order(user_id: int, order_id: str) -> dict:
    with connect() as conn:
        row = conn.execute("SELECT * FROM orders WHERE id = ? AND user_id = ?", (order_id, user_id)).fetchone()
        if row is None:
            raise PurchaseError("Order not found.")
        if row["status"] != "pending":
            raise PurchaseError(f"This order is already {row['status']}.")
        conn.execute("UPDATE orders SET status = 'cancelled' WHERE id = ?", (order_id,))
        return _order(conn.execute("SELECT * FROM orders WHERE id = ?", (order_id,)).fetchone())


def list_pending(user_id: int) -> list[dict]:
    with connect() as conn:
        _expire_old(conn)
        rows = conn.execute(
            "SELECT * FROM orders WHERE user_id = ? AND status = 'pending' ORDER BY created_at DESC", (user_id,)
        ).fetchall()
        return [_order(r) for r in rows]