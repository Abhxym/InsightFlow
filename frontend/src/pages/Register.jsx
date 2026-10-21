import { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { ArrowRight, AlertTriangle, Loader2 } from 'lucide-react';
import api from '../services/axios';
import AuthLayout from '../components/AuthLayout';

const Register = () => {
  const [username, setUsername] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  const handleRegister = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    try {
      await api.post('/auth/register', { username, email, password });
      navigate('/login');
    } catch (err) {
      setError(err.response?.data?.message || 'Registration failed');
      setLoading(false);
    }
  };

  return (
    <AuthLayout>
      <h1>Create your account</h1>
      <p style={{ marginBottom: 28 }}>Start building surveys in under a minute.</p>

      {error && <div className="alert" style={{ marginBottom: 16 }}><AlertTriangle size={17} /> {error}</div>}

      <form onSubmit={handleRegister}>
        <div className="form-group">
          <label className="form-label" htmlFor="username">Name</label>
          <input id="username" type="text" className="form-input" placeholder="Your name" value={username} onChange={(e) => setUsername(e.target.value)} required autoComplete="username" />
        </div>
        <div className="form-group">
          <label className="form-label" htmlFor="email">Email</label>
          <input id="email" type="email" className="form-input" placeholder="you@company.com" value={email} onChange={(e) => setEmail(e.target.value)} required autoComplete="email" />
        </div>
        <div className="form-group">
          <label className="form-label" htmlFor="password">Password</label>
          <input id="password" type="password" className="form-input" placeholder="At least 6 characters" value={password} onChange={(e) => setPassword(e.target.value)} required autoComplete="new-password" />
        </div>
        <button type="submit" className="btn btn-primary btn-block" style={{ marginTop: 8, padding: '12px 18px' }} disabled={loading}>
          {loading ? <Loader2 size={16} className="spin" /> : <>Create account <ArrowRight size={16} /></>}
        </button>
      </form>
      <p style={{ marginTop: 24, fontSize: '0.86rem', textAlign: 'center' }}>
        Already have an account? <Link to="/login" style={{ color: 'var(--accent)', fontWeight: 600 }}>Log in</Link>
      </p>
    </AuthLayout>
  );
};

export default Register;
