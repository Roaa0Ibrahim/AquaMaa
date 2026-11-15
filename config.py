"""Settings shared by every script. Change a model here, or set it for one PowerShell window:

    $env:AQUAMAA_MODEL = "qwen3:8b"      # a smaller model for laptops without a 12 GB GPU
    python agent.py "your question"

CHAT_MODEL: the model that routes questions, runs the agent and writes answers.
EMBED_MODEL: the model that turns text into vectors. If you change it, run python build_kb.py again,
because the saved knowledge base was built with the old one.
"""
import os
from pathlib import Path

# Local secrets from .env (not in git): lines like  FANAR_API_KEY=...
_env = Path(__file__).parent / ".env"
if _env.exists():
    for _line in _env.read_text(encoding="utf-8").splitlines():
        if "=" in _line and not _line.lstrip().startswith("#"):
            _k, _v = _line.split("=", 1)
            os.environ.setdefault(_k.strip(), _v.strip())

CHAT_MODEL = os.environ.get("AQUAMAA_MODEL", "qwen3:14b")
# The model for the question layers (guess.py: misheard words and re-reading; understand.py: dialect). Its own
# setting so an Arabic-first model (for example Fanar, from QCRI in Qatar) can be tried here without touching answers.
# Fanar (api.fanar.qa): used when UNDERSTAND_MODEL starts with "Fanar". Fanar-C-2-27B, the plain chat model: the
# "Fanar" alias searches the web and answers the question instead of rewriting it (compare_fanar.py, 13 Nov).
# Default when a key is in .env; local Qwen otherwise, and for any call where Fanar fails.
FANAR_URL = "https://api.fanar.qa/v1/chat/completions"
FANAR_API_KEY = os.environ.get("FANAR_API_KEY", "")
FANAR_TIMEOUT = 8          # seconds before falling back to the local model
UNDERSTAND_MODEL = os.environ.get("AQUAMAA_UNDERSTAND_MODEL", "Fanar-C-2-27B" if FANAR_API_KEY else CHAT_MODEL)
MAX_TOOL_ROUNDS = 6        # tool rounds before the agent must answer
MAX_REPAIRS = 1            # repair attempts after the verifier finds problems
MAX_ANSWER_TOKENS = 500    # cap on each model reply; answers are at most 5 sentences
# Milestone 5 verifier on or off, to compare answers with and without it:  $env:AQUAMAA_VERIFY = "0"
VERIFY = os.environ.get("AQUAMAA_VERIFY", "1") != "0"
# Milestone 6 simplification for farmers on or off, to compare before and after:  $env:AQUAMAA_SIMPLIFY = "0"
SIMPLIFY = os.environ.get("AQUAMAA_SIMPLIFY", "1") != "0"
# Fast path (facts by code, one short model call) on or off:  $env:AQUAMAA_FAST = "0"
FAST = os.environ.get("AQUAMAA_FAST", "1") != "0"
# Spoken alerts (alerts.py): on or off, how often the live data is checked, and the language of the messages
ALERTS = os.environ.get("AQUAMAA_ALERTS", "1") != "0"
ALERT_POLL_SECONDS = float(os.environ.get("AQUAMAA_ALERT_POLL_SECONDS", "5"))   # 15 Nov: 3 s used up the dashboard's 20 requests a minute
ALERT_LANGUAGE = os.environ.get("AQUAMAA_ALERT_LANGUAGE", "en")
EMBED_MODEL = os.environ.get("AQUAMAA_EMBED_MODEL", "bge-m3")
OLLAMA_URL = os.environ.get("OLLAMA_HOST", "http://127.0.0.1:11434")
# The small model that words the farmer's fast answers first (fastpath/answer.py); "" turns it off
FAST_PHRASE_MODEL = os.environ.get("AQUAMAA_FAST_PHRASE_MODEL", "qwen2.5:3b")
