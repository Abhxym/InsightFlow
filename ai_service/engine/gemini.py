"""
Gemini client with client-side rate limiting and retry.

The free Gemini tier allows ~15 generate calls and ~100 embedded texts per minute.
Instead of firing requests until Google returns 429, every call waits for a slot in a
sliding one-minute window, and a 429 is retried once after the delay Google suggests.
Only when the quota is truly exhausted (e.g. the daily limit) does a call raise
QuotaExceeded, so callers can fall back gracefully.
"""

import os
import re
import json
import time
import threading
from collections import deque

import google.generativeai as genai

# Model names are configurable because Google retires Gemini versions regularly
# (gemini-1.5-flash and embedding-001 are no longer served). The "-latest" alias
# tracks the current version; flash-lite keeps per-submission sentiment fast (~1-2s).
CHAT_MODEL = os.getenv("GEMINI_CHAT_MODEL", "gemini-flash-lite-latest")
EMBED_MODEL = os.getenv("GEMINI_EMBED_MODEL", "models/gemini-embedding-001")
EMBED_DIM = int(os.getenv("GEMINI_EMBED_DIM", "768"))


class QuotaExceeded(Exception):
    """Raised when no request slot could be obtained in time."""


class RateLimiter:
    """Sliding-window limiter: at most `limit` units per `window` seconds."""

    def __init__(self, limit: int, window: float = 60.0):
        self.limit = limit
        self.window = window
        self.events: deque[tuple[float, int]] = deque()
        self.lock = threading.Lock()

    def _used(self, now: float) -> int:
        while self.events and now - self.events[0][0] >= self.window:
            self.events.popleft()
        return sum(n for _, n in self.events)

    def acquire(self, units: int = 1, max_wait: float = 30.0) -> bool:
        """Block until `units` fit in the window. Returns False if that takes longer than max_wait."""
        units = min(units, self.limit)
        deadline = time.monotonic() + max_wait
        while True:
            with self.lock:
                now = time.monotonic()
                if self._used(now) + units <= self.limit:
                    self.events.append((now, units))
                    return True
                wait = self.events[0][0] + self.window - now
            if now + wait > deadline:
                return False
            time.sleep(max(wait, 0.05))


# Leave a little headroom under the published free-tier limits
chat_limiter = RateLimiter(int(os.getenv("GEMINI_RPM", "14")))
embed_limiter = RateLimiter(int(os.getenv("GEMINI_EMBED_TPM", "95")))


def configure() -> bool:
    api_key = os.getenv("GEMINI_API_KEY")
    if api_key:
        genai.configure(api_key=api_key)
        return True
    return False


def _retry_delay(err: Exception) -> float | None:
    """Return Google's suggested retry delay for a 429, or None for other errors."""
    msg = str(err)
    if '429' not in msg and 'quota' not in msg.lower():
        return None
    m = re.search(r'retry in ([\d.]+)s', msg) or re.search(r'seconds:\s*(\d+)', msg)
    return float(m.group(1)) if m else 30.0


def _call_with_retry(limiter: RateLimiter, units: int, max_wait: float, fn):
    if not limiter.acquire(units, max_wait):
        raise QuotaExceeded("Gemini rate limit: no free slot in time")
    try:
        return fn()
    except Exception as e:
        delay = _retry_delay(e)
        if delay is None or delay > max_wait:
            raise QuotaExceeded(str(e)) if delay is not None else e
        time.sleep(delay + 0.5)
        if not limiter.acquire(units, max_wait):
            raise QuotaExceeded("Gemini rate limit: no free slot in time")
        return fn()


def parse_json(text: str):
    """Parse a JSON reply, tolerating markdown code fences."""
    text = re.sub(r'^```(?:json)?\s*|\s*```$', '', text.strip())
    return json.loads(text)


def generate(prompt: str, *, json_mode: bool = False, system_instruction: str | None = None,
             temperature: float = 0.0, max_wait: float = 30.0) -> str:
    """Rate-limited text generation. Raises QuotaExceeded or the underlying error."""
    if not configure():
        raise RuntimeError("GEMINI_API_KEY is not set")
    config = {"temperature": temperature}
    if json_mode:
        config["response_mime_type"] = "application/json"
    model = genai.GenerativeModel(CHAT_MODEL, system_instruction=system_instruction)
    return _call_with_retry(chat_limiter, 1, max_wait,
                            lambda: model.generate_content(prompt, generation_config=config).text)


def embed(texts: list[str], task_type: str, max_wait: float = 60.0) -> list[list[float]]:
    """Rate-limited batch embedding (quota is counted per text)."""
    configure()
    out: list[list[float]] = []
    # The batch embedding endpoint accepts at most 100 texts per call
    for start in range(0, len(texts), 90):
        chunk = texts[start:start + 90]
        result = _call_with_retry(embed_limiter, len(chunk), max_wait, lambda: genai.embed_content(
            model=EMBED_MODEL, content=chunk, task_type=task_type, output_dimensionality=EMBED_DIM
        ))
        out.extend(result['embedding'])
    return out
