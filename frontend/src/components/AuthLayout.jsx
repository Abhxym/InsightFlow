import { MessageSquareText, Sparkles, LineChart } from 'lucide-react';
import { BrandMark } from './ui';

const FEATURES = [
  { icon: LineChart, title: 'Live dashboards', text: 'Ratings, NPS, CSAT and trends update as answers arrive.' },
  { icon: MessageSquareText, title: 'Themes & sentiment', text: 'Open-ended answers grouped by meaning and scored for tone.' },
  { icon: Sparkles, title: 'Ask in plain English', text: 'An AI analyst answers from your data and cites its sources.' }
];

const AuthLayout = ({ children }) => (
  <div className="auth">
    <div className="auth-art">
      <div className="brand" style={{ padding: 0 }}><BrandMark /> InsightFlow</div>

      <div className="fade-up">
        <h1 style={{ fontSize: '2.6rem', lineHeight: 1.1, maxWidth: 460, fontWeight: 600 }}>
          Turn survey answers into <span style={{ color: 'var(--accent)' }}>clear decisions.</span>
        </h1>
        <p style={{ marginTop: 14, maxWidth: 440 }}>
          Build surveys, watch the results come in, and ask questions about them without writing a line of SQL.
        </p>

        <div className="stack" style={{ marginTop: 32, gap: 12, maxWidth: 440 }}>
          {FEATURES.map(f => (
            <div key={f.title} className="list-row" style={{ background: 'rgba(28,28,28,0.7)' }}>
              <span className="brand-mark" style={{ width: 36, height: 36, background: 'var(--accent-soft)', color: 'var(--accent)' }}>
                <f.icon size={17} />
              </span>
              <div>
                <strong style={{ fontSize: '0.9rem' }}>{f.title}</strong>
                <div className="muted" style={{ fontSize: '0.8rem' }}>{f.text}</div>
              </div>
            </div>
          ))}
        </div>
      </div>

      <div className="muted" style={{ fontSize: '0.78rem' }}>React · Node.js · MySQL · FastAPI · Gemini · Pinecone</div>
    </div>

    <div className="auth-form">
      <div className="auth-card fade-up">{children}</div>
    </div>
  </div>
);

export default AuthLayout;
