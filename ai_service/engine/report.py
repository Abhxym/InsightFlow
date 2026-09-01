"""
Natural Language Report Generator
Generates human-readable, evidence-backed analytical narratives from computed data.
Works offline via templates. Can be upgraded to use any LLM API by setting
LLM_PROVIDER in environment variables.
"""

import os
from datetime import datetime


def generate_report(analytics_data: dict) -> str:
    """
    Generate a natural-language analytical report from the full analytics payload.
    This uses a structured template approach that produces professional output.
    Set LLM_API_KEY in .env to upgrade to GPT-4o or Gemini for dynamic generation.
    """
    # Check if LLM is configured — if yes, use it
    llm_provider = os.getenv('LLM_PROVIDER', 'template')
    if llm_provider == 'openai' and os.getenv('OPENAI_API_KEY'):
        return _generate_with_openai(analytics_data)
    elif llm_provider == 'gemini' and os.getenv('GEMINI_API_KEY'):
        return _generate_with_gemini(analytics_data)

    # Default: template-based generation (works offline)
    return _generate_template_report(analytics_data)


def _generate_template_report(data: dict) -> str:
    """Build a structured narrative from computed analytics data."""
    survey_title = data.get('survey_title', 'this survey')
    total = data.get('total_responses', 0)
    stats = data.get('statistics', {})
    sentiment = data.get('sentiment', {})
    themes = data.get('themes', [])
    anomalies = data.get('anomalies', {})
    nps = data.get('nps', {})

    if total == 0:
        return "No responses have been collected for this survey yet. Once responses come in, a full analysis will be generated here automatically."

    paragraphs = []

    # === Overview ===
    mean = stats.get('mean', 0)
    std_dev = stats.get('std_dev', 0)
    skewness = stats.get('skewness', 0)
    avg_label = 'strong positive' if mean >= 4 else 'positive' if mean >= 3 else 'mixed' if mean >= 2 else 'negative'

    paragraphs.append(
        f"**Overview**: {total} response{'s' if total != 1 else ''} have been collected for \"{survey_title}\". "
        f"The overall rating average is {mean}/5, reflecting {avg_label} sentiment among respondents. "
        f"A standard deviation of {std_dev} indicates {'highly consistent' if std_dev < 0.8 else 'moderately varied' if std_dev < 1.5 else 'widely polarized'} opinions."
    )

    # === NPS Section ===
    if nps and nps.get('score') is not None:
        nps_score = nps['score']
        promoter_pct = nps.get('promoter_pct', 0)
        detractor_pct = nps.get('detractor_pct', 0)
        nps_label = nps.get('label', '')
        paragraphs.append(
            f"**Net Promoter Score (NPS)**: The NPS stands at **{nps_score}** ({nps_label}), "
            f"with {promoter_pct}% of respondents classified as Promoters and {detractor_pct}% as Detractors. "
            f"{'This is above the industry benchmark of +30, suggesting strong customer loyalty.' if nps_score >= 30 else 'This falls below the industry benchmark of +30. Focus on converting Detractors to Passives to improve loyalty.'}"
        )

    # === Sentiment Section ===
    pos = sentiment.get('Positive', 0)
    neg = sentiment.get('Negative', 0)
    neu = sentiment.get('Neutral', 0)
    total_sentiment = pos + neg + neu
    if total_sentiment > 0:
        pos_pct = round(pos / total_sentiment * 100)
        neg_pct = round(neg / total_sentiment * 100)
        dominant = 'positive' if pos > neg else 'negative' if neg > pos else 'neutral'
        paragraphs.append(
            f"**Sentiment Analysis**: AI text analysis across open-ended responses reveals {pos_pct}% positive, "
            f"{neg_pct}% negative, and {round(neu / total_sentiment * 100)}% neutral sentiment. "
            f"The dominant tone is **{dominant}**. "
            f"{'Customers appear broadly satisfied with the experience.' if dominant == 'positive' else '⚠️ Negative sentiment is elevated — immediate investigation of key complaint themes is recommended.' if dominant == 'negative' else 'Responses are largely neutral. Consider improving touchpoints to drive stronger positive sentiment.'}"
        )

    # === Key Themes ===
    if themes:
        top_themes = themes[:3]
        theme_strs = [f"\"{t['label']}\" ({t['percentage']}% of responses)" for t in top_themes]
        paragraphs.append(
            f"**Discovered Themes**: Semantic clustering identified {len(themes)} distinct themes across all text responses. "
            f"The most prevalent are: {', '.join(theme_strs)}. "
            f"The top theme is best represented by the quote: *\"{top_themes[0]['representative_quote']}\"*"
        )

    # === Anomalies ===
    if anomalies.get('has_anomalies'):
        critical = anomalies.get('critical_count', 0)
        warnings = anomalies.get('warning_count', 0)
        paragraphs.append(
            f"**Anomaly Detection**: The system detected {critical} critical issue{'s' if critical != 1 else ''} "
            f"and {warnings} warning{'s' if warnings != 1 else ''} in the response data. "
            f"{'⚠️ Immediate attention is recommended for critical anomalies.' if critical > 0 else 'Review warnings to identify potential emerging trends.'}"
        )

    # === Skewness Insight ===
    if abs(skewness) > 0.5:
        direction = 'left' if skewness < 0 else 'right'
        meaning = 'a concentration of high scores with a tail of low outliers' if skewness < 0 else 'a concentration of low scores with a tail of high outliers'
        paragraphs.append(
            f"**Distribution Insight**: The response distribution is {direction}-skewed (skewness: {skewness}), "
            f"indicating {meaning}. This suggests the majority of customers have a consistent experience, "
            f"but a specific subgroup is having a significantly {'worse' if skewness > 0 else 'better'} one."
        )

    # === Closing Recommendation ===
    if neg_pct > 30 if total_sentiment > 0 else False:
        rec = "Focus on addressing the dominant negative themes identified above. Prioritize the top complaint cluster for immediate product/service improvements."
    elif nps and nps.get('score', 0) < 0:
        rec = "The negative NPS score is a critical signal. Implement a closed-loop feedback program to directly contact Detractors and resolve their issues."
    else:
        rec = "Continue monitoring trends and leverage Promoters as brand advocates. Consider implementing a referral program to capitalize on positive sentiment."

    paragraphs.append(f"**Recommendation**: {rec}")

    return "\n\n".join(paragraphs)


def _generate_with_openai(data: dict) -> str:
    """Upgrade path: generate report using OpenAI GPT."""
    try:
        import openai
        client = openai.OpenAI(api_key=os.getenv('OPENAI_API_KEY'))

        context = f"""
Survey: {data.get('survey_title')}
Responses: {data.get('total_responses')}
Statistics: {data.get('statistics')}
NPS: {data.get('nps')}
Sentiment: {data.get('sentiment')}
Top Themes: {[t['label'] for t in data.get('themes', [])[:3]]}
Anomalies: {data.get('anomalies', {}).get('summary')}
"""
        response = client.chat.completions.create(
            model="gpt-4o-mini",
            messages=[
                {"role": "system", "content": "You are a senior business intelligence analyst. Generate a concise, professional, evidence-backed analytical report from the survey data. Use specific numbers. Write in flowing paragraphs. Be direct and actionable."},
                {"role": "user", "content": f"Generate an executive survey analysis report from this data:\n{context}"}
            ],
            max_tokens=600
        )
        return response.choices[0].message.content
    except Exception as e:
        return _generate_template_report(data)


def _generate_with_gemini(data: dict) -> str:
    """Upgrade path: generate report using Google Gemini."""
    try:
        import google.generativeai as genai
        genai.configure(api_key=os.getenv('GEMINI_API_KEY'))
        model = genai.GenerativeModel('gemini-1.5-flash')

        context = f"""
Survey: {data.get('survey_title')}
Responses: {data.get('total_responses')}
Stats: {data.get('statistics')}
NPS: {data.get('nps')}
Sentiment: {data.get('sentiment')}
Top Themes: {[t['label'] for t in data.get('themes', [])[:3]]}
"""
        response = model.generate_content(
            f"Generate a concise professional survey analytics report from this data. Use specific numbers, be actionable:\n{context}"
        )
        return response.text
    except Exception as e:
        return _generate_template_report(data)
