"""
Anomaly Detection Engine
Uses Z-score analysis to detect statistically significant drops/spikes.
Pure python, no scipy required.
"""

import statistics
import math

def get_z_scores(values: list[float]) -> list[float]:
    if len(values) < 2:
        return [0.0] * len(values)
    mean = statistics.mean(values)
    std = statistics.stdev(values)
    if std == 0:
        return [0.0] * len(values)
    return [(v - mean) / std for v in values]


def detect_score_anomalies(scores: list[float], threshold: float = 2.0) -> list[dict]:
    if len(scores) < 3:
        return []

    mean = statistics.mean(scores)
    z_scores = get_z_scores(scores)
    anomalies = []

    for i, (score, z) in enumerate(zip(scores, z_scores)):
        abs_z = abs(z)
        if abs_z > threshold:
            anomalies.append({
                'index': i,
                'score': score,
                'z_score': round(abs_z, 3),
                'direction': 'low' if score < mean else 'high',
                'severity': 'critical' if abs_z > 3.0 else 'warning'
            })

    return anomalies


def detect_volume_anomaly(daily_counts: list[dict], threshold: float = 2.0) -> list[dict]:
    if len(daily_counts) < 3:
        return []

    counts = [d['count'] for d in daily_counts]
    z_scores = get_z_scores(counts)
    mean_count = statistics.mean(counts)

    anomalies = []
    for i, (day, z) in enumerate(zip(daily_counts, z_scores)):
        if abs(z) > threshold:
            anomalies.append({
                'date': day['date'],
                'count': day['count'],
                'expected': round(mean_count, 1),
                'z_score': round(z, 3),
                'direction': 'spike' if z > 0 else 'drop',
                'severity': 'critical' if abs(z) > 3.0 else 'warning',
                'message': f"{'Unusual spike' if z > 0 else '⚠️ Significant drop'} in responses on {day['date']} ({day['count']} vs avg {round(mean_count, 1)})"
            })

    return anomalies


def run_full_anomaly_scan(numeric_scores: list[float], daily_counts: list[dict]) -> dict:
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
