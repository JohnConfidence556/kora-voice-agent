"""Chat evaluation: runs every question through the real chat assistant over HTTP and checks the result.

Works against your local backend or the live one:
    python eval/run_chat.py                                   (http://127.0.0.1:8000)
    python eval/run_chat.py --api https://kora-pj.duckdns.org
Options: --only price,voice   --repeat 3   --skip-pause

It signs up temporary users (eval-xxxx@example.com), so it leaves test accounts behind. Run it against a local
database, or accept a few extra accounts on the live one. It never confirms an order: the assistant can only
prepare them, and this script cancels what it prepared after each question.
"""
import argparse
import json
import secrets
import statistics
import sys
import time
import urllib.error
import urllib.request
from collections import defaultdict

sys.path.insert(0, __import__("os").path.dirname(__file__))
from common import HERE, check_reply, load_questions  # noqa: E402

PER_USER = 12            # the API allows 20 chat messages per 5 minutes per user, so stay well under it
START_AIRTIME, START_DATA_MB = 2000, 1000


def call(api, method, path, body=None, token=None, timeout=90):
    data = json.dumps(body).encode() if body is not None else None
    req = urllib.request.Request(api + path, data=data, method=method)
    req.add_header("Content-Type", "application/json")
    if token:
        req.add_header("Authorization", f"Bearer {token}")
    try:
        with urllib.request.urlopen(req, timeout=timeout) as resp:
            return resp.status, json.loads(resp.read() or b"{}")
    except urllib.error.HTTPError as e:
        try:
            return e.code, json.loads(e.read() or b"{}")
        except ValueError:
            return e.code, {}
    except (urllib.error.URLError, TimeoutError) as e:
        return 0, {"detail": str(e)}


def new_user(api):
    email = f"eval-{secrets.token_hex(4)}@example.com"
    status, data = call(api, "POST", "/auth/signup", {"email": email, "password": "eval-pass-123"})
    if status != 200:
        sys.exit(f"Could not create a test user ({status}): {data}. Is the backend running at {api}?")
    return data["token"]


def pending_keys(api, token):
    status, orders = call(api, "GET", "/orders/pending", token=token)
    return orders if status == 200 else []


def cleanup(api, token):
    for o in pending_keys(api, token):
        call(api, "POST", f"/orders/{o['id']}/cancel", token=token)


def run_one(api, token, item):
    start = time.time()
    status, data = call(api, "POST", "/chat", {"messages": [{"role": "user", "content": item["q"]}]}, token)
    if status == 429:                       # rate limit: wait it out once
        time.sleep(65)
        start = time.time()
        status, data = call(api, "POST", "/chat", {"messages": [{"role": "user", "content": item["q"]}]}, token)
    latency = time.time() - start
    reply = data.get("reply", "") if status == 200 else ""
    problems = [] if status == 200 else [f"HTTP {status}: {data.get('detail', '')}"]
    if status == 200:
        problems += check_reply(item, reply)
        if "orders" in item:
            made = sorted(o["item_id"] for o in pending_keys(api, token))
            if made != sorted(item["orders"]):
                problems.append(f"orders prepared {made}, expected {sorted(item['orders'])}")
    cleanup(api, token)
    return {"id": item["id"], "category": item["category"], "q": item["q"], "reply": reply,
            "latency_s": round(latency, 2), "pass": not problems, "problems": problems}


def invariants(api, token):
    """After everything: nothing was confirmed, so the account must look brand new."""
    problems = []
    _, me = call(api, "GET", "/me", token=token)
    if me.get("airtime_naira") != START_AIRTIME or me.get("data_mb") != START_DATA_MB:
        problems.append(f"balance changed: airtime {me.get('airtime_naira')}, data {me.get('data_mb')} MB")
    _, tx = call(api, "GET", "/transactions", token=token)
    if len(tx) != 1:
        problems.append(f"expected only the welcome credit, found {len(tx)} transactions")
    return problems


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--api", default="http://127.0.0.1:8000")
    ap.add_argument("--only", default="", help="comma-separated categories")
    ap.add_argument("--repeat", type=int, default=1)
    args = ap.parse_args()
    api = args.api.rstrip("/")

    items = load_questions()
    if args.only:
        wanted = set(args.only.split(","))
        items = [i for i in items if i["category"] in wanted]
    jobs = [i for _ in range(args.repeat) for i in items]
    print(f"Running {len(jobs)} chat questions against {api} ...")

    results, invariant_problems = [], []
    token, used = None, PER_USER
    for n, item in enumerate(jobs, 1):
        if used >= PER_USER:
            if token:
                invariant_problems += invariants(api, token)
            token, used = new_user(api), 0
        res = run_one(api, token, item)
        used += 1
        results.append(res)
        print(f"[{n}/{len(jobs)}] {'PASS' if res['pass'] else 'FAIL'}  {item['id']}  {item['q']}")
        for p in res["problems"]:
            print("        -", p)
    if token:
        invariant_problems += invariants(api, token)

    by_cat = defaultdict(list)
    for r in results:
        by_cat[r["category"]].append(r["pass"])
    lat = sorted(r["latency_s"] for r in results if r["latency_s"])
    p50 = statistics.median(lat) if lat else 0
    p95 = lat[min(len(lat) - 1, int(len(lat) * 0.95))] if lat else 0
    total_pass = sum(r["pass"] for r in results)

    lines = ["# Chat evaluation", "",
             f"Target: {api} | questions run: {len(results)} | repeats: {args.repeat}", "",
             "| Metric | Result |", "|---|---|",
             f"| Overall pass rate | {total_pass} of {len(results)} ({total_pass / max(1, len(results)):.0%}) |",
             f"| Reply time, median | {p50:.1f} s |", f"| Reply time, 95th percentile | {p95:.1f} s |",
             f"| Safety check: balance unchanged and nothing confirmed | {'PASS' if not invariant_problems else 'FAIL: ' + '; '.join(invariant_problems)} |",
             "", "| Category | Passed |", "|---|---|"]
    for cat, v in by_cat.items():
        lines.append(f"| {cat} | {sum(v)} of {len(v)} |")
    fails = [r for r in results if not r["pass"]]
    if fails:
        lines += ["", "## Failures", "", "| id | question | what went wrong | reply |", "|---|---|---|---|"]
        for r in fails:
            reply = r["reply"].replace("\n", " ").replace("|", "/")[:160]
            lines.append(f"| {r['id']} | {r['q']} | {'; '.join(r['problems'])} | {reply} |")

    out = HERE / "results"
    out.mkdir(exist_ok=True)
    (out / "chat.json").write_text(json.dumps(results, indent=2, ensure_ascii=False), encoding="utf-8")
    (out / "chat.md").write_text("\n".join(lines), encoding="utf-8")
    print("\n" + "\n".join(lines))
    print(f"\nSaved to {out / 'chat.md'}")


if __name__ == "__main__":
    main()
