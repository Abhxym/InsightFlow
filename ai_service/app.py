import os
import sys
import re
from collections import defaultdict
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

from engine.semantic import discover_themes
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

class FullAnalyticsRequest(BaseModel):
    survey_title: str
    total_responses: int
    text_responses: List[str]
    numeric_scores: List[Optional[float]]
    timestamps: List[str]
    sentiment_counts: Dict[str, int]

class AskDataRequest(BaseModel):
    question: str
    text_responses: List[str]
    analytics: Dict[str, Any]

# ─────────────────────────────────────────────
# 1. SINGLE TEXT ANALYSIS (used on submission)
# ─────────────────────────────────────────────
@app.post("/api/analyze")
async def analyze_single(req: AnalyzeSingleRequest):
    """Quick per-response analysis on submission."""
    text_lower = req.text.lower()

    # Sentiment
    positive_words = ['good', 'great', 'excellent', 'amazing', 'love', 'best', 'awesome', 'happy', 'perfect', 'fast', 'easy']
    negative_words = ['bad', 'terrible', 'worst', 'awful', 'hate', 'poor', 'sad', 'angry', 'slow', 'broken', 'late', 'expensive']
    pos = sum(1 for w in positive_words if w in text_lower)
    neg = sum(1 for w in negative_words if w in text_lower)
    sentiment = 'Positive' if pos > neg else 'Negative' if neg > pos else 'Neutral'

    # Topics
    topic_keywords = {
        'Delivery': ['delivery', 'shipping', 'late', 'fast', 'arrived', 'courier', 'package'],
        'Support': ['support', 'service', 'help', 'agent', 'representative', 'rude', 'polite'],
        'Price': ['price', 'cost', 'expensive', 'cheap', 'value', 'money'],
        'Product': ['product', 'quality', 'broken', 'feature', 'works', 'design']
    }
    detected_topic, max_matches = 'Other', 0
    for topic, kws in topic_keywords.items():
        matches = sum(1 for kw in kws if kw in text_lower)
        if matches > max_matches:
            max_matches, detected_topic = matches, topic

    # Keywords
    words = re.findall(r'\b[a-z]{5,}\b', text_lower)
    stop_words = {'about', 'there', 'their', 'which', 'would', 'could', 'should', 'these'}
    keywords = list(set([w for w in words if w not in stop_words]))[:5]

    return {'sentiment': sentiment, 'topic': detected_topic, 'keywords': keywords}

# ─────────────────────────────────────────────
# 2. FULL AI ANALYTICS ENGINE
# ─────────────────────────────────────────────
@app.post("/api/analytics/full")
async def full_analytics(req: FullAnalyticsRequest):
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
    nps = compute_nps(numeric_scores) if numeric_scores else {}
    csat = compute_csat(numeric_scores) if numeric_scores else {}
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
async def ask_data(req: AskDataRequest):
    """
    RAG-based conversational analyst.
    """
    try:
        result = answer_question(req.question, req.analytics, req.text_responses)
        return result
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

if __name__ == '__main__':
    uvicorn.run("app:app", host="0.0.0.0", port=5001, reload=True)
