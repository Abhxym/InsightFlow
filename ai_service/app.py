from flask import Flask, request, jsonify
from flask_cors import CORS
import os
import sys

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

app = Flask(__name__)
CORS(app)


# ─────────────────────────────────────────────
# 1. SINGLE TEXT ANALYSIS (used on submission)
# ─────────────────────────────────────────────
@app.route('/api/analyze', methods=['POST'])
def analyze_single():
    """Quick per-response analysis on submission."""
    import re
    from collections import defaultdict

    data = request.json
    if not data or 'text' not in data:
        return jsonify({'error': 'No text provided'}), 400

    text = data['text']
    text_lower = text.lower()

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

    return jsonify({'sentiment': sentiment, 'topic': detected_topic, 'keywords': keywords})


# ─────────────────────────────────────────────
# 2. FULL AI ANALYTICS ENGINE
# ─────────────────────────────────────────────
@app.route('/api/analytics/full', methods=['POST'])
def full_analytics():
    """
    Full AI analytics pipeline.
    Accepts all survey response data and returns:
    - Semantic themes (clustered)
    - Statistical analysis (NPS, CSAT, std dev, distribution)
    - Anomaly detection
    - Natural language report
    """
    data = request.json
    if not data:
        return jsonify({'error': 'No data provided'}), 400

    text_responses = data.get('text_responses', [])
    numeric_scores = [float(x) for x in data.get('numeric_scores', []) if x is not None]
    timestamps = data.get('timestamps', [])
    sentiment_counts = data.get('sentiment_counts', {})
    survey_title = data.get('survey_title', 'Survey')
    total_responses = data.get('total_responses', 0)

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
    time_trends = compute_time_trends(timestamps)

    # 3. Anomaly Detection
    anomalies = run_full_anomaly_scan(numeric_scores, time_trends)

    # 4. Build payload for report
    analytics_payload = {
        'survey_title': survey_title,
        'total_responses': total_responses,
        'statistics': statistics,
        'nps': nps,
        'csat': csat,
        'sentiment': sentiment_counts,
        'themes': themes,
        'anomalies': anomalies,
    }

    # 5. Generate Natural Language Report
    nl_report = generate_report(analytics_payload)

    return jsonify({
        'themes': themes,
        'statistics': statistics,
        'nps': nps,
        'csat': csat,
        'distribution': distribution,
        'time_trends': time_trends,
        'anomalies': anomalies,
        'nl_report': nl_report
    })


# ─────────────────────────────────────────────
# 3. ASK YOUR DATA (RAG AGENT)
# ─────────────────────────────────────────────
@app.route('/api/analytics/ask', methods=['POST'])
def ask_data():
    """
    RAG-based conversational analyst.
    Accepts a question + full analytics context and returns an evidence-backed answer.
    """
    data = request.json
    if not data or 'question' not in data:
        return jsonify({'error': 'No question provided'}), 400

    question = data['question']
    analytics_payload = data.get('analytics', {})
    text_responses = data.get('text_responses', [])

    try:
        result = answer_question(question, analytics_payload, text_responses)
        return jsonify(result)
    except Exception as e:
        return jsonify({'error': str(e)}), 500


if __name__ == '__main__':
    app.run(port=5000, debug=True)
