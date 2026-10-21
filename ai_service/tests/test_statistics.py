from engine.statistics import compute_nps, compute_csat, compute_descriptive_stats, compute_response_distribution
from engine.anomaly import detect_score_anomalies, detect_volume_anomaly


def test_nps_counts_promoters_and_detractors():
    nps = compute_nps([10, 9, 8, 7, 6, 0])
    assert nps['promoters'] == 2
    assert nps['passives'] == 2
    assert nps['detractors'] == 2
    assert nps['score'] == 0


def test_nps_empty():
    assert compute_nps([])['score'] is None


def test_csat_on_ten_point_scale_counts_eight_and_up():
    csat = compute_csat([10, 8, 7.9, 2], scale_max=10)
    assert csat['satisfied'] == 2
    assert csat['score'] == 50.0


def test_descriptive_stats():
    stats = compute_descriptive_stats([2, 4, 4, 4, 5, 5, 7, 9])
    assert stats['mean'] == 5
    assert stats['median'] == 4.5
    assert stats['min'] == 2 and stats['max'] == 9
    assert stats['count'] == 8


def test_distribution_covers_every_value():
    values = [0, 1, 5, 5, 9, 10]
    assert sum(b['count'] for b in compute_response_distribution(values)) == len(values)


def test_score_anomaly_flags_outlier():
    scores = [8] * 20 + [0]
    anomalies = detect_score_anomalies(scores)
    assert len(anomalies) == 1
    assert anomalies[0]['direction'] == 'low'


def test_volume_spike_detected():
    days = [{'date': f'2026-10-{d:02d}', 'count': 3} for d in range(1, 15)]
    days.append({'date': '2026-10-15', 'count': 40})
    spikes = detect_volume_anomaly(days)
    assert [a['date'] for a in spikes] == ['2026-10-15']
    assert spikes[0]['direction'] == 'spike'
