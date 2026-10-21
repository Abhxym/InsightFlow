"""
Natural Language Report Generator — powered by Google Gemini.
Generates professional, evidence-backed analytical narratives from computed data.
Falls back to template-based generation if Gemini is unavailable.
"""

from engine.semantic import configure_gemini as _configure_gemini, chat_model


def generate_report(analytics_data: dict) -> str:
    """
    Generate a natural-language analytical report.
    Uses Gemini by default; falls back to template if key not set.
    """
    if _configure_gemini():
        try:
            return _generate_with_gemini(analytics_data)
        except Exception as e:
            print(f"Gemini report generation failed: {e}, falling back to template.")

    return _generate_template_report(analytics_data)


def _build_context_prompt(data: dict) -> str:
    """Build a rich, structured context string for Gemini."""
    survey_title = data.get('survey_title', 'Survey')
    total = data.get('total_responses', 0)
    stats = data.get('statistics', {})
    sentiment = data.get('sentiment', {})
    themes = data.get('themes', [])
    anomalies = data.get('anomalies', {})
    nps = data.get('nps', {})
    csat = data.get('csat', {})

    total_sent = sum(sentiment.values()) if sentiment else 0
    pos_pct = round(sentiment.get('Positive', 0) / total_sent * 100, 1) if total_sent > 0 else 0
    neg_pct = round(sentiment.get('Negative', 0) / total_sent * 100, 1) if total_sent > 0 else 0
    neu_pct = round(100 - pos_pct - neg_pct, 1)

    top_themes = [f'"{t["label"]}" ({t["percentage"]}% of responses, e.g. "{t["representative_quote"]}")' for t in themes[:3]]

    context = f"""
Survey Title: {survey_title}
Total Responses: {total}

Statistical Metrics:
- Average Rating: {stats.get('mean', 'N/A')} / 10
- Median: {stats.get('median', 'N/A')}
- Standard Deviation: {stats.get('std_dev', 'N/A')} (higher = more polarized opinions)
- Skewness: {stats.get('skewness', 'N/A')} (negative = skewed toward higher ratings)

Net Promoter Score (NPS):
- Score: {nps.get('score', 'N/A')} ({nps.get('label', '')})
- Promoters: {nps.get('promoter_pct', 'N/A')}% | Passives: {nps.get('passive_pct', 'N/A')}% | Detractors: {nps.get('detractor_pct', 'N/A')}%

CSAT Score: {csat.get('score', 'N/A')}% ({csat.get('label', '')})

Sentiment Breakdown (from open-ended responses):
- Positive: {pos_pct}%
- Negative: {neg_pct}%
- Neutral: {neu_pct}%

Discovered Themes (semantic clustering):
{chr(10).join(f'- {t}' for t in top_themes) if top_themes else '- Not enough text responses for clustering'}

Anomaly Detection: {anomalies.get('summary', 'No anomalies detected')}
"""
    return context


def _generate_with_gemini(data: dict) -> str:
    """Generate executive report using Google Gemini Flash."""
    context = _build_context_prompt(data)

    model = chat_model()

    prompt = f"""You are a senior Business Intelligence analyst writing an executive summary report for a company.

Here is the computed analytics data from a customer survey:

{context}

Write a concise, professional analytical report (3-5 paragraphs). Requirements:
1. Open with a high-level performance overview using specific numbers.
2. Analyze the NPS and CSAT scores with context (is this good or bad for the industry?).
3. Interpret the sentiment breakdown and explain what it means for the business.
4. Reference the discovered themes and quote specific customer feedback.
5. Close with 1-2 actionable, specific recommendations.

Use bold (**text**) for key metrics. Write in flowing paragraphs, not bullet points. Be direct, data-driven, and insightful. Do NOT include a title or heading."""

    response = model.generate_content(prompt)
    return response.text


def _generate_template_report(data: dict) -> str:
    """Fallback template-based report when Gemini is unavailable."""
    survey_title = data.get('survey_title', 'this survey')
    total = data.get('total_responses', 0)
    stats = data.get('statistics', {})
    sentiment = data.get('sentiment', {})
    themes = data.get('themes', [])
    anomalies = data.get('anomalies', {})
    nps = data.get('nps', {})

    if total == 0:
        return "No responses have been collected yet. Once responses come in, a full AI analysis will appear here automatically."

    total_sent = sum(sentiment.values()) if sentiment else 0
    pos_pct = round(sentiment.get('Positive', 0) / total_sent * 100) if total_sent > 0 else 0
    neg_pct = round(sentiment.get('Negative', 0) / total_sent * 100) if total_sent > 0 else 0

    mean = stats.get('mean', 0)
    std_dev = stats.get('std_dev', 0)
    nps_score = nps.get('score')

    paragraphs = []

    paragraphs.append(
        f"**Overview**: {total} response{'s' if total != 1 else ''} collected for \"{survey_title}\". "
        f"Average rating is **{mean}/10** with a standard deviation of **{std_dev}**, indicating "
        f"{'consistent' if std_dev < 1 else 'varied'} customer experiences."
    )

    if nps_score is not None:
        paragraphs.append(
            f"**NPS**: Score of **{nps_score}** ({nps.get('label', '')}). "
            f"{'Above the industry benchmark of +30 — strong loyalty.' if nps_score >= 30 else 'Below the +30 benchmark — focus on converting Detractors.'} "
            f"Promoters: {nps.get('promoter_pct', 0)}%, Detractors: {nps.get('detractor_pct', 0)}%."
        )

    if total_sent > 0:
        paragraphs.append(
            f"**Sentiment**: {pos_pct}% positive, {neg_pct}% negative. "
            f"{'Customers are broadly satisfied.' if pos_pct > neg_pct else '⚠️ Negative sentiment is elevated — investigate top complaint themes immediately.'}"
        )

    if themes:
        top = themes[0]
        paragraphs.append(
            f"**Top Theme**: \"{top['label']}\" represents {top['percentage']}% of responses. "
            f"Representative quote: *\"{top['representative_quote']}\"*"
        )

    if anomalies.get('has_anomalies'):
        paragraphs.append(f"**⚠️ Anomaly Alert**: {anomalies['summary']}")

    return "\n\n".join(paragraphs)
