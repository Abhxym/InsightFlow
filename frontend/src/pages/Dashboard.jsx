import { useNavigate } from 'react-router-dom';

const Dashboard = () => {
  const navigate = useNavigate();
  const user = JSON.parse(localStorage.getItem('user'));

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
        <p style={{ fontSize: '1.1rem', marginTop: '1rem' }}>
          This is a protected route. You can only see this if you are authenticated!
        </p>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))', gap: '1.5rem', marginTop: '3rem' }}>
          <div className="glass-panel" style={{ padding: '2rem' }}>
            <h3>Create Survey</h3>
            <p>Start a new survey campaign.</p>
            <button className="btn btn-primary" style={{ marginTop: '1rem' }}>Get Started</button>
          </div>
          <div className="glass-panel" style={{ padding: '2rem' }}>
            <h3>View Results</h3>
            <p>Analyze your survey data.</p>
            <button className="btn" style={{ background: 'rgba(255,255,255,0.1)', color: '#fff', marginTop: '1rem' }}>View Stats</button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Dashboard;
