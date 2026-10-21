import os
import sys
import re
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from typing import List, Optional, Any, Dict
from dotenv import load_dotenv
import uvicorn

# Load .env from ai_service directory
load_dotenv(os.path.join(os.path.dirname(__file__), '.env'))

# Add engine to path
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from engine.semantic import discover_themes, score_sentiments, delete_survey_index
from engine.statistics import (
    compute_nps, compute_csat, compute_descriptive_stats,
    compute_response_distribution, compute_time_trends
)
from engine.anomaly import run_full_anomaly_scan
from engine.report import generate_report
from engine.rag import answer_question

app = FastAPI(title="InsightFlow AI Service")

# Setup CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ─────────────────────────────────────────────
# Pydantic Models
# ─────────────────────────────────────────────
class AnalyzeSingleRequest(BaseModel):
    text: str

class AnalyzeBatchRequest(BaseModel):
    texts: List[str]

class FullAnalyticsRequest(BaseModel):
    survey_title: str
    total_responses: int
    text_responses: List[str]
    # Rating answers normalised to a 0-10 scale (drives averages, CSAT, distribution)
    numeric_scores: List[Optional[float]]
    # Raw answers to 0-10 rating questions only; NPS is only meaningful on that scale
    nps_scores: Optional[List[Optional[float]]] = None
    timestamps: List[str]
    sentiment_counts: Dict[str, int]

class AskDataRequest(BaseModel):
    question: str
    survey_id: Optional[Any] = None
    text_responses: List[str]
    analytics: Dict[str, Any]

# ─────────────────────────────────────────────
# 1. SINGLE TEXT ANALYSIS (used on submission)
# ─────────────────────────────────────────────
TOPIC_KEYWORDS = {
    'Delivery': ['delivery', 'shipping', 'late', 'fast', 'arrived', 'courier', 'package'],
    'Support': ['support', 'service', 'help', 'agent', 'representative', 'rude', 'polite'],
    'Price': ['price', 'cost', 'expensive', 'cheap', 'value', 'money'],
    'Product': ['product', 'quality', 'broken', 'feature', 'works', 'design']
}
STOP_WORDS = {'about', 'there', 'their', 'which', 'would', 'could', 'should', 'these'}


def _topic_and_keywords(text: str) -> dict:
    text_lower = text.lower()
    detected_topic, max_matches = 'Other', 0
    for topic, kws in TOPIC_KEYWORDS.items():
        matches = sum(1 for kw in kws if re.search(rf'\b{kw}\b', text_lower))
        if matches > max_matches:
            max_matches, detected_topic = matches, topic
    words = re.findall(r'\b[a-z]{5,}\b', text_lower)
    keywords = list(dict.fromkeys(w for w in words if w not in STOP_WORDS))[:5]
    return {'topic': detected_topic, 'keywords': keywords}


# Plain `def` endpoints: FastAPI runs them in a thread pool, so a Gemini call
# waiting on the rate limiter never blocks other requests.
@app.post("/api/analyze")
def analyze_single(req: AnalyzeSingleRequest):
    """Quick per-response analysis on submission."""
    return {**score_sentiments([req.text])[0], **_topic_and_keywords(req.text)}


@app.post("/api/analyze/batch")
def analyze_batch(req: AnalyzeBatchRequest):
    """All open-ended answers of one submission, scored in a single Gemini call."""
    sentiments = score_sentiments(req.texts)
    return {'results': [{**s, **_topic_and_keywords(t)} for t, s in zip(req.texts, sentiments)]}

# ─────────────────────────────────────────────
# 2. FULL AI ANALYTICS ENGINE
# ─────────────────────────────────────────────
@app.post("/api/analytics/full")
def full_analytics(req: FullAnalyticsRequest):
    """
    Full AI analytics pipeline.
    Accepts all survey response data and returns clustered themes, stats, and NL reports.
    """
    text_responses = req.text_responses
    numeric_scores = [float(x) for x in req.numeric_scores if x is not None]
    
    # 1. Semantic Theme Discovery
    themes = []
    if len(text_responses) >= 2:
        try:
            themes = discover_themes(text_responses)
        except Exception as e:
            themes = []

    # 2. Statistical Analytics
    statistics = compute_descriptive_stats(numeric_scores) if numeric_scores else {}
    nps_scores = numeric_scores if req.nps_scores is None else [float(x) for x in req.nps_scores if x is not None]
    nps = compute_nps(nps_scores) if nps_scores else {}
    csat = compute_csat(numeric_scores, scale_max=10) if numeric_scores else {}
    distribution = compute_response_distribution(numeric_scores) if numeric_scores else []
    time_trends = compute_time_trends(req.timestamps)

    # 3. Anomaly Detection
    anomalies = run_full_anomaly_scan(numeric_scores, time_trends)

    # 4. Build payload for report
    analytics_payload = {
        'survey_title': req.survey_title,
        'total_responses': req.total_responses,
        'statistics': statistics,
        'nps': nps,
        'csat': csat,
        'sentiment': req.sentiment_counts,
        'themes': themes,
        'anomalies': anomalies,
    }

    # 5. Generate Natural Language Report
    nl_report = generate_report(analytics_payload)

    return {
        'themes': themes,
        'statistics': statistics,
        'nps': nps,
        'csat': csat,
        'distribution': distribution,
        'time_trends': time_trends,
        'anomalies': anomalies,
        'nl_report': nl_report
    }

# ─────────────────────────────────────────────
# 3. ASK YOUR DATA (RAG AGENT)
# ─────────────────────────────────────────────
@app.post("/api/analytics/ask")
def ask_data(req: AskDataRequest):
    """
    RAG-based conversational analyst.
    """
    try:
        result = answer_question(req.question, req.analytics, req.text_responses, req.survey_id)
        return result
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.delete("/api/index/{survey_id}")
def delete_index(survey_id: str):
    """Remove a survey's vectors from Pinecone (called when the survey is deleted)."""
    delete_survey_index(survey_id)
    return {'deleted': survey_id}

if __name__ == '__main__':
    uvicorn.run("app:app", host="0.0.0.0", port=5001, reload=True)
