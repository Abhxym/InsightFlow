import { useState } from 'react';
import { NavLink, Outlet, useNavigate, useLocation } from 'react-router-dom';
import {
  LayoutGrid, PlusSquare, LogOut, Menu, Search, Sparkles, BookOpen, Bell
} from 'lucide-react';
import { BrandMark, initials } from './ui';

const AppLayout = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const user = JSON.parse(localStorage.getItem('user') || '{}');

  const handleLogout = () => {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    navigate('/login');
  };

  const handleSearch = (e) => {
    e.preventDefault();
    navigate(`/dashboard${query ? `?q=${encodeURIComponent(query)}` : ''}`);
  };

  const navClass = ({ isActive }) => `nav-item ${isActive ? 'active' : ''}`;

  return (
    <div className="shell">
      <aside className={`sidebar ${open ? 'open' : ''}`} onClick={() => setOpen(false)}>
        <div className="brand"><BrandMark /> InsightFlow</div>

        <nav className="nav-group">
          <div className="nav-label">Workspace</div>
          <NavLink to="/dashboard" className={navClass}><LayoutGrid size={17} /> Home</NavLink>
          <NavLink to="/surveys/create" className={navClass}><PlusSquare size={17} /> New survey</NavLink>
        </nav>

        <div className="nav-group">
          <div className="nav-label">Help</div>
          <button
            className="nav-item"
            onClick={() => {
              navigate('/dashboard');
              setTimeout(() => document.getElementById('how-it-works')?.scrollIntoView({ behavior: 'smooth' }), 50);
            }}
          >
            <BookOpen size={17} /> How it works
          </button>
          <div className="nav-item" style={{ cursor: 'default' }}>
            <Sparkles size={17} /> AI analyst
            <span className="count">RAG</span>
          </div>
        </div>

        <div className="sidebar-footer">
          <div className="user-chip">
            <span className="avatar">{initials(user.username)}</span>
            <div style={{ minWidth: 0 }}>
              <div style={{ fontWeight: 600, fontSize: '0.86rem', overflow: 'hidden', textOverflow: 'ellipsis' }}>{user.username || 'User'}</div>
              <div className="muted" style={{ fontSize: '0.74rem', overflow: 'hidden', textOverflow: 'ellipsis' }}>{user.email || 'Signed in'}</div>
            </div>
          </div>
          <button className="nav-item" onClick={handleLogout}><LogOut size={17} /> Log out</button>
        </div>
      </aside>

      <div className="main">
        <header className="topbar">
          <button className="icon-btn menu-toggle" aria-label="Open menu" onClick={() => setOpen(o => !o)}>
            <Menu size={17} />
          </button>
          <form className="search" onSubmit={handleSearch}>
            <Search size={15} />
            <input
              placeholder="Search surveys…"
              value={query}
              onChange={e => setQuery(e.target.value)}
              aria-label="Search surveys"
            />
          </form>
          <div className="spacer" />
          {location.pathname !== '/surveys/create' && (
            <button className="btn btn-primary btn-sm" onClick={() => navigate('/surveys/create')}>
              <PlusSquare size={15} /> <span className="btn-label">New survey</span>
            </button>
          )}
          <button className="icon-btn" aria-label="Notifications"><Bell size={16} /></button>
          <span className="avatar" title={user.username}>{initials(user.username)}</span>
        </header>

        <main className="page" key={location.pathname}>
          <Outlet />
        </main>
      </div>
    </div>
  );
};

export default AppLayout;
