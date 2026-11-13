"""Settings shared by every script. Change a model here, or set it for one PowerShell window:

    $env:AQUAMAA_MODEL = "qwen3:8b"      # a smaller model for laptops without a 12 GB GPU
    python agent.py "your question"

CHAT_MODEL: the model that routes questions, runs the agent and writes answers.
EMBED_MODEL: the model that turns text into vectors. If you change it, run python build_kb.py again,
because the saved knowledge base was built with the old one.
"""
import os

CHAT_MODEL = os.environ.get("AQUAMAA_MODEL", "qwen3:14b")
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
ALERT_POLL_SECONDS = float(os.environ.get("AQUAMAA_ALERT_POLL_SECONDS", "3"))
ALERT_LANGUAGE = os.environ.get("AQUAMAA_ALERT_LANGUAGE", "en")
EMBED_MODEL = os.environ.get("AQUAMAA_EMBED_MODEL", "bge-m3")
OLLAMA_URL = os.environ.get("OLLAMA_HOST", "http://127.0.0.1:11434")
