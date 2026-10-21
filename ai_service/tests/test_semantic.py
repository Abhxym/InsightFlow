import json

import pytest

from engine import semantic


@pytest.fixture(autouse=True)
def clear_caches():
    semantic._THEME_CACHE.clear()
    semantic._EMBED_CACHE.clear()
    semantic._INDEXED.clear()
    yield


# ── Sentiment ────────────────────────────────────────────────────────────────

@pytest.mark.parametrize("text,label", [
    ("The delivery was not good at all", "Negative"),
    ("Great support, very helpful!", "Positive"),
    ("I had breakfast", "Neutral"),  # "fast" inside a word must not count
    ("Never slow and always helpful", "Positive"),
])
def test_lexicon_fallback(text, label):
    assert semantic._lexicon_sentiment(text)['sentiment'] == label


def test_batch_sentiment_uses_one_gemini_call(monkeypatch):
    calls = []

    def fake_generate(prompt, **kw):
        calls.append(prompt)
        return json.dumps({"scores": [0.9, -0.7, 0.0]})

    monkeypatch.setattr(semantic.gemini, "generate", fake_generate)
    out = semantic.score_sentiments(["love it", "awful", "it arrived"])
    assert len(calls) == 1
    assert [o['sentiment'] for o in out] == ["Positive", "Negative", "Neutral"]
    assert all(o['sentiment_source'] == 'gemini' for o in out)


def test_sentiment_falls_back_when_counts_mismatch(monkeypatch):
    monkeypatch.setattr(semantic.gemini, "generate", lambda p, **kw: json.dumps({"scores": [0.5]}))
    out = semantic.score_sentiments(["not good", "great"])
    assert [o['sentiment_source'] for o in out] == ["lexicon", "lexicon"]
    assert out[0]['sentiment'] == "Negative"


def test_sentiment_falls_back_on_quota(monkeypatch):
    def boom(prompt, **kw):
        raise semantic.gemini.QuotaExceeded("429")

    monkeypatch.setattr(semantic.gemini, "generate", boom)
    assert semantic.score_sentiment("terrible")['sentiment'] == "Negative"


# ── Themes ───────────────────────────────────────────────────────────────────

def test_themes_cover_every_answer_beyond_first_batch(monkeypatch):
    """With a batch size of 3, answers 4..7 must be assigned to the themes found in batch 1."""
    monkeypatch.setattr(semantic, "THEME_BATCH", 3)
    texts = ["late parcel", "rude agent", "slow shipping",   # batch 1 -> discovered
             "parcel lost", "agent hung up", "too pricey", "box damaged"]  # batches 2-3 -> assigned

    def fake_generate(prompt, **kw):
        if "Group the following" in prompt:
            return json.dumps({"themes": [
                {"label": "Delivery", "response_ids": [0, 2, 2, 99], "representative_id": 2},
                {"label": "Support", "response_ids": [1], "representative_id": 1},
            ]})
        n = len(prompt.split('Responses (id: text):\n')[1].splitlines())
        batch_labels = {3: ["Delivery", "Support", "Pricing"], 1: ["Delivery"]}[n]  # "Pricing" isn't a known theme
        return json.dumps({"assignments": batch_labels})

    monkeypatch.setattr(semantic.gemini, "generate", fake_generate)
    themes = {t['label']: t for t in semantic.discover_themes(texts)}

    assert sum(t['count'] for t in themes.values()) == len(texts)
    assert sorted(themes['Delivery']['response_ids']) == [0, 2, 3, 6]
    assert sorted(themes['Support']['response_ids']) == [1, 4]
    assert themes['Other']['response_ids'] == [5]          # unknown label goes to Other
    assert themes['Delivery']['representative_quote'] == "slow shipping"
    assert themes['Delivery']['percentage'] == round(4 / 7 * 100, 1)


def test_themes_are_cached(monkeypatch):
    calls = []

    def fake_generate(prompt, **kw):
        calls.append(1)
        return json.dumps({"themes": [{"label": "All", "response_ids": [0, 1], "representative_id": 0}]})

    monkeypatch.setattr(semantic.gemini, "generate", fake_generate)
    semantic.discover_themes(["a", "b"])
    semantic.discover_themes(["a", "b"])
    assert len(calls) == 1


# ── Persistent per-survey index ──────────────────────────────────────────────

class FakeIndex:
    def __init__(self):
        self.store = {}  # namespace -> {id: (values, metadata)}

    def fetch(self, ids, namespace):
        ns = self.store.get(namespace, {})
        return type("R", (), {"vectors": {i: ns[i] for i in ids if i in ns}})()

    def upsert(self, vectors, namespace):
        ns = self.store.setdefault(namespace, {})
        for v in vectors:
            ns[v["id"]] = (v["values"], v["metadata"])

    def query(self, vector, top_k, namespace, include_metadata):
        ns = self.store.get(namespace, {})
        matches = [{"id": i, "score": 0.9 - n * 0.1, "metadata": md} for n, (i, (_, md)) in enumerate(ns.items())]
        return {"matches": matches[:top_k]}

    def delete(self, delete_all, namespace):
        self.store.pop(namespace, None)


@pytest.fixture
def fake_index(monkeypatch):
    index = FakeIndex()
    embedded = []
    monkeypatch.setattr(semantic, "_index", lambda: index)

    def fake_embed(texts, task_type="retrieval_document"):
        embedded.extend(texts)
        return [[0.1] * 4 for _ in texts]

    monkeypatch.setattr(semantic, "embed_texts", fake_embed)
    return index, embedded


def test_index_only_embeds_new_answers(fake_index):
    index, embedded = fake_index
    semantic.sync_survey_index(7, ["Great service", "great service ", "Too slow"])
    assert embedded == ["Great service", "Too slow"]  # duplicates share one vector

    embedded.clear()
    semantic.sync_survey_index(7, ["Great service", "Too slow", "Loved it"])
    assert embedded == ["Loved it"]


def test_index_survives_restart_without_reembedding(fake_index):
    index, embedded = fake_index
    semantic.sync_survey_index(3, ["a", "b"])
    semantic._INDEXED.clear()  # simulate a process restart
    embedded.clear()
    semantic.sync_survey_index(3, ["a", "b"])
    assert embedded == []


def test_search_skips_answers_no_longer_in_survey(fake_index):
    semantic.sync_survey_index(5, ["old answer", "current answer"])
    results = semantic.search_similar("q", "survey_5", allowed_texts=["current answer"], top_k=5)
    assert [r['text'] for r in results] == ["current answer"]


def test_delete_survey_index(fake_index):
    index, _ = fake_index
    semantic.sync_survey_index(9, ["x"])
    semantic.delete_survey_index(9)
    assert "survey_9" not in index.store
