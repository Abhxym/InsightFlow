import json

from fastapi.testclient import TestClient

import app as app_module
from engine import semantic, rag

client = TestClient(app_module.app)


def test_analyze_batch_returns_one_result_per_text(monkeypatch):
    monkeypatch.setattr(semantic.gemini, "generate", lambda p, **kw: json.dumps({"scores": [-0.8, 0.6]}))
    res = client.post("/api/analyze/batch", json={"texts": ["Delivery was late again", "Great price"]})
    assert res.status_code == 200
    results = res.json()["results"]
    assert [r["sentiment"] for r in results] == ["Negative", "Positive"]
    assert results[0]["topic"] == "Delivery"
    assert results[1]["topic"] == "Price"


def test_full_analytics_uses_nps_scores_separately(monkeypatch):
    monkeypatch.setattr(app_module, "discover_themes", lambda texts: [])
    monkeypatch.setattr(app_module, "generate_report", lambda payload: "report")
    res = client.post("/api/analytics/full", json={
        "survey_title": "T", "total_responses": 3, "text_responses": [],
        "numeric_scores": [10, 8, 2],   # normalised ratings (includes a 1-5 question)
        "nps_scores": [10, 9],          # only the 0-10 question
        "timestamps": [], "sentiment_counts": {}
    })
    body = res.json()
    assert body["nps"]["score"] == 100
    assert body["statistics"]["count"] == 3


def test_ask_cites_retrieved_answers(monkeypatch):
    monkeypatch.setattr(rag, "discover_themes", lambda texts: [])
    monkeypatch.setattr(rag, "sync_survey_index", lambda sid, texts: f"survey_{sid}")
    monkeypatch.setattr(rag, "search_similar", lambda q, ns, allowed, top_k: [
        {"id": "a", "text": "Parcel was late", "score": 0.81},
        {"id": "b", "text": "Box arrived damaged", "score": 0.74},
    ])
    seen = {}

    def fake_generate(prompt, **kw):
        seen["prompt"] = prompt
        return "Deliveries are late [1] and damaged [2]."

    monkeypatch.setattr(rag.gemini, "generate", fake_generate)
    res = client.post("/api/analytics/ask", json={
        "question": "What goes wrong with delivery?", "survey_id": 4,
        "text_responses": ["Parcel was late", "Box arrived damaged"], "analytics": {"total_responses": 2}
    })
    body = res.json()
    assert body["powered_by"] == "gemini"
    assert [s["text"] for s in body["supporting_responses"]] == ["Parcel was late", "Box arrived damaged"]
    assert '[1] "Parcel was late"' in seen["prompt"]
    assert body["confidence"] == "high"


def test_ask_falls_back_to_template_without_llm(monkeypatch):
    monkeypatch.setattr(rag, "discover_themes", lambda texts: [])
    monkeypatch.setattr(rag, "sync_survey_index", lambda sid, texts: "ns")
    monkeypatch.setattr(rag, "search_similar", lambda q, ns, allowed, top_k: [])

    def quota(prompt, **kw):
        raise rag.gemini.QuotaExceeded("429")

    monkeypatch.setattr(rag.gemini, "generate", quota)
    body = client.post("/api/analytics/ask", json={
        "question": "Summarize the sentiment", "text_responses": ["ok"],
        "analytics": {"total_responses": 1, "sentiment": {"Positive": 1}}
    }).json()
    assert body["powered_by"] == "template"
    assert "100.0%" in body["answer"]
