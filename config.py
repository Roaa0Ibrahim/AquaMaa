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
EMBED_MODEL = os.environ.get("AQUAMAA_EMBED_MODEL", "bge-m3")
OLLAMA_URL = os.environ.get("OLLAMA_HOST", "http://127.0.0.1:11434")
