import React, { useState, useEffect, useMemo } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  BarChart, Bar, XAxis, YAxis, Tooltip as RechartsTooltip, ResponsiveContainer,
  PieChart, Pie, Cell, LineChart, Line, CartesianGrid, RadarChart, Radar,
  PolarGrid, PolarAngleAxis
} from 'recharts';
import api from '../services/axios';
import AskYourData from '../components/AskYourData';

const COLORS = ['#8b5cf6', '#ec4899', '#38bdf8', '#4ade80', '#fb923c', '#f87171'];
const SENTIMENT_COLORS = { Positive: '#4ade80', Negative: '#f87171', Neutral: '#94a3b8' };

// ─── Reusable KPI Card ───────────────────────────────────────────────────────
const KPICard = ({ label, value, sub, color = '#8b5cf6', icon }) => (
  <div className="glass-panel" style={{ padding: '1.75rem', textAlign: 'center' }}>
    {icon && <div style={{ fontSize: '1.75rem', marginBottom: '0.5rem' }}>{icon}</div>}
    <div style={{ color: '#94a3b8', fontSize: '0.85rem', fontWeight: 500, marginBottom: '0.5rem' }}>{label}</div>
    <div style={{ fontSize: '2.25rem', fontWeight: 800, color, lineHeight: 1 }}>{value ?? 'N/A'}</div>
    {sub && <div style={{ color: '#94a3b8', fontSize: '0.8rem', marginTop: '0.5rem' }}>{sub}</div>}
  </div>
);

// ─── Anomaly Alert ───────────────────────────────────────────────────────────
const AnomalyAlert = ({ anomalies }) => {
  if (!anomalies?.has_anomalies) return null;
  const color = anomalies.critical_count > 0 ? '#ef4444' : '#f59e0b';
  const icon = anomalies.critical_count > 0 ? '🚨' : '⚠️';
  return (
    <div style={{
      padding: '1rem 1.5rem',
      borderRadius: '12px',
      border: `1px solid ${color}40`,
      background: `${color}10`,
      display: 'flex', alignItems: 'center', gap: '1rem',
      marginBottom: '2rem'
    }}>
      <span style={{ fontSize: '1.5rem' }}>{icon}</span>
      <div>
        <div style={{ fontWeight: 700, color }}>{anomalies.summary}</div>
        {anomalies.volume_anomalies?.slice(0, 2).map((a, i) => (
          <div key={i} style={{ color: '#94a3b8', fontSize: '0.85rem' }}>{a.message}</div>
        ))}
      </div>
    </div>
  );
};

// ─── Theme Card ──────────────────────────────────────────────────────────────
const ThemeCard = ({ theme, index }) => (
  <div className="glass-panel" style={{ padding: '1.5rem' }}>
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.75rem' }}>
      <div style={{
        background: `${COLORS[index % COLORS.length]}20`,
        border: `1px solid ${COLORS[index % COLORS.length]}40`,
        borderRadius: '8px', padding: '0.25rem 0.75rem',
        fontSize: '0.85rem', fontWeight: 700, color: COLORS[index % COLORS.length]
      }}>
        {theme.label}
      </div>
      <span style={{ color: '#94a3b8', fontSize: '0.85rem' }}>{theme.percentage}% of responses</span>
    </div>
    <div style={{
      background: 'rgba(255,255,255,0.03)',
      borderLeft: `3px solid ${COLORS[index % COLORS.length]}`,
      padding: '0.75rem', borderRadius: '0 8px 8px 0',
      color: '#cbd5e1', fontSize: '0.9rem', fontStyle: 'italic'
    }}>
      "{theme.representative_quote}"
    </div>
    <div style={{ marginTop: '0.5rem', color: '#94a3b8', fontSize: '0.8rem' }}>
      {theme.count} responses in this cluster
    </div>
  </div>
);

// ─── NL Report Card ─────────────────────────────────────────────────────────
const NLReport = ({ report }) => {
  if (!report) return null;
  const paragraphs = report.split('\n\n').filter(Boolean);
  return (
    <div className="glass-panel" style={{ padding: '2rem' }}>
      <h3 style={{ marginBottom: '1.5rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
        <span>📋</span> Executive Summary
      </h3>
      <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
        {paragraphs.map((para, i) => {
          const [bold, ...rest] = para.split(':');
          const isBold = para.startsWith('**');
          return (
            <p key={i} style={{ color: '#cbd5e1', lineHeight: 1.8, fontSize: '0.95rem' }}
              dangerouslySetInnerHTML={{
                __html: para
                  .replace(/\*\*(.*?)\*\*/g, '<strong style="color:#f8fafc">$1</strong>')
                  .replace(/\*(.*?)\*/g, '<em style="color:#a5b4fc">$1</em>')
              }}
            />
          );
        })}
      </div>
    </div>
  );
};

// ─── Main Analytics Page ─────────────────────────────────────────────────────
const Analytics = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [activeTab, setActiveTab] = useState('overview'); // overview | ai | ask

  useEffect(() => {
    const fetchAnalytics = async () => {
      try {
        const res = await api.get(`/surveys/${id}/analytics`);
        setData(res.data);
      } catch (err) {
        setError(err.response?.data?.message || 'Failed to fetch analytics');
      } finally {
        setLoading(false);
      }
    };
    fetchAnalytics();
  }, [id]);

  const handleExportCSV = async () => {
    try {
      const res = await api.get(`/surveys/${id}/analytics/export`, { responseType: 'blob' });
      const url = window.URL.createObjectURL(new Blob([res.data]));
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', `survey_${id}_export.csv`);
      document.body.appendChild(link);
      link.click();
      link.parentNode.removeChild(link);
    } catch (err) {
      console.error('Export failed', err);
    }
  };

  const filteredTimeline = useMemo(() => {
    const timeline = data?.aiEngine?.time_trends || data?.charts?.timelineData || [];
    return timeline.filter(t => {
      if (startDate && t.date < startDate) return false;
      if (endDate && t.date > endDate) return false;
      return true;
    });
  }, [data, startDate, endDate]);

  if (loading) return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '60vh' }}>
      <div style={{ textAlign: 'center' }}>
        <div style={{ fontSize: '3rem', marginBottom: '1rem', animation: 'spin 1s linear infinite' }}>⚙️</div>
        <p>Running AI Analytics Engine...</p>
      </div>
    </div>
  );
  if (error) return <div className="container" style={{ color: '#f87171', marginTop: '2rem' }}>{error}</div>;
  if (!data) return null;

  const { survey, kpis, charts, ai, aiEngine } = data;
  const stats = aiEngine?.statistics || {};
  const nps = aiEngine?.nps || {};
  const csat = aiEngine?.csat || {};
  const themes = aiEngine?.themes || [];
  const anomalies = aiEngine?.anomalies || {};
  const nlReport = aiEngine?.nl_report || null;
  const distribution = aiEngine?.distribution || [];

  const tabStyle = (tab) => ({
    padding: '0.75rem 1.5rem',
    borderRadius: '10px',
    fontWeight: 600,
    cursor: 'pointer',
    border: 'none',
    background: activeTab === tab ? 'linear-gradient(135deg, #8b5cf6, #ec4899)' : 'rgba(255,255,255,0.05)',
    color: '#fff',
    transition: 'all 0.2s'
  });

  return (
    <div className="container animate-fade-in">
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '2rem', flexWrap: 'wrap', gap: '1rem' }}>
        <div>
          <h1 style={{ margin: 0, fontSize: '2rem' }}>{survey.title}</h1>
          <p style={{ margin: '0.5rem 0 0 0', color: '#94a3b8' }}>Analytics & AI Insights Dashboard</p>
        </div>
        <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap' }}>
          <button onClick={() => navigate('/dashboard')} className="btn btn-secondary">← Dashboard</button>
          <button onClick={handleExportCSV} className="btn btn-primary">Export CSV</button>
        </div>
      </div>

      {/* Anomaly Banner */}
      {anomalies?.has_anomalies && <AnomalyAlert anomalies={anomalies} />}

      {/* Tabs */}
      <div style={{ display: 'flex', gap: '0.75rem', marginBottom: '2.5rem', flexWrap: 'wrap' }}>
        <button style={tabStyle('overview')} onClick={() => setActiveTab('overview')}>📊 Overview</button>
        <button style={tabStyle('ai')} onClick={() => setActiveTab('ai')}>🤖 AI Insights</button>
        <button style={tabStyle('ask')} onClick={() => setActiveTab('ask')}>💬 Ask Your Data</button>
      </div>

      {/* ═══ OVERVIEW TAB ═══ */}
      {activeTab === 'overview' && (
        <>
          {/* KPI Row */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '1.25rem', marginBottom: '2.5rem' }}>
            <KPICard icon="📋" label="Total Responses" value={kpis.totalResponses} color="#38bdf8" />
            <KPICard icon="⭐" label="Average Rating" value={stats.mean || kpis.averageRating} sub={`σ = ${stats.std_dev || 'N/A'}`} color="#c084fc" />
            <KPICard icon="📊" label="Median Score" value={stats.median ?? 'N/A'} color="#8b5cf6" />
            <KPICard icon="🎯" label="NPS Score" value={nps.score ?? kpis.npsScore} sub={nps.label} color={nps.score >= 0 ? '#4ade80' : '#f87171'} />
            <KPICard icon="😊" label="CSAT Score" value={csat.score ? `${csat.score}%` : 'N/A'} sub={csat.label} color="#fb923c" />
            <KPICard icon="📈" label="Std Deviation" value={stats.std_dev ?? 'N/A'} sub="Score spread" color="#f472b6" />
          </div>

          {/* Date Filter */}
          <div className="glass-panel" style={{ padding: '1.25rem 1.5rem', marginBottom: '2rem', display: 'flex', gap: '1rem', alignItems: 'center', flexWrap: 'wrap' }}>
            <span style={{ fontWeight: 600 }}>📅 Filter:</span>
            <input type="date" className="form-input" style={{ width: 'auto' }} value={startDate} onChange={e => setStartDate(e.target.value)} />
            <span style={{ color: '#94a3b8' }}>to</span>
            <input type="date" className="form-input" style={{ width: 'auto' }} value={endDate} onChange={e => setEndDate(e.target.value)} />
          </div>

          {/* Charts Row */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(400px, 1fr))', gap: '2rem', marginBottom: '2rem' }}>

            {/* Response Trend */}
            <div className="glass-panel" style={{ padding: '2rem' }}>
              <h3 style={{ marginBottom: '1.5rem' }}>📈 Response Trend</h3>
              <div style={{ height: 260 }}>
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={filteredTimeline}>
                    <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.06)" />
                    <XAxis dataKey="date" stroke="#64748b" fontSize={11} />
                    <YAxis stroke="#64748b" allowDecimals={false} fontSize={11} />
                    <RechartsTooltip contentStyle={{ backgroundColor: '#0f172a', border: '1px solid #334155', borderRadius: '10px' }} />
                    <Line type="monotone" dataKey="count" stroke="#8b5cf6" strokeWidth={3} dot={{ r: 5, fill: '#8b5cf6' }} activeDot={{ r: 8 }} />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </div>

            {/* Score Distribution */}
            {distribution.length > 0 && (
              <div className="glass-panel" style={{ padding: '2rem' }}>
                <h3 style={{ marginBottom: '1.5rem' }}>🔢 Score Distribution</h3>
                <div style={{ height: 260 }}>
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={distribution}>
                      <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.06)" />
                      <XAxis dataKey="range" stroke="#64748b" fontSize={11} />
                      <YAxis stroke="#64748b" allowDecimals={false} fontSize={11} />
                      <RechartsTooltip contentStyle={{ backgroundColor: '#0f172a', border: '1px solid #334155', borderRadius: '10px' }} />
                      <Bar dataKey="count" fill="#ec4899" radius={[6, 6, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </div>
            )}
          </div>

          {/* NPS Breakdown */}
          {nps.score !== undefined && nps.score !== null && (
            <div className="glass-panel" style={{ padding: '2rem', marginBottom: '2rem' }}>
              <h3 style={{ marginBottom: '1.5rem' }}>🎯 NPS Breakdown</h3>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '1rem', textAlign: 'center' }}>
                {[
                  { label: 'Promoters', value: nps.promoter_pct, count: nps.promoters, color: '#4ade80' },
                  { label: 'Passives', value: nps.passive_pct, count: nps.passives, color: '#94a3b8' },
                  { label: 'Detractors', value: nps.detractor_pct, count: nps.detractors, color: '#f87171' }
                ].map(item => (
                  <div key={item.label} style={{ padding: '1.25rem', background: `${item.color}10`, borderRadius: '12px', border: `1px solid ${item.color}30` }}>
                    <div style={{ fontSize: '1.75rem', fontWeight: 800, color: item.color }}>{item.value}%</div>
                    <div style={{ color: '#94a3b8', fontSize: '0.85rem' }}>{item.label}</div>
                    <div style={{ color: '#64748b', fontSize: '0.8rem' }}>{item.count} respondents</div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Choice Charts */}
          {charts.choiceCharts?.length > 0 && (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(380px, 1fr))', gap: '2rem' }}>
              {charts.choiceCharts.map((chart, idx) => (
                <div key={idx} className="glass-panel" style={{ padding: '2rem' }}>
                  <h3 style={{ fontSize: '1rem', marginBottom: '1.5rem' }}>{chart.title}</h3>
                  <div style={{ height: 240 }}>
                    <ResponsiveContainer width="100%" height="100%">
                      {chart.type === 'radio' || chart.type === 'dropdown' ? (
                        <PieChart>
                          <Pie data={chart.data} cx="50%" cy="50%" innerRadius={55} outerRadius={80} paddingAngle={4} dataKey="value">
                            {chart.data.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                          </Pie>
                          <RechartsTooltip contentStyle={{ backgroundColor: '#0f172a', border: '1px solid #334155', borderRadius: '10px' }} />
                        </PieChart>
                      ) : (
                        <BarChart data={chart.data}>
                          <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.06)" />
                          <XAxis dataKey="name" stroke="#64748b" fontSize={11} />
                          <YAxis stroke="#64748b" allowDecimals={false} fontSize={11} />
                          <RechartsTooltip contentStyle={{ backgroundColor: '#0f172a', border: '1px solid #334155', borderRadius: '10px' }} />
                          <Bar dataKey="value" fill="#8b5cf6" radius={[6, 6, 0, 0]} />
                        </BarChart>
                      )}
                    </ResponsiveContainer>
                  </div>
                </div>
              ))}
            </div>
          )}
        </>
      )}

      {/* ═══ AI INSIGHTS TAB ═══ */}
      {activeTab === 'ai' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '2.5rem' }}>

          {/* NL Report */}
          <NLReport report={nlReport} />

          {/* Sentiment + Topics */}
          {ai && (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(380px, 1fr))', gap: '2rem' }}>
              <div className="glass-panel" style={{ padding: '2rem' }}>
                <h3 style={{ marginBottom: '1.5rem' }}>😊 Sentiment Distribution</h3>
                <div style={{ height: 250 }}>
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie data={ai.sentimentData} cx="50%" cy="50%" innerRadius={60} outerRadius={85} paddingAngle={5} dataKey="value">
                        {ai.sentimentData.map((entry, i) => (
                          <Cell key={i} fill={SENTIMENT_COLORS[entry.name] || COLORS[i]} />
                        ))}
                      </Pie>
                      <RechartsTooltip contentStyle={{ backgroundColor: '#0f172a', border: '1px solid #334155', borderRadius: '10px' }} />
                    </PieChart>
                  </ResponsiveContainer>
                </div>
                <div style={{ display: 'flex', justifyContent: 'center', gap: '1.5rem', flexWrap: 'wrap' }}>
                  {ai.sentimentData.map(s => (
                    <div key={s.name} style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.85rem' }}>
                      <div style={{ width: 10, height: 10, borderRadius: '50%', background: SENTIMENT_COLORS[s.name] }} />
                      {s.name}: <strong>{s.value}</strong>
                    </div>
                  ))}
                </div>
              </div>

              <div className="glass-panel" style={{ padding: '2rem' }}>
                <h3 style={{ marginBottom: '1.5rem' }}>🏷️ Topic Classification</h3>
                <div style={{ height: 250 }}>
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={ai.topicData} layout="vertical">
                      <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.06)" />
                      <XAxis type="number" stroke="#64748b" fontSize={11} />
                      <YAxis dataKey="name" type="category" stroke="#64748b" fontSize={11} width={70} />
                      <RechartsTooltip contentStyle={{ backgroundColor: '#0f172a', border: '1px solid #334155', borderRadius: '10px' }} />
                      <Bar dataKey="value" fill="#c084fc" radius={[0, 6, 6, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </div>
            </div>
          )}

          {/* Discovered Themes */}
          {themes.length > 0 && (
            <div>
              <h2 style={{ marginBottom: '1.5rem', fontSize: '1.5rem' }}>🔍 Semantically Discovered Themes</h2>
              <p style={{ color: '#94a3b8', marginBottom: '1.5rem', fontSize: '0.9rem' }}>
                Automatically clustered using sentence embeddings + KMeans. Similar responses were grouped by meaning, not just keywords.
              </p>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(340px, 1fr))', gap: '1.25rem' }}>
                {themes.map((theme, i) => <ThemeCard key={i} theme={theme} index={i} />)}
              </div>
            </div>
          )}

          {/* Keywords */}
          {ai?.topKeywords?.length > 0 && (
            <div className="glass-panel" style={{ padding: '2rem' }}>
              <h3 style={{ marginBottom: '1.5rem' }}>🔑 Top Keywords</h3>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.75rem' }}>
                {ai.topKeywords.map((kw, i) => (
                  <div key={i} style={{
                    padding: '0.5rem 1rem',
                    background: 'rgba(139, 92, 246, 0.1)',
                    border: '1px solid rgba(139, 92, 246, 0.3)',
                    borderRadius: '20px', color: '#a78bfa',
                    fontSize: '0.9rem', fontWeight: 500
                  }}>
                    {kw.text} <span style={{ opacity: 0.6 }}>({kw.value})</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Anomaly Detail */}
          {anomalies?.has_anomalies && (
            <div className="glass-panel" style={{ padding: '2rem', border: '1px solid rgba(239,68,68,0.2)' }}>
              <h3 style={{ marginBottom: '1.5rem', color: '#f87171' }}>🚨 Anomaly Report</h3>
              {[...( anomalies.score_anomalies || []), ...(anomalies.volume_anomalies || [])].map((a, i) => (
                <div key={i} style={{
                  padding: '0.75rem 1rem', borderRadius: '10px',
                  background: a.severity === 'critical' ? 'rgba(239,68,68,0.08)' : 'rgba(245,158,11,0.08)',
                  border: `1px solid ${a.severity === 'critical' ? '#ef444430' : '#f59e0b30'}`,
                  marginBottom: '0.75rem', fontSize: '0.9rem', color: '#cbd5e1'
                }}>
                  {a.message || `Score ${a.score} — Z-score: ${a.z_score} (${a.direction})`}
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ═══ ASK YOUR DATA TAB ═══ */}
      {activeTab === 'ask' && (
        <div>
          <div style={{ marginBottom: '1.5rem' }}>
            <h2 style={{ fontSize: '1.5rem', marginBottom: '0.5rem' }}>💬 Ask Your Data</h2>
            <p style={{ color: '#94a3b8', fontSize: '0.9rem' }}>
              An AI analyst powered by <strong>Retrieval-Augmented Generation (RAG)</strong> + semantic vector search.
              It retrieves the most relevant responses and generates evidence-backed answers.
            </p>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr auto', gap: '1.5rem', alignItems: 'start' }}>
            <AskYourData surveyId={id} />
            <div style={{ minWidth: 220 }}>
              <div className="glass-panel" style={{ padding: '1.25rem' }}>
                <div style={{ fontWeight: 700, marginBottom: '0.75rem', fontSize: '0.9rem', color: '#94a3b8' }}>💡 Sample Questions</div>
                {[
                  'What are the top complaints?',
                  'Why did satisfaction decrease?',
                  'Summarize the sentiment',
                  'What do customers love most?',
                  'Explain the NPS score',
                  'Show me negative responses'
                ].map((q, i) => (
                  <div key={i} style={{
                    padding: '0.6rem 0.75rem', marginBottom: '0.5rem',
                    background: 'rgba(255,255,255,0.04)',
                    borderRadius: '8px', cursor: 'pointer',
                    fontSize: '0.82rem', color: '#a78bfa',
                    border: '1px solid rgba(139,92,246,0.2)',
                    transition: 'all 0.2s'
                  }}
                    onClick={() => {}}
                  >
                    {q}
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}

      <style>{`
        @keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
      `}</style>
    </div>
  );
};

export default Analytics;
