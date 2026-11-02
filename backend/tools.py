"""Everything the AI assistants can DO. Shared by the voice agent and the chat assistant.

No LiveKit or web code in here, so both channels (and your eval scripts) can import it.
Every function returns plain text that is written for the AI to read and relay.
"""
import accounts
import config
import purchases
from catalog import DATA_PLANS


def fmt_data(mb: int) -> str:
    return f"{mb / 1024:.2f} GB" if mb >= 1024 else f"{mb} MB"


def search_knowledge(retriever, question: str) -> str:
    """Look up MTN plan/rate/code information, refusing to answer from weak matches."""
    results = retriever.search(question)
    if not results or results[0]["score"] < config.MIN_SCORE:
        return "NO RELIABLE INFORMATION FOUND. Tell the user you are not sure."
    return "\n".join(f"{r['text']} (last updated {r['last_updated']})" for r in results)


def account_summary(user_id: int | None) -> str:
    if user_id is None:
        return "The user is not logged in, so no account information is available."
    p = accounts.get_profile(user_id)
    if p is None:
        return "Account not found."
    return (
        f"Demo number {p['demo_number']}. SIM status: {p['sim_status']}. "
        f"Airtime balance: {p['airtime_naira']} naira. Data balance: {fmt_data(p['data_mb'])}. "
        f"Active plan: {p['plan_name']}" + (f", expires {p['plan_expires_at']}." if p["plan_expires_at"] else ".")
    )


def recent_transactions(user_id: int | None, limit: int = 5) -> str:
    if user_id is None:
        return "The user is not logged in."
    rows = accounts.list_transactions(user_id, limit)
    if not rows:
        return "No transactions yet."
    lines = []
    for t in rows:
        data = f", {fmt_data(t['data_mb'])} data" if t["data_mb"] else ""
        lines.append(f"{t['created_at']} UTC: {t['description']} ({t['amount_naira']:+d} naira{data})")
    return "\n".join(lines)


def plans_text() -> str:
    return "\n".join(
        f"id={p['id']}: {p['name']}, {p['price']} naira, {fmt_data(p['data_mb'])}, valid {p['validity_days']} day(s)"
        for p in DATA_PLANS
    )


def _prepared_message(order: dict) -> str:
    return (
        f"PREPARED, NOT PAID YET: {order['description']} for {order['amount_naira']} naira. "
        "The user must press Confirm on the card called 'Waiting for your confirmation' on their dashboard. "
        "It expires in 10 minutes. Nothing has been charged. Never say the purchase is complete."
    )


def prepare_data_purchase(user_id: int | None, plan_id: str) -> str:
    if user_id is None:
        return "The user is not logged in, so no purchase can be prepared."
    try:
        return _prepared_message(purchases.prepare_order(user_id, "data", item_id=plan_id))
    except purchases.PurchaseError as e:
        return f"COULD NOT PREPARE: {e} Valid plan ids:\n{plans_text()}"


def prepare_airtime_topup(user_id: int | None, amount: int) -> str:
    if user_id is None:
        return "The user is not logged in, so no purchase can be prepared."
    try:
        return _prepared_message(purchases.prepare_order(user_id, "airtime", amount=amount))
    except purchases.PurchaseError as e:
        return f"COULD NOT PREPARE: {e}"