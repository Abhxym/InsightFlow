import React, { useState, useEffect, useMemo } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  BarChart, Bar, XAxis, YAxis, Tooltip as RechartsTooltip, ResponsiveContainer,
  PieChart, Pie, Cell, LineChart, Line, CartesianGrid
} from 'recharts';
import api from '../services/axios';

const COLORS = ['#38bdf8', '#818cf8', '#c084fc', '#f472b6', '#fb7185', '#fb923c'];

const Analytics = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  
  // Filters
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');

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

  // Filter raw responses based on dates
  const filteredTimeline = useMemo(() => {
    if (!data?.charts?.timelineData) return [];
    let timeline = data.charts.timelineData;
    if (startDate) {
      timeline = timeline.filter(t => t.date >= startDate);
    }
    if (endDate) {
      timeline = timeline.filter(t => t.date <= endDate);
    }
    return timeline;
  }, [data, startDate, endDate]);

  if (loading) return <div className="container" style={{ textAlign: 'center', marginTop: '2rem' }}>Loading Analytics...</div>;
  if (error) return <div className="container" style={{ textAlign: 'center', marginTop: '2rem', color: 'var(--danger-color)' }}>{error}</div>;
  if (!data) return null;

  const { survey, kpis, charts } = data;

  return (
    <div className="container animate-fade-in">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2rem' }}>
        <div>
          <h1 style={{ margin: 0 }}>Analytics: {survey.title}</h1>
          <p style={{ color: 'var(--text-muted)' }}>Status: {survey.status}</p>
        </div>
        <div style={{ display: 'flex', gap: '1rem' }}>
          <button onClick={() => navigate('/dashboard')} className="btn" style={{ background: 'rgba(255,255,255,0.1)' }}>Back to Dashboard</button>
          <button onClick={handleExportCSV} className="btn btn-primary">Export CSV</button>
        </div>
      </div>

      {/* KPIs */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '1.5rem', marginBottom: '3rem' }}>
        <div className="glass-panel" style={{ padding: '2rem', textAlign: 'center' }}>
          <h3 style={{ color: 'var(--text-muted)', fontSize: '1rem', margin: 0 }}>Total Responses</h3>
          <p style={{ fontSize: '2.5rem', fontWeight: 'bold', margin: '0.5rem 0 0 0', color: '#38bdf8' }}>{kpis.totalResponses}</p>
        </div>
        <div className="glass-panel" style={{ padding: '2rem', textAlign: 'center' }}>
          <h3 style={{ color: 'var(--text-muted)', fontSize: '1rem', margin: 0 }}>Average Rating</h3>
          <p style={{ fontSize: '2.5rem', fontWeight: 'bold', margin: '0.5rem 0 0 0', color: '#c084fc' }}>{kpis.averageRating}</p>
        </div>
        <div className="glass-panel" style={{ padding: '2rem', textAlign: 'center' }}>
          <h3 style={{ color: 'var(--text-muted)', fontSize: '1rem', margin: 0 }}>NPS Score</h3>
          <p style={{ fontSize: '2.5rem', fontWeight: 'bold', margin: '0.5rem 0 0 0', color: kpis.npsScore >= 0 ? '#4ade80' : '#f87171' }}>
            {kpis.npsScore !== null ? kpis.npsScore : 'N/A'}
          </p>
        </div>
      </div>

      {/* Filters */}
      <div className="glass-panel" style={{ padding: '1.5rem', marginBottom: '2rem', display: 'flex', gap: '1rem', alignItems: 'center' }}>
        <h4 style={{ margin: 0 }}>Filter by Date:</h4>
        <input type="date" className="form-input" style={{ width: 'auto' }} value={startDate} onChange={e => setStartDate(e.target.value)} />
        <span>to</span>
        <input type="date" className="form-input" style={{ width: 'auto' }} value={endDate} onChange={e => setEndDate(e.target.value)} />
      </div>

      {/* Charts */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: '2rem', marginBottom: '3rem' }}>
        
        {/* Timeline Line Chart */}
        <div className="glass-panel" style={{ padding: '2rem' }}>
          <h3 style={{ marginBottom: '1.5rem' }}>Response Trend</h3>
          <div style={{ height: 300 }}>
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={filteredTimeline}>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.1)" />
                <XAxis dataKey="date" stroke="#9ca3af" />
                <YAxis stroke="#9ca3af" allowDecimals={false} />
                <RechartsTooltip contentStyle={{ backgroundColor: '#1e293b', border: 'none', borderRadius: '8px' }} />
                <Line type="monotone" dataKey="count" stroke="#38bdf8" strokeWidth={3} dot={{ r: 6 }} activeDot={{ r: 8 }} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Choice Distributions */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(400px, 1fr))', gap: '2rem' }}>
          {charts.choiceCharts.map((chart, idx) => (
            <div key={idx} className="glass-panel" style={{ padding: '2rem' }}>
              <h3 style={{ marginBottom: '1.5rem', fontSize: '1.1rem' }}>{chart.title}</h3>
              <div style={{ height: 250 }}>
                <ResponsiveContainer width="100%" height="100%">
                  {chart.type === 'radio' || chart.type === 'dropdown' ? (
                    <PieChart>
                      <Pie
                        data={chart.data}
                        cx="50%"
                        cy="50%"
                        innerRadius={60}
                        outerRadius={80}
                        paddingAngle={5}
                        dataKey="value"
                      >
                        {chart.data.map((entry, index) => (
                          <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                        ))}
                      </Pie>
                      <RechartsTooltip contentStyle={{ backgroundColor: '#1e293b', border: 'none', borderRadius: '8px' }} />
                    </PieChart>
                  ) : (
                    <BarChart data={chart.data}>
                      <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.1)" />
                      <XAxis dataKey="name" stroke="#9ca3af" />
                      <YAxis stroke="#9ca3af" allowDecimals={false} />
                      <RechartsTooltip contentStyle={{ backgroundColor: '#1e293b', border: 'none', borderRadius: '8px' }} />
                      <Bar dataKey="value" fill="#818cf8" radius={[4, 4, 0, 0]} />
                    </BarChart>
                  )}
                </ResponsiveContainer>
              </div>
            </div>
          ))}
        </div>

      </div>
    </div>
  );
};

export default Analytics;
