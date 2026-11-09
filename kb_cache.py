"""Work done once, saved, and reused: everything that only changes when the knowledge base changes.

    kb_cache.pkl holds the ready-to-use search indexes (BM25 over the chunks, the table facts and their index, the
    chunk vectors) and the vectors of the 20 key statistics. Each program then loads one file instead of
    re-reading JSON, re-building indexes and re-embedding the key statistics.

When is it rebuilt? Only when something it was made from changes: chunks.jsonl, vector_store.json (both written
by build_kb.py), any file in database/, or the embedding model. The cache stores a fingerprint of those (name,
size and date of each file); if the fingerprint differs, that part is rebuilt once and saved again.
So: run build_kb.py when database/ changes, as before. Nothing else to do; the cache follows by itself.

The cache is a local file (in .gitignore), made on this computer. Delete it any time; it is rebuilt on next use.
"""
import hashlib
import pickle
from pathlib import Path

from agent_log import log
from config import EMBED_MODEL

ROOT = Path(__file__).parent
CACHE_FILE = ROOT / "kb_cache.pkl"
SOURCES = [ROOT / "chunks.jsonl", ROOT / "vector_store.json", ROOT / "database"]


def fingerprint():
    """Name, size and modified time of every source file, plus the embedding model: changes if any of them does."""
    h = hashlib.sha256(EMBED_MODEL.encode())
    for source in SOURCES:
        files = sorted(p for p in source.rglob("*") if p.is_file()) if source.is_dir() else [source]
        for p in files:
            if p.exists():
                st = p.stat()
                h.update(f"{p.relative_to(ROOT)}|{st.st_size}|{st.st_mtime_ns}".encode())
    return h.hexdigest()


def _read():
    try:
        with CACHE_FILE.open("rb") as f:
            return pickle.load(f)
    except (OSError, pickle.UnpicklingError, EOFError, AttributeError, ImportError):
        return {}


def get(part, build):
    """The saved value of one part ("retrieval" or "key_stats"), built with build() only if missing or out of date."""
    fp = fingerprint()
    cache = _read()
    saved = cache.get(part)
    if saved and saved["fingerprint"] == fp:
        return saved["value"]
    log.info("CACHE     building %s once (the knowledge base changed or there is no cache yet)", part)
    value = build()
    cache = _read()                     # re-read, so another part saved meanwhile isn't lost
    cache[part] = {"fingerprint": fp, "value": value}
    tmp = CACHE_FILE.with_suffix(".tmp")
    with tmp.open("wb") as f:
        pickle.dump(cache, f, protocol=pickle.HIGHEST_PROTOCOL)
    tmp.replace(CACHE_FILE)
    return value
