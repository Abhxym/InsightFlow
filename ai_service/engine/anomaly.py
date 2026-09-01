"""
Anomaly Detection Engine
Uses Z-score analysis to detect statistically significant drops/spikes
in satisfaction scores, response volumes, and sentiment patterns.
"""

import numpy as np
from scipy import stats
from datetime import datetime


def detect_score_anomalies(scores: list[float], threshold: float = 2.0) -> list[dict]:
    """
    Detect anomalous individual scores using Z-score.
    Z-score > threshold = statistical outlier.
    """
    if len(scores) < 3:
        return []

    arr = np.array(scores)
    z_scores = np.abs(stats.zscore(arr))
    anomalies = []

    for i, (score, z) in enumerate(zip(scores, z_scores)):
        if z > threshold:
            anomalies.append({
                'index': i,
                'score': score,
                'z_score': round(float(z), 3),
                'direction': 'low' if score < np.mean(arr) else 'high',
                'severity': 'critical' if z > 3.0 else 'warning'
            })

    return anomalies


def detect_sentiment_shift(sentiment_history: list[dict]) -> dict | None:
    """
    Detect significant shift in sentiment over time.
    sentiment_history: [{ 'date': '...', 'positive_pct': ..., 'negative_pct': ... }, ...]
    Returns anomaly object if significant shift detected.
    """
    if len(sentiment_history) < 2:
        return None

    # Compare last period to average of all previous
    recent = sentiment_history[-1]
    historical = sentiment_history[:-1]

    avg_positive = np.mean([h.get('positive_pct', 0) for h in historical])
    avg_negative = np.mean([h.get('negative_pct', 0) for h in historical])

    positive_delta = recent.get('positive_pct', 0) - avg_positive
    negative_delta = recent.get('negative_pct', 0) - avg_negative

    anomalies = []
    if abs(positive_delta) > 15:
        anomalies.append({
            'type': 'sentiment_positive',
            'direction': 'up' if positive_delta > 0 else 'down',
            'delta': round(positive_delta, 1),
            'message': f"Positive sentiment {'increased' if positive_delta > 0 else 'decreased'} by {abs(round(positive_delta, 1))}% compared to historical average.",
            'severity': 'critical' if abs(positive_delta) > 25 else 'warning'
        })
    if abs(negative_delta) > 15:
        anomalies.append({
            'type': 'sentiment_negative',
            'direction': 'up' if negative_delta > 0 else 'down',
            'delta': round(negative_delta, 1),
            'message': f"⚠️ Negative sentiment {'spiked' if negative_delta > 0 else 'dropped'} by {abs(round(negative_delta, 1))}% compared to historical average.",
            'severity': 'critical' if abs(negative_delta) > 25 else 'warning'
        })

    return anomalies if anomalies else None


def detect_volume_anomaly(daily_counts: list[dict], threshold: float = 2.0) -> list[dict]:
    """
    Detect unusual spikes or drops in daily response volume.
    daily_counts: [{ 'date': '...', 'count': N }, ...]
    """
    if len(daily_counts) < 3:
        return []

    counts = [d['count'] for d in daily_counts]
    arr = np.array(counts)
    z_scores = stats.zscore(arr)
    mean_count = np.mean(arr)

    anomalies = []
    for i, (day, z) in enumerate(zip(daily_counts, z_scores)):
        if abs(z) > threshold:
            anomalies.append({
                'date': day['date'],
                'count': day['count'],
                'expected': round(float(mean_count), 1),
                'z_score': round(float(z), 3),
                'direction': 'spike' if z > 0 else 'drop',
                'severity': 'critical' if abs(z) > 3.0 else 'warning',
                'message': f"{'Unusual spike' if z > 0 else '⚠️ Significant drop'} in responses on {day['date']} ({day['count']} vs avg {round(float(mean_count), 1)})"
            })

    return anomalies


def run_full_anomaly_scan(numeric_scores: list[float], daily_counts: list[dict]) -> dict:
    """Run all anomaly detectors and return unified summary."""
    score_anomalies = detect_score_anomalies(numeric_scores)
    volume_anomalies = detect_volume_anomaly(daily_counts)

    all_anomalies = score_anomalies + volume_anomalies
    critical = [a for a in all_anomalies if a.get('severity') == 'critical']
    warnings = [a for a in all_anomalies if a.get('severity') == 'warning']

    return {
        'has_anomalies': len(all_anomalies) > 0,
        'critical_count': len(critical),
        'warning_count': len(warnings),
        'score_anomalies': score_anomalies,
        'volume_anomalies': volume_anomalies,
        'summary': f'{len(critical)} critical issue(s) and {len(warnings)} warning(s) detected.' if all_anomalies else 'No anomalies detected.'
    }
