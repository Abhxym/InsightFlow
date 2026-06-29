import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../services/axios';

const Dashboard = () => {
  const navigate = useNavigate();
  const user = JSON.parse(localStorage.getItem('user'));
  const [surveys, setSurveys] = useState([]);

  useEffect(() => {
    const fetchSurveys = async () => {
      try {
        const res = await api.get('/surveys');
        setSurveys(res.data);
      } catch (err) {
        console.error(err);
      }
    };
    fetchSurveys();
  }, []);

  const handleLogout = () => {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    navigate('/login');
  };

  return (
    <div className="container animate-fade-in">
      <nav className="navbar glass-panel">
        <a href="/" className="nav-brand">InsightFlow</a>
        <div style={{ display: 'flex', gap: '1rem', alignItems: 'center' }}>
          <span>Welcome, {user?.username}</span>
          <button onClick={handleLogout} className="btn" style={{ background: 'rgba(239, 68, 68, 0.2)', color: 'var(--danger-color)' }}>
            Logout
          </button>
        </div>
      </nav>

      <div className="glass-panel" style={{ padding: '3rem', textAlign: 'center', marginTop: '2rem' }}>
        <h1 style={{ background: 'linear-gradient(to right, #38bdf8, #818cf8)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>
          Your Dashboard
        </h1>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))', gap: '1.5rem', marginTop: '3rem' }}>
          <div className="glass-panel" style={{ padding: '2rem' }}>
            <h3>Create Survey</h3>
            <p>Start a new survey campaign.</p>
            <button onClick={() => navigate('/surveys/create')} className="btn btn-primary" style={{ marginTop: '1rem' }}>Get Started</button>
          </div>
          <div className="glass-panel" style={{ padding: '2rem' }}>
            <h3>View Results</h3>
            <p>Analyze your survey data.</p>
            <button className="btn" style={{ background: 'rgba(255,255,255,0.1)', color: '#fff', marginTop: '1rem' }}>View Stats</button>
          </div>
        </div>
      </div>

      <div style={{ marginTop: '3rem' }}>
        <h2>My Surveys</h2>
        {surveys.length === 0 ? (
          <p>You haven't created any surveys yet.</p>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem', marginTop: '1.5rem' }}>
            {surveys.map(s => (
              <div key={s.id} className="glass-panel" style={{ padding: '1.5rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div>
                  <h3 style={{ margin: 0 }}>{s.title}</h3>
                  <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>Status: {s.status}</span>
                </div>
                <div style={{ display: 'flex', gap: '1rem' }}>
                  <button onClick={() => navigate(`/surveys/${s.id}`)} className="btn btn-primary">Take Survey</button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default Dashboard;
