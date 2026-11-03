"""Retrieval evaluation: does the knowledge base return the right chunk, and does the guardrail refuse the rest?

Run from the project root:   python eval/run_retrieval.py
Needs the same environment as the backend (fastembed, faiss, pypdf). No API keys, no network after the model is cached.
"""
import json
import sys
from collections import defaultdict
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT / "backend"))
sys.path.insert(0, str(Path(__file__).resolve().parent))

import config                      # noqa: E402
from rag import Retriever          # noqa: E402
from common import load_questions, evidence_in_chunk, HERE  # noqa: E402


def main():
    retriever = Retriever()
    k = config.TOP_K
    answerable, unanswerable = [], []
    rows = []

    for item in load_questions():
        if not item.get("retrieval", True):
            continue
        results = retriever.search(item["q"], k)
        top = results[0]["score"] if results else 0.0
        if item["evidence"] is None:
            ok = top < config.MIN_SCORE   # the guardrail should say "no reliable information"
            unanswerable.append(top)
            rows.append({"id": item["id"], "category": item["category"], "q": item["q"], "kind": "refuse",
                         "top_score": round(top, 3), "pass": ok})
        else:
            rank = next((i + 1 for i, r in enumerate(results) if evidence_in_chunk(item["evidence"], r["text"])), None)
            accepted = top >= config.MIN_SCORE   # a good question must not be wrongly refused
            answerable.append(top)
            rows.append({"id": item["id"], "category": item["category"], "q": item["q"], "kind": "answer",
                         "rank": rank, "top_score": round(top, 3), "accepted": accepted,
                         "pass": rank is not None and accepted,
                         "found_in_top_k": rank is not None})

    ans = [r for r in rows if r["kind"] == "answer"]
    ref = [r for r in rows if r["kind"] == "refuse"]
    hit1 = sum(r["rank"] == 1 for r in ans) / len(ans)
    hitk = sum(r["found_in_top_k"] for r in ans) / len(ans)
    mrr = sum((1 / r["rank"]) if r["rank"] else 0 for r in ans) / len(ans)
    wrongly_refused = sum(not r["accepted"] for r in ans)
    refusal_ok = sum(r["pass"] for r in ref)

    # What threshold would have worked best on this question set?
    best = None
    for t in [x / 100 for x in range(50, 96)]:
        tpr = sum(s >= t for s in answerable) / len(answerable)
        tnr = sum(s < t for s in unanswerable) / max(1, len(unanswerable))
        score = (tpr + tnr) / 2
        if best is None or score > best[0] + 1e-9:
            best = (score, t, tpr, tnr)

    by_cat = defaultdict(list)
    for r in rows:
        by_cat[r["category"]].append(r["pass"])

    lines = [
        "# Retrieval evaluation", "",
        f"Chunks searched: {len(retriever.chunks)} | top-k: {k} | MIN_SCORE: {config.MIN_SCORE}", "",
        "| Metric | Result |", "|---|---|",
        f"| Answerable questions | {len(ans)} |",
        f"| Right chunk ranked first (hit@1) | {hit1:.0%} |",
        f"| Right chunk in top {k} (hit@{k}) | {hitk:.0%} |",
        f"| Mean reciprocal rank | {mrr:.2f} |",
        f"| Good questions wrongly refused by MIN_SCORE | {wrongly_refused} of {len(ans)} |",
        f"| Out-of-scope questions correctly refused | {refusal_ok} of {len(ref)} |", "",
        "| Category | Passed |", "|---|---|",
    ]
    for cat, results in by_cat.items():
        lines.append(f"| {cat} | {sum(results)} of {len(results)} |")
    lines += ["", f"Best threshold on this question set: **{best[1]:.2f}** "
              f"(keeps {best[2]:.0%} of answerable questions, refuses {best[3]:.0%} of out-of-scope ones).", ""]
    fails = [r for r in rows if not r["pass"]]
    if fails:
        lines += ["## Failures", "", "| id | question | detail |", "|---|---|---|"]
        for r in fails:
            detail = (f"top score {r['top_score']} (should be below {config.MIN_SCORE})" if r["kind"] == "refuse"
                      else f"rank {r['rank']}, top score {r['top_score']}" + ("" if r["accepted"] else " (refused by MIN_SCORE)"))
            lines.append(f"| {r['id']} | {r['q']} | {detail} |")

    out = HERE / "results"
    out.mkdir(exist_ok=True)
    (out / "retrieval.json").write_text(json.dumps(rows, indent=2), encoding="utf-8")
    (out / "retrieval.md").write_text("\n".join(lines), encoding="utf-8")
    print("\n".join(lines))
    print(f"\nSaved to {out / 'retrieval.md'}")


if __name__ == "__main__":
    main()
