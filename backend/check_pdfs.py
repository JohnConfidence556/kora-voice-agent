import json
from pathlib import Path
from pypdf import PdfReader

DATA_DIR = Path(__file__).resolve().parent.parent / "data"

# Load the metadata file (empty if it doesn't exist yet)
sources_path = DATA_DIR / "sources.json"
sources = json.loads(sources_path.read_text(encoding="utf-8")) if sources_path.exists() else {}

for pdf_path in sorted(DATA_DIR.glob("*.pdf")):
    reader = PdfReader(pdf_path)
    text = "\n".join(page.extract_text() or "" for page in reader.pages)

    text_status = "OK" if len(text.strip()) > 200 else "PROBLEM: little or no text (scanned?)"
    meta_status = "metadata OK" if pdf_path.name in sources else "MISSING from sources.json"

    print(f"[{text_status}] [{meta_status}] {pdf_path.name} | pages: {len(reader.pages)} | characters: {len(text)}")