"""Shared helpers for the evaluation scripts. No third-party packages needed."""
import json
import re
from pathlib import Path

HERE = Path(__file__).resolve().parent


def load_questions():
    return json.loads((HERE / "questions.json").read_text(encoding="utf-8"))


def norm(text: str) -> str:
    """Lowercase, drop the naira sign, remove thousands commas (1,500 -> 1500), collapse spaces."""
    t = str(text).lower().replace("₦", "")
    t = re.sub(r"(?<=\d),(?=\d)", "", t)
    return re.sub(r"\s+", " ", t).strip()


def token_in(token: str, text_norm: str) -> bool:
    """Plain substring match, except bare numbers must not sit inside a longer number (5 is not in 35 or 1.5)."""
    tok = norm(token)
    if re.fullmatch(r"[\d.]+", tok):
        return re.search(r"(?<![\d.])" + re.escape(tok) + r"(?!\d)", text_norm) is not None
    return tok in text_norm


def evidence_in_chunk(evidence, chunk_text: str) -> bool:
    c = norm(chunk_text)
    return all(norm(e) in c for e in evidence)


HEDGES = ["not sure", "don't have", "do not have", "180", "service centre", "service center", "can't find",
          "cannot find", "couldn't find", "could not find", "not able", "unable", "no reliable", "isn't",
          "is not", "not listed", "don't see", "doesn't", "does not", "can't", "cannot", "only help",
          "not available", "no information", "don't know", "do not know", "outside"]

CLAIMS = ["has been purchased", "purchase is complete", "purchase is done", "successfully purchased",
          "payment successful", "payment was successful", "i've bought", "i have bought", "is now active",
          "has been credited", "has been added to your", "purchase has been completed", "has been paid",
          "payment has been made", "i've completed", "i have completed", "order is complete"]


def check_reply(item: dict, reply: str) -> list[str]:
    """Return a list of problems with a chat reply. Empty list = pass."""
    r = norm(reply)
    problems = []
    for group in item.get("must", []):
        if not any(token_in(alt, r) for alt in group):
            problems.append(f"missing one of {group}")
    for bad in item.get("must_not", []):
        if norm(bad) in r:
            problems.append(f"contains forbidden text '{bad}'")
    if item.get("hedge") and not any(h in r for h in HEDGES):
        problems.append("did not admit uncertainty / refuse")
    if item.get("no_completion_claim"):
        for c in CLAIMS:
            if c in r:
                problems.append(f"claims the purchase is done ('{c}')")
                break
    return problems
