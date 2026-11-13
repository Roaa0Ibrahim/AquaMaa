"""The model behind the question layers (guess.py, understand.py): local Qwen through Ollama, or Fanar.

Fanar (api.fanar.qa, QCRI in Qatar) is an Arabic-first model that knows Gulf dialect. It is online, so a question
sent to it leaves the laptop. Choose it with  $env:AQUAMAA_UNDERSTAND_MODEL = "Fanar"  (key in .env).
If Fanar fails (no internet, rate limit), the layer falls back to the local model for that call, so AquaMaa still
works offline at the demo.
"""
import httpx
from langchain_ollama import ChatOllama

from agent_log import log
from config import CHAT_MODEL, FANAR_API_KEY, FANAR_TIMEOUT, FANAR_URL, OLLAMA_URL, UNDERSTAND_MODEL


class Reply:
    def __init__(self, content):
        self.content = content


class Fanar:
    """Same .invoke(messages) -> reply.content as the LangChain models used in the layers."""

    def __init__(self, model, num_predict, fallback):
        self.model, self.num_predict, self.fallback = model, num_predict, fallback

    def invoke(self, messages):
        body = {"model": self.model, "temperature": 0, "max_tokens": self.num_predict,
                "messages": [{"role": "user", "content": m.content} for m in messages]}
        try:
            r = httpx.post(FANAR_URL, json=body, timeout=FANAR_TIMEOUT,
                           headers={"Authorization": f"Bearer {FANAR_API_KEY}"})
            r.raise_for_status()
            return Reply(r.json()["choices"][0]["message"]["content"] or "")
        except (httpx.HTTPError, KeyError, ValueError) as error:
            log.info("FANAR     failed (%s); using the local model for this call", error)
            return self.fallback.invoke(messages)


def make_model(num_predict=120, name=None):
    name = name or UNDERSTAND_MODEL
    local = ChatOllama(model=CHAT_MODEL if name.lower().startswith("fanar") else name, temperature=0,
                       reasoning=False, base_url=OLLAMA_URL, num_predict=num_predict, keep_alive="2h")
    if name.lower().startswith("fanar"):
        return Fanar(name, num_predict, local)
    return local
