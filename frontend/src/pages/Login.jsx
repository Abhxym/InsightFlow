import { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { ArrowRight, AlertTriangle, Loader2 } from 'lucide-react';
import api from '../services/axios';
import AuthLayout from '../components/AuthLayout';

const Login = () => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  const handleLogin = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    try {
      const res = await api.post('/auth/login', { email, password });
      localStorage.setItem('token', res.data.token);
      localStorage.setItem('user', JSON.stringify(res.data.user));
      navigate('/dashboard');
    } catch (err) {
      setError(err.response?.data?.message || 'Login failed');
      setLoading(false);
    }
  };

  return (
    <AuthLayout>
      <h1>Welcome back</h1>
      <p style={{ marginBottom: 28 }}>Log in to see how your surveys are doing.</p>

      {error && <div className="alert" style={{ marginBottom: 16 }}><AlertTriangle size={17} /> {error}</div>}

      <form onSubmit={handleLogin}>
        <div className="form-group">
          <label className="form-label" htmlFor="email">Email</label>
          <input id="email" type="email" className="form-input" placeholder="you@company.com" value={email} onChange={(e) => setEmail(e.target.value)} required autoComplete="email" />
        </div>
        <div className="form-group">
          <label className="form-label" htmlFor="password">Password</label>
          <input id="password" type="password" className="form-input" placeholder="••••••••" value={password} onChange={(e) => setPassword(e.target.value)} required autoComplete="current-password" />
        </div>
        <button type="submit" className="btn btn-primary btn-block" style={{ marginTop: 8, padding: '12px 18px' }} disabled={loading}>
          {loading ? <Loader2 size={16} className="spin" /> : <>Log in <ArrowRight size={16} /></>}
        </button>
      </form>
      <p style={{ marginTop: 24, fontSize: '0.86rem', textAlign: 'center' }}>
        New to InsightFlow? <Link to="/register" style={{ color: 'var(--accent)', fontWeight: 600 }}>Create an account</Link>
      </p>
    </AuthLayout>
  );
};

export default Login;
