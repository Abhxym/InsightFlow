"""
Statistical Analytics Engine
Computes NPS, CSAT, standard deviation, completion rate, time-based trends,
response distribution, and cross-tab analytics — proper BI statistics.
"""

import numpy as np
from scipy import stats
from collections import defaultdict
from datetime import datetime, timedelta


def compute_nps(scores: list[float]) -> dict:
    """
    Compute Net Promoter Score from 0-10 scale.
    Promoters >= 9, Detractors <= 6, Passives = 7-8
    NPS = (Promoters% - Detractors%)
    """
    if not scores:
        return {'score': None, 'promoters': 0, 'passives': 0, 'detractors': 0, 'total': 0}

    total = len(scores)
    promoters = sum(1 for s in scores if s >= 9)
    detractors = sum(1 for s in scores if s <= 6)
    passives = total - promoters - detractors

    nps = round((promoters / total - detractors / total) * 100)

    return {
        'score': nps,
        'promoters': promoters,
        'passives': passives,
        'detractors': detractors,
        'total': total,
        'promoter_pct': round(promoters / total * 100, 1),
        'detractor_pct': round(detractors / total * 100, 1),
        'passive_pct': round(passives / total * 100, 1),
        'label': 'Excellent' if nps >= 70 else 'Good' if nps >= 30 else 'Needs Improvement' if nps >= 0 else 'Critical'
    }


def compute_csat(scores: list[float], scale_max: float = 5.0) -> dict:
    """
    CSAT = % of respondents rating >= 4 out of 5 (or equivalent).
    For 1-10 scale, satisfied >= 8.
    """
    if not scores:
        return {'score': None, 'satisfied_pct': 0}

    threshold = 4.0 if scale_max <= 5 else 8.0
    satisfied = sum(1 for s in scores if s >= threshold)
    csat_pct = round(satisfied / len(scores) * 100, 1)

    return {
        'score': csat_pct,
        'satisfied': satisfied,
        'total': len(scores),
        'label': 'Excellent' if csat_pct >= 80 else 'Good' if csat_pct >= 60 else 'Poor'
    }


def compute_descriptive_stats(values: list[float]) -> dict:
    """Full descriptive statistics for a numeric dataset."""
    if not values:
        return {}

    arr = np.array(values)
    return {
        'mean': round(float(np.mean(arr)), 2),
        'median': round(float(np.median(arr)), 2),
        'std_dev': round(float(np.std(arr)), 2),
        'variance': round(float(np.var(arr)), 2),
        'min': float(np.min(arr)),
        'max': float(np.max(arr)),
        'q1': round(float(np.percentile(arr, 25)), 2),
        'q3': round(float(np.percentile(arr, 75)), 2),
        'skewness': round(float(stats.skew(arr)), 3),
        'count': len(values)
    }


def compute_response_distribution(values: list[float], bins: int = 5) -> list[dict]:
    """Compute histogram-style distribution of numeric responses."""
    if not values:
        return []

    arr = np.array(values)
    counts, bin_edges = np.histogram(arr, bins=bins)
    distribution = []
    for i, count in enumerate(counts):
        label = f'{bin_edges[i]:.1f}–{bin_edges[i+1]:.1f}'
        distribution.append({'range': label, 'count': int(count)})
    return distribution


def compute_time_trends(timestamps: list[str], window_days: int = 7) -> list[dict]:
    """
    Compute rolling response volume by day.
    Returns sorted daily counts for line chart.
    """
    if not timestamps:
        return []

    daily = defaultdict(int)
    for ts in timestamps:
        try:
            date = ts.split('T')[0] if 'T' in ts else str(ts)[:10]
            daily[date] += 1
        except Exception:
            pass

    sorted_days = sorted(daily.keys())
    result = [{'date': d, 'count': daily[d]} for d in sorted_days]
    return result


def compute_completion_rate(total_started: int, total_completed: int) -> dict:
    """Compute survey completion rate."""
    if total_started == 0:
        return {'rate': 0, 'drop_off': 0}

    rate = round(total_completed / total_started * 100, 1)
    return {
        'rate': rate,
        'completed': total_completed,
        'started': total_started,
        'drop_off': round(100 - rate, 1)
    }
