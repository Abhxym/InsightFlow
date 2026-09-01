"""
RAG-based "Ask Your Data" AI Analyst
Uses semantic search (FAISS) to retrieve relevant responses,
then generates evidence-backed answers using Google Gemini.
"""

import os
import re
import google.generativeai as genai
from engine.semantic import embed_texts, build_index, search_similar


def _configure_gemini():
    api_key = os.getenv('GEMINI_API_KEY')
    if api_key:
        genai.configure(api_key=api_key)
        return True
    return False

# Intent classification patterns
INTENT_PATTERNS = {
    'why_decrease': r'\b(why|reason|cause).*(decreas|drop|fell|lower|worse|bad)\b',
    'why_increase': r'\b(why|reason|cause).*(increas|improv|better|higher|rise|good)\b',
    'top_complaints': r'\b(top|main|most|biggest|common).*(complaint|issue|problem|bad|negative)\b',
    'top_positives': r'\b(top|main|most|biggest|common).*(positive|good|great|praise|like|love)\b',
    'sentiment_summary': r'\b(sentiment|feeling|opinion|feel)\b',
    'theme_summary': r'\b(theme|topic|subject|about|discuss)\b',
    'show_responses': r'\b(show|give|list|find|retrieve|example).*(response|feedback|answer|quote)\b',
    'nps_explain': r'\bnps\b|\bnet promoter\b',
    'support_issue': r'\b(support|service|help|assist)\b',
    'delivery_issue': r'\b(delivery|shipping|late|slow|package)\b',
    'price_issue': r'\b(price|cost|expensive|cheap|value)\b',
    'product_issue': r'\b(product|quality|feature|broken|design)\b',
}


def detect_intent(question: str) -> str:
    """Detect the primary intent of the user's question."""
    q = question.lower()
    for intent, pattern in INTENT_PATTERNS.items():
        if re.search(pattern, q):
            return intent
    return 'general'


def answer_question(question: str, analytics_payload: dict, text_responses: list[str]) -> dict:
    """
    Main entry point for "Ask your data".
    Uses FAISS semantic search to retrieve relevant responses,
    then Gemini to generate a grounded, evidence-backed answer.
    """
    intent = detect_intent(question)
    context = _build_context(analytics_payload)

    # Semantic search for relevant responses
    relevant_responses = []
    if text_responses:
        try:
            index, _, texts = build_index(text_responses)
            relevant_responses = search_similar(question, index, text_responses, top_k=5)
        except Exception:
            pass

    # Try Gemini first, fall back to templates
    if _configure_gemini():
        try:
            answer = _generate_with_gemini(question, context, relevant_responses, analytics_payload)
            return {
                'intent': intent,
                'answer': answer,
                'supporting_responses': relevant_responses[:3],
                'confidence': _get_confidence(intent, relevant_responses),
                'powered_by': 'gemini'
            }
        except Exception as e:
            print(f"Gemini RAG failed: {e}, falling back to template.")

    # Fallback to template-based answer
    answer = _generate_answer(intent, question, context, relevant_responses, analytics_payload)
    return {
        'intent': intent,
        'answer': answer,
        'supporting_responses': relevant_responses[:3],
        'confidence': _get_confidence(intent, relevant_responses),
        'powered_by': 'template'
    }


def _build_context(payload: dict) -> dict:
    """Extract key metrics from analytics payload for use in answer generation."""
    return {
        'total': payload.get('total_responses', 0),
        'nps': payload.get('nps', {}).get('score'),
        'nps_label': payload.get('nps', {}).get('label', ''),
        'avg_rating': payload.get('statistics', {}).get('mean', 0),
        'std_dev': payload.get('statistics', {}).get('std_dev', 0),
        'sentiment': payload.get('sentiment', {}),
        'themes': payload.get('themes', []),
        'anomalies': payload.get('anomalies', {}),
        'survey_title': payload.get('survey_title', 'this survey')
    }


def _generate_with_gemini(question: str, context: dict, relevant_responses: list, payload: dict) -> str:
    """Generate a grounded, evidence-backed answer using Google Gemini."""
    sentiment = context.get('sentiment', {})
    total_sent = sum(sentiment.values()) if sentiment else 0
    pos_pct = round(sentiment.get('Positive', 0) / total_sent * 100, 1) if total_sent > 0 else 0
    neg_pct = round(sentiment.get('Negative', 0) / total_sent * 100, 1) if total_sent > 0 else 0

    themes = context.get('themes', [])
    theme_str = '\n'.join([f'- "{t["label"]}": {t["percentage"]}% — e.g. "{t["representative_quote"]}"' for t in themes[:3]]) if themes else 'No themes discovered yet.'

    retrieved_str = '\n'.join([f'- "{r["text"]}" (relevance: {round(r["score"]*100)}%)' for r in relevant_responses]) if relevant_responses else 'No directly relevant responses retrieved.'

    system_prompt = f"""You are an expert AI Data Analyst for InsightFlow, a Business Intelligence platform.
You have access to survey analytics data and retrieved customer responses.
Answer the user's question concisely, citing specific data and actual customer quotes.
Use **bold** for key numbers. Be direct and insightful. Max 200 words."""

    data_context = f"""
Survey: "{context.get('survey_title')}"
Total Responses: {context.get('total')}
Average Rating: {context.get('avg_rating')}/5
NPS Score: {context.get('nps')} ({context.get('nps_label')})
Sentiment: {pos_pct}% Positive, {neg_pct}% Negative
Anomalies: {context.get('anomalies', {}).get('summary', 'None')}

Top Discovered Themes:
{theme_str}

Semantically Retrieved Responses (most relevant to the question):
{retrieved_str}

User's Question: {question}"""

    model = genai.GenerativeModel('gemini-1.5-flash',
                                   system_instruction=system_prompt)
    response = model.generate_content(data_context)
    return response.text


def _generate_answer(intent: str, question: str, ctx: dict, relevant: list, payload: dict) -> str:
    """Generate a natural-language answer based on detected intent."""
    total = ctx['total']
    sentiment = ctx['sentiment']
    themes = ctx['themes']
    anomalies = ctx['anomalies']

    total_sent = sum(sentiment.values()) if sentiment else 0
    neg_pct = round(sentiment.get('Negative', 0) / total_sent * 100, 1) if total_sent > 0 else 0
    pos_pct = round(sentiment.get('Positive', 0) / total_sent * 100, 1) if total_sent > 0 else 0

    if intent == 'why_decrease':
        top_neg_themes = [t for t in themes if any(w in t['label'].lower() for w in ['complaint', 'issue', 'slow', 'bad', 'delay', 'problem'])]
        theme_str = ', '.join([f'"{t["label"]}"' for t in themes[:2]]) if themes else 'insufficient theme data'
        return (
            f"Based on the analysis of {total} responses, the primary drivers of decreased satisfaction are:\n\n"
            f"1. **Elevated negative sentiment** ({neg_pct}% of text responses are negative)\n"
            f"2. **Dominant complaint themes**: {theme_str}\n"
            f"3. The most representative complaint: *\"{relevant[0]['text'] if relevant else 'N/A'}\"*\n\n"
            f"{'⚠️ Anomaly detection also flagged ' + anomalies[\"summary\"] if anomalies.get(\"has_anomalies\") else ''}"
        ).strip()

    elif intent == 'top_complaints':
        neg_themes = themes[:3] if themes else []
        bullets = '\n'.join([f"- **{t['label']}** — {t['percentage']}% of responses, e.g. *\"{t['representative_quote']}\"*" for t in neg_themes])
        return (
            f"The top complaint areas across {total} responses are:\n\n"
            f"{bullets if bullets else 'Not enough text data for theme analysis.'}\n\n"
            f"Overall, {neg_pct}% of respondents expressed negative sentiment in open-ended answers."
        )

    elif intent == 'top_positives':
        pos_themes = themes[:3] if themes else []
        bullets = '\n'.join([f"- **{t['label']}** — {t['percentage']}% of responses, e.g. *\"{t['representative_quote']}\"*" for t in pos_themes])
        return (
            f"The top positive feedback areas across {total} responses are:\n\n"
            f"{bullets if bullets else 'Not enough text data for theme analysis.'}\n\n"
            f"{pos_pct}% of respondents expressed positive sentiment."
        )

    elif intent == 'sentiment_summary':
        return (
            f"Across {total} responses, the sentiment breakdown is:\n\n"
            f"- ✅ **Positive**: {pos_pct}%\n"
            f"- ❌ **Negative**: {neg_pct}%\n"
            f"- ➡️ **Neutral**: {round(100 - pos_pct - neg_pct, 1)}%\n\n"
            f"The dominant sentiment is **{'positive' if pos_pct > neg_pct else 'negative' if neg_pct > pos_pct else 'neutral'}**."
        )

    elif intent == 'nps_explain':
        nps_score = ctx.get('nps')
        nps_label = ctx.get('nps_label', '')
        return (
            f"The Net Promoter Score (NPS) for this survey is **{nps_score}** ({nps_label}).\n\n"
            f"NPS is calculated as: % Promoters (score 9-10) minus % Detractors (score 0-6). "
            f"{'This is above the industry benchmark of +30, indicating strong customer loyalty.' if nps_score and nps_score >= 30 else 'This is below the industry benchmark of +30. Focus on Detractor recovery to improve this score.'}"
        )

    elif intent == 'show_responses':
        if not relevant:
            return "No relevant responses found. Try rephrasing your search with more specific keywords."
        response_list = '\n'.join([f"{i+1}. *\"{r['text']}\"* (relevance: {round(r['score']*100)}%)" for i, r in enumerate(relevant)])
        return f"Here are the most relevant responses to your query:\n\n{response_list}"

    else:
        # General fallback
        avg = ctx.get('avg_rating', 0)
        return (
            f"Based on the data from {total} responses for **\"{ctx['survey_title']}\"**:\n\n"
            f"- Average Rating: **{avg}/5**\n"
            f"- Positive Sentiment: **{pos_pct}%**\n"
            f"- Negative Sentiment: **{neg_pct}%**\n"
            f"- Top Theme: **{themes[0]['label'] if themes else 'N/A'}**\n\n"
            f"The most semantically similar response to your question is:\n*\"{relevant[0]['text'] if relevant else 'N/A'}\"*"
        )


def _get_confidence(intent: str, relevant: list) -> str:
    if not relevant:
        return 'low'
    avg_score = sum(r['score'] for r in relevant) / len(relevant)
    if avg_score > 0.7:
        return 'high'
    elif avg_score > 0.4:
        return 'medium'
    return 'low'
