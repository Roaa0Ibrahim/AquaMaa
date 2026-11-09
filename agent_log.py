"""Live logs for the agent: each step prints as it happens, to the console and to logs/agent.log.

Usage: from agent_log import log;  log.info("ROUTE ...")
"""
import logging
import sys
from pathlib import Path

Path("logs").mkdir(exist_ok=True)
log = logging.getLogger("agent")
if not log.handlers:
    log.setLevel(logging.INFO)
    fmt = logging.Formatter("%(asctime)s %(message)s", datefmt="%H:%M:%S")
    for handler in (logging.StreamHandler(sys.stdout), logging.FileHandler("logs/agent.log", encoding="utf-8")):
        handler.setFormatter(fmt)
        log.addHandler(handler)
    log.propagate = False
