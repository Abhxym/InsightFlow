import time

import pytest

from engine import gemini
from engine.gemini import RateLimiter, QuotaExceeded, _call_with_retry, _retry_delay, parse_json


def test_limiter_allows_up_to_limit_then_waits():
    limiter = RateLimiter(limit=2, window=0.3)
    assert limiter.acquire()
    assert limiter.acquire()
    start = time.monotonic()
    assert limiter.acquire(max_wait=1)
    assert time.monotonic() - start >= 0.2  # had to wait for the window to slide


def test_limiter_gives_up_after_max_wait():
    limiter = RateLimiter(limit=1, window=5)
    assert limiter.acquire()
    assert limiter.acquire(max_wait=0.05) is False


def test_limiter_counts_units():
    limiter = RateLimiter(limit=10, window=5)
    assert limiter.acquire(units=8)
    assert limiter.acquire(units=3, max_wait=0.05) is False
    assert limiter.acquire(units=2, max_wait=0.05)


def test_retry_delay_parsing():
    assert _retry_delay(Exception("429 quota exceeded. Please retry in 11.5s.")) == 11.5
    assert _retry_delay(Exception("500 internal error")) is None


def test_retries_once_after_429():
    calls = []

    def flaky():
        calls.append(1)
        if len(calls) == 1:
            raise Exception("429 You exceeded your current quota. Please retry in 0.01s.")
        return "ok"

    assert _call_with_retry(RateLimiter(10), 1, 5, flaky) == "ok"
    assert len(calls) == 2


def test_long_retry_delay_raises_quota_exceeded():
    def exhausted():
        raise Exception("429 quota exceeded. Please retry in 3600s.")

    with pytest.raises(QuotaExceeded):
        _call_with_retry(RateLimiter(10), 1, 5, exhausted)


def test_non_quota_errors_are_not_retried():
    calls = []

    def broken():
        calls.append(1)
        raise ValueError("bad request")

    with pytest.raises(ValueError):
        _call_with_retry(RateLimiter(10), 1, 5, broken)
    assert len(calls) == 1


def test_parse_json_strips_code_fences():
    assert parse_json('```json\n{"a": 1}\n```') == {"a": 1}


def test_generate_requires_key(monkeypatch):
    monkeypatch.setattr(gemini, "configure", lambda: False)
    with pytest.raises(RuntimeError):
        gemini.generate("hi")
