import hashlib
import json
import os
import re
from pathlib import Path

import faiss
import numpy as np
from fastembed import TextEmbedding
from pypdf import PdfReader

from config import DATA_DIR, TOP_K

EMBED_MODEL = "BAAI/bge-small-en-v1.5"

# Where the saved vectors live. In Docker this is baked into the image at build time.
CACHE_FILE = Path(os.getenv("INDEX_CACHE_DIR", str(DATA_DIR / ".index_cache"))) / "vectors.npz"

# Each paragraph in our PDFs starts with "[Tag]" or "Summary of".
# We cut the text at those points, so every chunk is one complete fact.
SPLIT_PATTERN = re.compile(r"(?m)^(?=\[|Summary of )")


def read_pdf(path):
    """Return all the text in one PDF as a single string."""
    reader = PdfReader(path)
    return "\n".join(page.extract_text() or "" for page in reader.pages)


def clean_chunk(chunk):
    """Join wrapped lines and drop stray section headings at the end."""
    lines = [line.strip() for line in chunk.splitlines() if line.strip()]
    # A short last line with no full stop is a heading from the next section
    while lines and len(lines[-1]) < 70 and not lines[-1].endswith("."):
        lines.pop()
    return " ".join(lines)


def load_chunks():
    """Read every PDF in data/ and return a list of chunk dicts."""
    sources_path = DATA_DIR / "sources.json"
    sources = json.loads(sources_path.read_text(encoding="utf-8"))

    chunks = []
    for pdf_path in sorted(DATA_DIR.glob("*.pdf")):
        meta = sources.get(pdf_path.name)
        if meta is None:
            print(f"WARNING: {pdf_path.name} is not in sources.json, skipping it")
            continue

        for piece in SPLIT_PATTERN.split(read_pdf(pdf_path)):
            text = clean_chunk(piece)
            if not text:
                continue
            chunks.append({
                "text": text,
                "file": pdf_path.name,
                "category": meta["category"],
                "source": meta["source"],
                "last_updated": meta["last_updated"],
            })
    return chunks


def fingerprint(chunks):
    """A short ID for 'this model + this exact text'. If it changes, the saved vectors are stale."""
    h = hashlib.sha256(EMBED_MODEL.encode())
    for c in chunks:
        h.update(c["text"].encode("utf-8"))
        h.update(b"\x00")
    return h.hexdigest()


def load_saved_vectors(fp):
    """Return the saved vectors if they match this fingerprint, otherwise None."""
    try:
        with np.load(CACHE_FILE, allow_pickle=False) as saved:
            if str(saved["fingerprint"]) == fp:
                return saved["vectors"]
    except (OSError, KeyError, ValueError):
        pass
    return None


def save_vectors(fp, vectors):
    try:
        CACHE_FILE.parent.mkdir(parents=True, exist_ok=True)
        np.savez(CACHE_FILE, fingerprint=np.array(fp), vectors=vectors)
    except OSError as e:
        print(f"Could not save the index cache ({e}). Continuing without it.")


class Retriever:
    def __init__(self):
        self.chunks = load_chunks()
        # The model is still needed to embed each question. It is small once loaded.
        self.model = TextEmbedding(EMBED_MODEL)

        fp = fingerprint(self.chunks)
        vectors = load_saved_vectors(fp)
        if vectors is None:
            print("Building the knowledge-base index (one time)...")
            # Small batches keep memory use low
            texts = [c["text"] for c in self.chunks]
            vectors = np.array(list(self.model.embed(texts, batch_size=8)), dtype="float32")
            # Normalising makes inner product equal to cosine similarity (-1 to 1)
            faiss.normalize_L2(vectors)
            save_vectors(fp, vectors)
        else:
            print("Loaded the saved knowledge-base index.")

        self.index = faiss.IndexFlatIP(vectors.shape[1])
        self.index.add(vectors)

    def search(self, question, k=TOP_K):
        """Return the k most similar chunks, best first, each with a score."""
        query = np.array(list(self.model.query_embed([question])), dtype="float32")
        faiss.normalize_L2(query)
        scores, ids = self.index.search(query, k)

        results = []
        for score, i in zip(scores[0], ids[0]):
            result = dict(self.chunks[i])
            result["score"] = float(score)
            results.append(result)
        return results


if __name__ == "__main__":
    retriever = Retriever()
    print(f"Loaded {len(retriever.chunks)} chunks. Type a question (or 'q' to quit).\n")
    while True:
        question = input("Question: ").strip()
        if question.lower() == "q":
            break
        for r in retriever.search(question):
            print(f"  {r['score']:.3f} | {r['file']} | {r['text'][:110]}...")
        print()
