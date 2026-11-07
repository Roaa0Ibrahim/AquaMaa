"""Milestone 2: build the AquaMaa knowledge base from database/.

Reads database/sources.json, cleans each text file page by page, splits pages into chunks,
labels every chunk with its source metadata and page, and stores the chunks in a vector store
(vector search, saved as vector_store.json) and chunks.jsonl (keyword search in Milestone 3).

Run: python build_kb.py
"""
import collections
import csv
import json
import logging
import re
import time
from pathlib import Path

from langchain_core.documents import Document
from langchain_core.vectorstores import InMemoryVectorStore
from langchain_ollama import OllamaEmbeddings
from langchain_text_splitters import RecursiveCharacterTextSplitter

ROOT = Path(__file__).parent
DATABASE = ROOT / "database"
VECTOR_FILE = ROOT / "vector_store.json"   # Chroma is blocked by Windows Application Control on this laptop
CHUNKS_FILE = ROOT / "chunks.jsonl"
TEXT_TYPES = {".txt", ".md"}            # tables (.csv, .xlsx, .geojson) go to the structured lookup instead
ROW_SOURCES = {"GL-3", "MC-1", "PG-1"}  # glossary, misconceptions, policy goals: one chunk per row, so each entry is searchable
TOPICS = ["water_situation", "quality_science", "standards", "suitability",
          "policy", "institutions", "glossary", "sensors"]

logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(message)s", datefmt="%H:%M:%S")
logging.getLogger("httpx").setLevel(logging.WARNING)
log = logging.getLogger("build_kb")


# 1. Cleaning -----------------------------------------------------------------------------
PAGE_NUMBER = re.compile(r"^\s*(page\s*)?\d{1,4}(\s*(of|/)\s*\d{1,4})?\s*$", re.I)
TOC_LINE = re.compile(r"\.{4,}\s*\d+\s*$|(\s\.){4,}")       # "Introduction ........ 12"


def split_pages(text):
    """PDF text keeps a form-feed (\\f) at each page break. Web pages are one page."""
    return text.split("\f") if "\f" in text else [text]


def repeated_lines(pages):
    """Lines that appear on more than 30% of pages are headers or footers.
    Only for documents of 10 pages or more: in short ones, real content repeats too."""
    if len(pages) < 10:
        return set()
    counts = collections.Counter()
    for page in pages:
        counts.update({line.strip() for line in page.splitlines() if line.strip()})
    return {line for line, n in counts.items() if n / len(pages) > 0.3 and len(line) < 120}


def clean_page(page, headers):
    kept = []
    for line in page.splitlines():
        s = line.strip()
        if not s or s in headers or PAGE_NUMBER.match(s) or TOC_LINE.search(s):
            continue
        kept.append(re.sub(r"\s{3,}", "  ", s))       # layout spacing from PDF tables
    return "\n".join(kept)


# 2. Metadata -----------------------------------------------------------------------------
def metadata(source, file_name, page):
    """One flag per topic, so searches can filter by topic."""
    meta = {key: source.get(key) or "" for key in
            ["id", "title", "publisher", "published", "data_period", "url",
             "authority", "evidence_status", "licence", "folder"]}
    meta["source_id"] = meta.pop("id")
    meta["file"] = file_name
    meta["page"] = page
    for topic in TOPICS:
        meta[f"topic_{topic}"] = topic in source["topics"]
    return meta


# 3. Load, clean and chunk ----------------------------------------------------------------
splitter = RecursiveCharacterTextSplitter.from_tiktoken_encoder(chunk_size=400, chunk_overlap=50)


def load_chunks():
    sources = json.loads((DATABASE / "sources.json").read_text(encoding="utf-8"))
    chunks, report = [], []
    for source in sources:
        for file_name in source["files"]:
            path = DATABASE / source["folder"] / file_name
            if source["id"] in ROW_SOURCES:
                rows = list(csv.DictReader(path.open(encoding="utf-8-sig")))
                for number, row in enumerate(rows, start=2):           # row 1 is the header
                    text = "\n".join(f"{key}: {value}" for key, value in row.items())
                    chunks.append(Document(page_content=text, metadata=metadata(source, file_name, number)))
                report.append((source["id"], file_name, len(rows), len(rows), 0))
                continue
            if path.suffix.lower() not in TEXT_TYPES:
                continue
            pages = split_pages(path.read_text(encoding="utf-8", errors="replace"))
            headers = repeated_lines(pages)
            n_before = len(chunks)
            for number, page in enumerate(pages, start=1):
                text = clean_page(page, headers)
                if len(text) < 50:                     # empty or near-empty page
                    continue
                for piece in splitter.split_text(text):  # pieces never cross a page break
                    chunks.append(Document(page_content=piece, metadata=metadata(source, file_name, number)))
            report.append((source["id"], file_name, len(pages), len(chunks) - n_before, len(headers)))
    return sources, chunks, report


# 4. Embed and store ----------------------------------------------------------------------
def main():
    start = time.time()
    sources, chunks, report = load_chunks()
    for source_id, file_name, pages, n, headers in report:
        log.info("%-7s %-60s pages=%-4d chunks=%-4d headers_removed=%d", source_id, file_name, pages, n, headers)
    text_sources = {r[0] for r in report}
    log.info("Chunked %d text sources into %d chunks (%.1f s)", len(text_sources), len(chunks), time.time() - start)

    with CHUNKS_FILE.open("w", encoding="utf-8") as f:
        for doc in chunks:
            f.write(json.dumps({"text": doc.page_content, **doc.metadata}, ensure_ascii=False) + "\n")

    store = InMemoryVectorStore(embedding=OllamaEmbeddings(model="bge-m3"))   # built fresh every run
    batch, start = 64, time.time()
    for i in range(0, len(chunks), batch):
        for attempt in (1, 2):
            try:
                store.add_documents(chunks[i:i + batch])
                break
            except Exception as error:
                log.warning("Batch %d failed (attempt %d): %s", i // batch + 1, attempt, error)
                if attempt == 2:
                    raise
                time.sleep(3)
        if (i // batch) % 5 == 0:
            log.info("Embedded %d/%d", min(i + batch, len(chunks)), len(chunks))
    store.dump(str(VECTOR_FILE))
    log.info("Stored %d chunks in %s (%.1f s)", len(chunks), VECTOR_FILE.name, time.time() - start)

    tables = [s["id"] for s in sources if s["id"] not in text_sources]
    log.info("Not chunked, for the structured lookup: %s", ", ".join(tables))


if __name__ == "__main__":
    main()
