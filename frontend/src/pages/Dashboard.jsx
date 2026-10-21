import { useEffect, useMemo, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import {
  AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid,
  PieChart, Pie, Cell
} from 'recharts';
import {
  ClipboardList, Users, Star, Send, ArrowUpRight, BarChart2, PenLine,
  MessageSquareText, Sparkles, PlusSquare, FileQuestion, Clock3
} from 'lucide-react';
import api from '../services/axios';
import {
  Card, StatCard, Segmented, ChartTooltip, Ring, ProgressBar, Empty, axisProps,
  SENTIMENT_COLORS, timeAgo
} from '../components/ui';

const Dashboard = () => {
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const user = JSON.parse(localStorage.getItem('user') || '{}');
  const [surveys, setSurveys] = useState([]);
  const [overview, setOverview] = useState(null);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('all');
  const [range, setRange] = useState('14');
  const query = (params.get('q') || '').toLowerCase();

  useEffect(() => {
    Promise.all([api.get('/surveys'), api.get('/surveys/overview').catch(() => ({ data: null }))])
      .then(([s, o]) => { setSurveys(s.data); setOverview(o.data); })
      .catch(err => console.error(err))
      .finally(() => setLoading(false));
  }, []);

  const visible = useMemo(() => surveys.filter(s =>
    (filter === 'all' || s.status === filter) &&
    (!query || s.title.toLowerCase().includes(query))
  ), [surveys, filter, query]);

  const totals = overview?.totals || { surveys: surveys.length, published: 0, responses: 0, avgRating: null };
  const trend = (overview?.trend || []).slice(range === '7' ? -7 : 0)
    .map(d => ({ ...d, label: new Date(d.date + 'T00:00').toLocaleDateString(undefined, { day: 'numeric', month: 'short' }) }));

  // Week-over-week change in responses
  const weekDelta = useMemo(() => {
    const t = overview?.trend || [];
    if (t.length < 14) return null;
    const prev = t.slice(0, 7).reduce((a, d) => a + d.count, 0);
    const cur = t.slice(7).reduce((a, d) => a + d.count, 0);
    if (!prev) return cur ? 100 : null;
    return Math.round(((cur - prev) / prev) * 100);
  }, [overview]);

  const sentiment = overview?.sentiment || { Positive: 0, Neutral: 0, Negative: 0 };
  const sentimentTotal = Object.values(sentiment).reduce((a, b) => a + b, 0);
  const sentimentData = Object.entries(sentiment).map(([name, value]) => ({ name, value }));
  const positivePct = sentimentTotal ? Math.round((sentiment.Positive / sentimentTotal) * 100) : 0;

  const topSurveys = [...surveys]
    .sort((a, b) => Number(b.response_count || 0) - Number(a.response_count || 0))
    .slice(0, 4)
    .map(s => ({ id: s.id, name: s.title, responses: Number(s.response_count || 0) }));

  const publishedPct = totals.surveys ? Math.round((totals.published / totals.surveys) * 100) : 0;
  const hour = new Date().getHours();
  const greeting = hour < 12 ? 'Good morning' : hour < 18 ? 'Good afternoon' : 'Good evening';

  if (loading) {
    return (
      <div className="stack">
        <div className="skeleton" style={{ height: 60, width: 320 }} />
        <div className="grid grid-4">{[0, 1, 2, 3].map(i => <div key={i} className="skeleton" style={{ height: 148 }} />)}</div>
        <div className="grid grid-main"><div className="skeleton" style={{ height: 340 }} /><div className="skeleton" style={{ height: 340 }} /></div>
      </div>
    );
  }

  return (
    <>
      <div className="page-head">
        <div>
          <h1>{greeting}, {user.username || 'there'} <small>· {new Date().toLocaleDateString(undefined, { weekday: 'long', day: 'numeric', month: 'long' })}</small></h1>
          <p>Here is how your surveys are doing. Open any survey to see its full analysis or ask the AI analyst a question.</p>
        </div>
      </div>

      {/* KPI row */}
      <div className="grid grid-4">
        <StatCard accent icon={Users} label="Total responses" value={totals.responses} delta={weekDelta} hint="vs last week" />
        <StatCard icon={ClipboardList} label="Surveys" value={totals.surveys} hint={`${totals.published} live`} />
        <StatCard icon={Star} label="Average rating" value={totals.avgRating} unit="/10" hint="across rating questions" />
        <StatCard icon={MessageSquareText} label="Positive feedback" value={sentimentTotal ? positivePct : null} unit="%" hint={`${sentimentTotal} text answers`} />
      </div>

      {/* Charts */}
      <div className="grid grid-main" style={{ marginTop: 16 }}>
        <Card
          title="Response activity"
          sub="New responses per day across all your surveys"
          action={<Segmented value={range} onChange={setRange} options={[{ value: '7', label: '7 days' }, { value: '14', label: '14 days' }]} />}
        >
          <div style={{ height: 270 }}>
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={trend} margin={{ top: 10, right: 8, left: -20, bottom: 0 }}>
                <defs>
                  <linearGradient id="activityFill" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#e2622f" stopOpacity={0.45} />
                    <stop offset="100%" stopColor="#e2622f" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid vertical={false} stroke="rgba(255,255,255,0.05)" />
                <XAxis dataKey="label" {...axisProps} interval="preserveStartEnd" />
                <YAxis {...axisProps} allowDecimals={false} />
                <Tooltip content={<ChartTooltip />} cursor={{ stroke: 'rgba(255,255,255,0.15)' }} />
                <Area type="monotone" dataKey="count" name="Responses" stroke="#e2622f" strokeWidth={2.5} fill="url(#activityFill)" activeDot={{ r: 6, fill: '#e2622f', stroke: '#1c1c1c', strokeWidth: 3 }} />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </Card>

        <Card title="Overall mood" sub="Sentiment of open-ended answers">
          {sentimentTotal === 0 ? (
            <Empty icon={MessageSquareText} title="No text answers yet">Sentiment appears once people answer open questions.</Empty>
          ) : (
            <>
              <div style={{ height: 190, position: 'relative' }}>
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie data={sentimentData} dataKey="value" nameKey="name" innerRadius={62} outerRadius={84} paddingAngle={3} stroke="none" startAngle={90} endAngle={-270}>
                      {sentimentData.map(d => <Cell key={d.name} fill={SENTIMENT_COLORS[d.name]} />)}
                    </Pie>
                    <Tooltip content={<ChartTooltip />} />
                  </PieChart>
                </ResponsiveContainer>
                <div style={{ position: 'absolute', inset: 0, display: 'grid', placeItems: 'center', pointerEvents: 'none' }}>
                  <div style={{ textAlign: 'center' }}>
                    <div className="metric" style={{ fontSize: '2rem' }}>{positivePct}<small>%</small></div>
                    <div className="metric-label">positive</div>
                  </div>
                </div>
              </div>
              <div className="legend" style={{ justifyContent: 'center', marginTop: 8 }}>
                {sentimentData.map(d => (
                  <span key={d.name}><span className="dot" style={{ background: SENTIMENT_COLORS[d.name] }} />{d.name} · {d.value}</span>
                ))}
              </div>
            </>
          )}
        </Card>
      </div>

      <div className="grid grid-3" style={{ marginTop: 16 }}>
        <Card title="Most answered surveys" sub="Responses per survey" className="span-2">
          {topSurveys.length === 0 || topSurveys.every(s => s.responses === 0) ? (
            <Empty icon={BarChart2} title="No responses yet">Share a published survey to start collecting answers.</Empty>
          ) : (
            <div className="stack" style={{ gap: 18 }}>
              {topSurveys.map((s, i) => (
                <div key={s.id}>
                  <div className="row" style={{ justifyContent: 'space-between', marginBottom: 8 }}>
                    <div style={{ minWidth: 0 }}>
                      <div className="muted" style={{ fontSize: '0.72rem' }}>{String(i + 1).padStart(2, '0')}</div>
                      <strong style={{ display: 'block', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{s.name}</strong>
                    </div>
                    <div className="metric" style={{ fontSize: '1.8rem' }}>{s.responses}</div>
                  </div>
                  <ProgressBar value={(s.responses / topSurveys[0].responses) * 100} muted={i > 0} />
                </div>
              ))}
            </div>
          )}
        </Card>

        <Card title="Publishing" sub="Share of surveys that are live">
          <div style={{ display: 'grid', placeItems: 'center', padding: '6px 0' }}>
            <Ring value={publishedPct} size={160}>
              <div>
                <div className="metric" style={{ fontSize: '2.2rem' }}>{publishedPct}<small>%</small></div>
                <div className="metric-label">{totals.published} of {totals.surveys} live</div>
              </div>
            </Ring>
          </div>
          <button className="btn btn-block" style={{ marginTop: 14 }} onClick={() => navigate('/surveys/create')}>
            <PlusSquare size={15} /> Create a survey
          </button>
        </Card>
      </div>

      {/* Survey list */}
      <div className="section-title" style={{ justifyContent: 'space-between', flexWrap: 'wrap' }}>
        <h2>Your surveys <small className="muted" style={{ fontSize: '0.85rem', fontWeight: 500 }}>{visible.length}</small></h2>
        <Segmented
          value={filter}
          onChange={setFilter}
          options={[
            { value: 'all', label: 'All' },
            { value: 'published', label: 'Live' },
            { value: 'draft', label: 'Drafts' }
          ]}
        />
      </div>

      {query && <p style={{ marginBottom: 12 }}>Showing results for “{params.get('q')}”.</p>}

      {visible.length === 0 ? (
        <Empty icon={FileQuestion} title={surveys.length ? 'No surveys match' : 'No surveys yet'}>
          {surveys.length ? 'Try a different filter or search.' : (
            <button className="btn btn-primary" style={{ marginTop: 12 }} onClick={() => navigate('/surveys/create')}>
              <PlusSquare size={15} /> Create your first survey
            </button>
          )}
        </Empty>
      ) : (
        <div className="stack" style={{ gap: 10 }}>
          {visible.map(s => (
            <div key={s.id} className="list-row fade-up">
              <span className="stat-icon" style={{ width: 40, height: 40, borderRadius: 12, display: 'grid', placeItems: 'center', background: 'var(--surface-3)' }}>
                <ClipboardList size={18} color={s.status === 'published' ? '#e2622f' : '#7a7a7a'} />
              </span>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div className="row" style={{ gap: 8 }}>
                  <strong style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{s.title}</strong>
                  <span className={`pill ${s.status === 'published' ? 'solid' : ''}`}>{s.status === 'published' ? 'Live' : 'Draft'}</span>
                </div>
                <div className="row muted" style={{ fontSize: '0.78rem', marginTop: 4, gap: 14, flexWrap: 'wrap' }}>
                  <span className="row" style={{ gap: 5 }}><Users size={13} /> {s.response_count ?? 0} responses</span>
                  <span className="row" style={{ gap: 5 }}><FileQuestion size={13} /> {s.question_count ?? 0} questions</span>
                  <span className="row" style={{ gap: 5 }}><Clock3 size={13} /> {timeAgo(s.last_response_at)}</span>
                </div>
              </div>
              <div className="row">
                <button className="btn btn-sm" onClick={() => navigate(`/surveys/${s.id}`)}><Send size={14} /> Open form</button>
                <button className="btn btn-sm btn-primary" onClick={() => navigate(`/surveys/${s.id}/analytics`)}><BarChart2 size={14} /> Insights</button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* How it works */}
      <div id="how-it-works" className="section-title"><h2>How it works</h2></div>
      <div className="grid grid-3">
        {[
          { icon: PenLine, title: '1. Build a survey', text: 'Mix ratings, choices and open questions. Add branch logic so people only see what applies to them.' },
          { icon: Users, title: '2. Collect answers', text: 'Each open answer is scored for sentiment and tagged with a topic as soon as it arrives.' },
          { icon: Sparkles, title: '3. Ask in plain English', text: 'Open Insights and ask “What are people unhappy about?” — the AI answers from your data and shows the responses it used.' }
        ].map(s => (
          <Card key={s.title}>
            <div className="row" style={{ marginBottom: 10 }}>
              <span className="stat-icon" style={{ width: 36, height: 36, borderRadius: 11, display: 'grid', placeItems: 'center', background: 'var(--accent-soft)', color: 'var(--accent)' }}><s.icon size={17} /></span>
              <strong>{s.title}</strong>
              <ArrowUpRight size={15} className="muted" style={{ marginLeft: 'auto' }} />
            </div>
            <p style={{ fontSize: '0.86rem' }}>{s.text}</p>
          </Card>
        ))}
      </div>
    </>
  );
};

export default Dashboard;
