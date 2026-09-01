"""
Statistical Analytics Engine
Computes BI statistics using pure Python (no numpy/scipy required).
"""

import math
import statistics
from collections import defaultdict
from datetime import datetime


def compute_nps(scores: list[float]) -> dict:
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
    if not values:
        return {}

    mean = statistics.mean(values)
    median = statistics.median(values)
    
    std_dev = 0.0
    variance = 0.0
    if len(values) > 1:
        std_dev = statistics.stdev(values)
        variance = statistics.variance(values)
        
    # Manual skewness approx
    skewness = 0.0
    if std_dev > 0 and len(values) > 2:
        n = len(values)
        skewness = (n / ((n - 1) * (n - 2))) * sum(((x - mean) / std_dev) ** 3 for x in values)

    sorted_vals = sorted(values)
    q1 = sorted_vals[int(len(sorted_vals) * 0.25)] if sorted_vals else 0
    q3 = sorted_vals[int(len(sorted_vals) * 0.75)] if sorted_vals else 0

    return {
        'mean': round(mean, 2),
        'median': round(median, 2),
        'std_dev': round(std_dev, 2),
        'variance': round(variance, 2),
        'min': min(values),
        'max': max(values),
        'q1': round(q1, 2),
        'q3': round(q3, 2),
        'skewness': round(skewness, 3),
        'count': len(values)
    }


def compute_response_distribution(values: list[float], bins: int = 5) -> list[dict]:
    if not values:
        return []

    min_val = min(values)
    max_val = max(values)
    if min_val == max_val:
        return [{'range': f"{min_val:.1f}-{max_val:.1f}", 'count': len(values)}]
        
    step = (max_val - min_val) / bins
    distribution = []
    
    for i in range(bins):
        low = min_val + (i * step)
        high = min_val + ((i + 1) * step)
        if i == bins - 1:
            count = sum(1 for v in values if low <= v <= high)
        else:
            count = sum(1 for v in values if low <= v < high)
            
        distribution.append({'range': f'{low:.1f}–{high:.1f}', 'count': count})
        
    return distribution


def compute_time_trends(timestamps: list[str], window_days: int = 7) -> list[dict]:
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
