import { useState, useEffect, useMemo } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, PieChart, Pie, Cell,
  AreaChart, Area, CartesianGrid, RadarChart, Radar, PolarGrid, PolarAngleAxis
} from 'recharts';
import {
  ArrowLeft, Download, LayoutDashboard, Sparkles, MessagesSquare, Users, Star,
  Target, Smile, AlertTriangle, FileText, Tags, KeyRound, Layers, Loader2, Send
} from 'lucide-react';
import api from '../services/axios';
import AskYourData from '../components/AskYourData';
import {
  Card, StatCard, Segmented, ChartTooltip, Ring, ProgressBar, Empty, axisProps,
  CHART_COLORS, SENTIMENT_COLORS, renderRichText
} from '../components/ui';

const TABS = [
  { value: 'overview', label: 'Overview', icon: LayoutDashboard },
  { value: 'ai', label: 'AI insights', icon: Sparkles },
  { value: 'ask', label: 'Ask your data', icon: MessagesSquare }
];

// ─── Anomaly banner ──────────────────────────────────────────────────────────
const AnomalyAlert = ({ anomalies }) => {
  if (!anomalies?.has_anomalies) return null;
  const count = anomalies.critical_count + anomalies.warning_count;
  const headline = anomalies.critical_count > 0
    ? `${anomalies.critical_count} serious unusual pattern${anomalies.critical_count > 1 ? 's' : ''} need${anomalies.critical_count > 1 ? '' : 's'} a look`
    : `${count} unusual pattern${count > 1 ? 's' : ''} spotted`;
  return (
    <div className={`alert ${anomalies.critical_count > 0 ? '' : 'warning'} fade-up`} style={{ marginBottom: 16 }}>
      <AlertTriangle size={18} style={{ flexShrink: 0, marginTop: 2 }} />
      <div>
        <strong>{headline}</strong>
        {anomalies.volume_anomalies?.slice(0, 2).map((a, i) => (
          <div key={i} style={{ fontSize: '0.82rem', opacity: 0.85 }}>{a.message}</div>
        ))}
      </div>
    </div>
  );
};

// ─── Choice question chart ───────────────────────────────────────────────────
const ChoiceChart = ({ chart }) => {
  const isPie = chart.type === 'radio' || chart.type === 'dropdown';
  const total = chart.data.reduce((a, d) => a + d.value, 0);
  const sorted = [...chart.data].sort((a, b) => b.value - a.value);
  const top = sorted[0]?.value || 1;
  return (
    <Card title={chart.title} sub={isPie ? `${total} answers · single choice` : `${total} picks · multiple choice`}>
      {isPie ? (
        <div className="row" style={{ alignItems: 'center', gap: 20 }}>
          <div style={{ width: 170, height: 170, flexShrink: 0 }}>
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie data={chart.data} dataKey="value" nameKey="name" innerRadius={50} outerRadius={78} paddingAngle={3} stroke="none">
                  {chart.data.map((_, i) => <Cell key={i} fill={CHART_COLORS[i % CHART_COLORS.length]} />)}
                </Pie>
                <Tooltip content={<ChartTooltip />} />
              </PieChart>
            </ResponsiveContainer>
          </div>
          <div className="stack" style={{ gap: 10, flex: 1, minWidth: 0 }}>
            {chart.data.map((d, i) => (
              <div key={d.name}>
                <div className="row" style={{ justifyContent: 'space-between', fontSize: '0.84rem', marginBottom: 5 }}>
                  <span className="row" style={{ gap: 7, minWidth: 0 }}>
                    <span className="dot" style={{ background: CHART_COLORS[i % CHART_COLORS.length] }} />
                    <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{d.name}</span>
                  </span>
                  <strong>{total ? Math.round((d.value / total) * 100) : 0}%</strong>
                </div>
                <ProgressBar thin value={total ? (d.value / total) * 100 : 0} />
              </div>
            ))}
          </div>
        </div>
      ) : (
        <div className="stack" style={{ gap: 12 }}>
          {sorted.map((d, i) => (
            <div key={d.name}>
              <div className="row" style={{ justifyContent: 'space-between', fontSize: '0.84rem', marginBottom: 6 }}>
                <span>{d.name}</span>
                <span className="muted"><strong style={{ color: 'var(--text)' }}>{d.value}</strong> picks</span>
              </div>
              <div className="bar-track" style={{ height: 14 }}>
                <div className={`bar-fill ${i > 0 ? 'muted' : ''}`} style={{ width: `${(d.value / top) * 100}%` }} />
              </div>
            </div>
          ))}
        </div>
      )}
    </Card>
  );
};

// ─── Main page ───────────────────────────────────────────────────────────────
const Analytics = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [activeTab, setActiveTab] = useState('overview');
  const [exporting, setExporting] = useState(false);

  useEffect(() => {
    api.get(`/surveys/${id}/analytics`)
      .then(res => setData(res.data))
      .catch(err => setError(err.response?.data?.message || 'Failed to fetch analytics'))
      .finally(() => setLoading(false));
  }, [id]);

  const handleExportCSV = async () => {
    setExporting(true);
    try {
      const res = await api.get(`/surveys/${id}/analytics/export`, { responseType: 'blob' });
      const url = window.URL.createObjectURL(new Blob([res.data]));
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', `survey_${id}_export.csv`);
      document.body.appendChild(link);
      link.click();
      link.remove();
    } catch (err) {
      console.error('Export failed', err);
    } finally {
      setExporting(false);
    }
  };

  const filteredTimeline = useMemo(() => {
    const timeline = data?.aiEngine?.time_trends || data?.charts?.timelineData || [];
    return timeline
      .filter(t => (!startDate || t.date >= startDate) && (!endDate || t.date <= endDate))
      .map(t => ({ ...t, label: new Date(t.date + 'T00:00').toLocaleDateString(undefined, { day: 'numeric', month: 'short' }) }));
  }, [data, startDate, endDate]);

  if (loading) return (
    <div style={{ display: 'grid', placeItems: 'center', minHeight: '60vh', textAlign: 'center' }}>
      <div>
        <Loader2 size={34} className="spin" color="var(--accent)" />
        <p style={{ marginTop: 12 }}>Running the analytics engine — themes, sentiment and statistics…</p>
      </div>
    </div>
  );
  if (error) return <div className="alert"><AlertTriangle size={18} /> {error}</div>;
  if (!data) return null;

  const { survey, kpis, charts, ai, aiEngine } = data;
  const stats = aiEngine?.statistics || {};
  const nps = aiEngine?.nps || {};
  const csat = aiEngine?.csat || {};
  const themes = aiEngine?.themes || [];
  const anomalies = aiEngine?.anomalies || {};
  const nlReport = aiEngine?.nl_report || null;
  const distribution = aiEngine?.distribution || [];
  const npsScore = nps.score ?? kpis.npsScore;

  const sentimentData = ai?.sentimentData || [];
  const sentimentTotal = sentimentData.reduce((a, s) => a + s.value, 0);
  const positive = sentimentData.find(s => s.name === 'Positive')?.value || 0;
  const topicData = (ai?.topicData || []).map(t => ({ ...t, full: Math.max(...(ai?.topicData || []).map(x => x.value)) }));

  return (
    <>
      {/* Header */}
      <div className="page-head">
        <div>
          <button className="btn btn-ghost btn-sm" style={{ marginBottom: 10, paddingLeft: 0 }} onClick={() => navigate('/dashboard')}>
            <ArrowLeft size={15} /> All surveys
          </button>
          <h1>{survey.title} <span className={`pill ${survey.status === 'published' ? 'solid' : ''}`} style={{ fontSize: '0.72rem' }}>{survey.status === 'published' ? 'Live' : 'Draft'}</span></h1>
          <p>{kpis.totalResponses} responses · analysed with statistics, NLP themes and an AI analyst</p>
        </div>
        <div className="row wrap">
          <button className="btn" onClick={() => navigate(`/surveys/${id}`)}><Send size={15} /> Open form</button>
          <button className="btn btn-primary" onClick={handleExportCSV} disabled={exporting}>
            {exporting ? <Loader2 size={15} className="spin" /> : <Download size={15} />} Export CSV
          </button>
        </div>
      </div>

      <AnomalyAlert anomalies={anomalies} />

      <div style={{ marginBottom: 20 }}>
        <Segmented value={activeTab} onChange={setActiveTab} options={TABS} />
      </div>

      {/* ═══ OVERVIEW ═══ */}
      {activeTab === 'overview' && (
        <>
          <div className="grid grid-4">
            <StatCard accent icon={Users} label="Total responses" value={kpis.totalResponses} />
            <StatCard icon={Star} label="Average rating" value={stats.mean ?? (Number(kpis.averageRating) || null)} unit="/10" hint={stats.std_dev !== undefined ? `spread ±${stats.std_dev}` : undefined} />
            <StatCard icon={Target} label="Net Promoter Score" value={npsScore} hint={nps.label} />
            <StatCard icon={Smile} label="Satisfied (CSAT)" value={csat.score ?? null} unit="%" hint={csat.label} />
          </div>

          <div className="grid grid-main" style={{ marginTop: 16 }}>
            <Card
              title="Responses over time"
              sub="How many people answered each day"
              action={
                <div className="row">
                  <input type="date" className="form-input" style={{ width: 'auto', padding: '6px 10px', fontSize: '0.78rem', borderRadius: 999 }} value={startDate} onChange={e => setStartDate(e.target.value)} aria-label="From date" />
                  <span className="muted">–</span>
                  <input type="date" className="form-input" style={{ width: 'auto', padding: '6px 10px', fontSize: '0.78rem', borderRadius: 999 }} value={endDate} onChange={e => setEndDate(e.target.value)} aria-label="To date" />
                </div>
              }
            >
              {filteredTimeline.length === 0 ? (
                <Empty title="No responses in this range" />
              ) : (
                <div style={{ height: 280 }}>
                  <ResponsiveContainer width="100%" height="100%">
                    <AreaChart data={filteredTimeline} margin={{ top: 10, right: 8, left: -20, bottom: 0 }}>
                      <defs>
                        <linearGradient id="trendFill" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="0%" stopColor="#e2622f" stopOpacity={0.45} />
                          <stop offset="100%" stopColor="#e2622f" stopOpacity={0} />
                        </linearGradient>
                      </defs>
                      <CartesianGrid vertical={false} stroke="rgba(255,255,255,0.05)" />
                      <XAxis dataKey="label" {...axisProps} />
                      <YAxis {...axisProps} allowDecimals={false} />
                      <Tooltip content={<ChartTooltip />} cursor={{ stroke: 'rgba(255,255,255,0.15)' }} />
                      <Area type="monotone" dataKey="count" name="Responses" stroke="#e2622f" strokeWidth={2.5} fill="url(#trendFill)" dot={{ r: 3, fill: '#e2622f', strokeWidth: 0 }} activeDot={{ r: 6, fill: '#e2622f', stroke: '#1c1c1c', strokeWidth: 3 }} />
                    </AreaChart>
                  </ResponsiveContainer>
                </div>
              )}
            </Card>

            <Card title="Net Promoter Score" sub="Would people recommend you? (−100 to +100)">
              {npsScore === null || npsScore === undefined ? (
                <Empty icon={Target} title="No rating answers yet" />
              ) : (
                <>
                  <div style={{ display: 'grid', placeItems: 'center' }}>
                    <Ring value={npsScore + 100} max={200} size={168} color={npsScore >= 0 ? '#e2622f' : '#e5604f'}>
                      <div>
                        <div className="metric">{npsScore > 0 ? '+' : ''}{npsScore}</div>
                        <div className="metric-label">{nps.label || 'NPS'}</div>
                      </div>
                    </Ring>
                  </div>
                  {nps.promoter_pct !== undefined && (
                    <>
                      <div style={{ display: 'flex', height: 10, borderRadius: 999, overflow: 'hidden', margin: '18px 0 10px' }}>
                        <div style={{ width: `${nps.promoter_pct}%`, background: '#7bc67e' }} />
                        <div style={{ width: `${nps.passive_pct}%`, background: '#6a6a6a' }} />
                        <div style={{ width: `${nps.detractor_pct}%`, background: '#e5604f' }} />
                      </div>
                      <div className="legend" style={{ justifyContent: 'space-between' }}>
                        <span><span className="dot" style={{ background: '#7bc67e' }} />Promoters {nps.promoter_pct}%</span>
                        <span><span className="dot" style={{ background: '#6a6a6a' }} />Passives {nps.passive_pct}%</span>
                        <span><span className="dot" style={{ background: '#e5604f' }} />Detractors {nps.detractor_pct}%</span>
                      </div>
                    </>
                  )}
                </>
              )}
            </Card>
          </div>

          <div className="grid grid-main" style={{ marginTop: 16 }}>
            <Card title="Score distribution" sub="How ratings are spread out">
              {distribution.length === 0 ? (
                <Empty icon={Star} title="No numeric answers yet" />
              ) : (
                <div style={{ height: 240 }}>
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={distribution} margin={{ top: 10, right: 8, left: -20, bottom: 0 }}>
                      <CartesianGrid vertical={false} stroke="rgba(255,255,255,0.05)" />
                      <XAxis dataKey="range" {...axisProps} />
                      <YAxis {...axisProps} allowDecimals={false} />
                      <Tooltip content={<ChartTooltip />} cursor={{ fill: 'rgba(255,255,255,0.03)' }} />
                      <Bar dataKey="count" name="Answers" radius={[10, 10, 10, 10]} barSize={34}>
                        {distribution.map((d, i) => {
                          const max = Math.max(...distribution.map(x => x.count));
                          return <Cell key={i} fill={d.count === max ? '#e2622f' : '#3a3a3a'} />;
                        })}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              )}
            </Card>

            <Card title="Score summary" sub="The numbers behind the chart">
              {stats.count ? (
                <div className="stack" style={{ gap: 10 }}>
                  {[
                    ['Average', stats.mean],
                    ['Middle value (median)', stats.median],
                    ['Lowest / highest', `${stats.min} / ${stats.max}`],
                    ['Middle 50% range', `${stats.q1} – ${stats.q3}`],
                    ['Spread (std. dev.)', stats.std_dev],
                    ['Rated answers', stats.count]
                  ].map(([k, v]) => (
                    <div key={k} className="row" style={{ justifyContent: 'space-between', padding: '9px 0', borderBottom: '1px solid var(--border)', fontSize: '0.86rem' }}>
                      <span className="muted">{k}</span><strong>{v}</strong>
                    </div>
                  ))}
                </div>
              ) : <Empty icon={Star} title="No numeric answers yet" />}
            </Card>
          </div>

          {charts.choiceCharts?.length > 0 && (
            <>
              <div className="section-title"><h2>Question breakdown</h2></div>
              <div className="grid grid-2">
                {charts.choiceCharts.map((chart, idx) => <ChoiceChart key={idx} chart={chart} />)}
              </div>
            </>
          )}
        </>
      )}

      {/* ═══ AI INSIGHTS ═══ */}
      {activeTab === 'ai' && (
        <>
          <div className="grid grid-main">
            <Card title={<><FileText size={16} color="var(--accent)" /> Executive summary</>} sub="Written by AI from the computed statistics and themes">
              {nlReport ? (
                <div className="prose">
                  {nlReport.split('\n\n').filter(Boolean).map((para, i) => (
                    <p key={i} dangerouslySetInnerHTML={{ __html: renderRichText(para) }} />
                  ))}
                </div>
              ) : <Empty icon={FileText} title="Summary unavailable">Start the Python AI service to generate it.</Empty>}
            </Card>

            <Card title="Sentiment" sub="Tone of open-ended answers">
              {sentimentTotal === 0 ? <Empty title="No text answers yet" /> : (
                <>
                  <div style={{ height: 190, position: 'relative' }}>
                    <ResponsiveContainer width="100%" height="100%">
                      <PieChart>
                        <Pie data={sentimentData} dataKey="value" nameKey="name" innerRadius={62} outerRadius={84} paddingAngle={3} stroke="none">
                          {sentimentData.map(s => <Cell key={s.name} fill={SENTIMENT_COLORS[s.name]} />)}
                        </Pie>
                        <Tooltip content={<ChartTooltip />} />
                      </PieChart>
                    </ResponsiveContainer>
                    <div style={{ position: 'absolute', inset: 0, display: 'grid', placeItems: 'center', pointerEvents: 'none', textAlign: 'center' }}>
                      <div>
                        <div className="metric" style={{ fontSize: '2rem' }}>{Math.round((positive / sentimentTotal) * 100)}<small>%</small></div>
                        <div className="metric-label">positive</div>
                      </div>
                    </div>
                  </div>
                  <div className="stack" style={{ gap: 10, marginTop: 10 }}>
                    {sentimentData.map(s => (
                      <div key={s.name}>
                        <div className="row" style={{ justifyContent: 'space-between', fontSize: '0.82rem', marginBottom: 5 }}>
                          <span className="row" style={{ gap: 7 }}><span className="dot" style={{ background: SENTIMENT_COLORS[s.name] }} />{s.name}</span>
                          <strong>{s.value}</strong>
                        </div>
                        <div className="bar-track bar-thin"><div className="bar-fill" style={{ width: `${(s.value / sentimentTotal) * 100}%`, background: SENTIMENT_COLORS[s.name] }} /></div>
                      </div>
                    ))}
                  </div>
                </>
              )}
            </Card>
          </div>

          <div className="section-title"><h2>What people talk about</h2><span className="muted" style={{ fontSize: '0.84rem' }}>Themes found by grouping answers by meaning</span></div>
          {themes.length === 0 ? (
            <Empty icon={Layers} title="No themes yet">Themes appear once there are at least two open-ended answers and the AI service is running.</Empty>
          ) : (
            <div className="grid grid-main">
              <Card title={<><Layers size={16} color="var(--accent)" /> Main themes</>} sub="Share of open-ended answers in each theme">
                <div className="stack" style={{ gap: 18 }}>
                  {themes.map((t, i) => (
                    <div key={t.id ?? i}>
                      <div className="row" style={{ justifyContent: 'space-between', marginBottom: 8 }}>
                        <div>
                          <div style={{ fontSize: '0.74rem' }} className="muted">{String(i + 1).padStart(2, '0')}</div>
                          <strong>{t.label}</strong>
                        </div>
                        <div className="metric" style={{ fontSize: '1.9rem' }}>{Math.round(t.percentage)}<small>%</small></div>
                      </div>
                      <ProgressBar value={t.percentage} muted={i > 0} />
                    </div>
                  ))}
                </div>
              </Card>
              <Card title="In their own words" sub="The most typical answer in each theme">
                <div className="stack" style={{ gap: 12 }}>
                  {themes.map((t, i) => (
                    <div key={t.id ?? i}>
                      <div className="row" style={{ justifyContent: 'space-between', marginBottom: 6 }}>
                        <span className="pill accent">{t.label}</span>
                        <span className="muted" style={{ fontSize: '0.76rem' }}>{t.count} answers</span>
                      </div>
                      <blockquote className="quote">“{t.representative_quote}”</blockquote>
                    </div>
                  ))}
                </div>
              </Card>
            </div>
          )}

          <div className="grid grid-2" style={{ marginTop: 16 }}>
            <Card title={<><Tags size={16} color="var(--accent)" /> Topics mentioned</>} sub="Each answer tagged on arrival">
              {topicData.length < 3 ? (
                topicData.length === 0 ? <Empty icon={Tags} title="No topics yet" /> : (
                  <div style={{ height: 240 }}>
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={topicData} layout="vertical" margin={{ left: 10, right: 16 }}>
                        <XAxis type="number" {...axisProps} allowDecimals={false} />
                        <YAxis type="category" dataKey="name" {...axisProps} width={80} />
                        <Tooltip content={<ChartTooltip />} cursor={{ fill: 'rgba(255,255,255,0.03)' }} />
                        <Bar dataKey="value" name="Answers" fill="#e2622f" radius={[0, 999, 999, 0]} barSize={16} />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                )
              ) : (
                <div style={{ height: 260 }}>
                  <ResponsiveContainer width="100%" height="100%">
                    <RadarChart data={topicData} outerRadius="72%">
                      <PolarGrid stroke="rgba(255,255,255,0.08)" />
                      <PolarAngleAxis dataKey="name" tick={{ fill: '#9a9a9a', fontSize: 11 }} />
                      <Radar dataKey="value" name="Answers" stroke="#e2622f" fill="#e2622f" fillOpacity={0.35} strokeWidth={2} />
                      <Tooltip content={<ChartTooltip />} />
                    </RadarChart>
                  </ResponsiveContainer>
                </div>
              )}
            </Card>

            <Card title={<><KeyRound size={16} color="var(--accent)" /> Top keywords</>} sub="Words that come up most often">
              {ai?.topKeywords?.length ? (
                <div className="row wrap" style={{ gap: 8 }}>
                  {ai.topKeywords.map((kw, i) => {
                    const max = ai.topKeywords[0].value;
                    const strong = kw.value / max;
                    return (
                      <span key={i} className={`pill ${strong > 0.6 ? 'solid' : strong > 0.3 ? 'accent' : ''}`}
                        style={{ fontSize: `${0.74 + strong * 0.2}rem`, padding: '6px 12px' }}>
                        {kw.text} <span style={{ opacity: 0.65 }}>{kw.value}</span>
                      </span>
                    );
                  })}
                </div>
              ) : <Empty icon={KeyRound} title="No keywords yet" />}
            </Card>
          </div>

          {anomalies?.has_anomalies && (
            <Card title={<><AlertTriangle size={16} color="var(--negative)" /> Unusual activity</>} sub="Values far outside the normal range (z-score > 2)" style={{ marginTop: 16 }}>
              <div className="stack" style={{ gap: 8 }}>
                {[...(anomalies.score_anomalies || []), ...(anomalies.volume_anomalies || [])].map((a, i) => (
                  <div key={i} className="list-row" style={{ fontSize: '0.86rem' }}>
                    <span className={`pill ${a.severity === 'critical' ? 'negative' : 'accent'}`}>{a.severity}</span>
                    {a.message || `Score ${a.score} is unusually ${a.direction} (z = ${a.z_score})`}
                  </div>
                ))}
              </div>
            </Card>
          )}
        </>
      )}

      {/* ═══ ASK ═══ */}
      {activeTab === 'ask' && <AskYourData surveyId={id} />}
    </>
  );
};

export default Analytics;
