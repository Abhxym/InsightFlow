import { useState, useRef, useEffect } from 'react';
import { Sparkles, ArrowUp, Quote, ShieldCheck } from 'lucide-react';
import api from '../services/axios';
import { renderRichText } from './ui';

const SUGGESTIONS = [
  'What are the top complaints?',
  'What do people like most?',
  'Summarize the overall sentiment',
  'Explain the NPS score',
  'Show me negative responses',
  'What should we fix first?'
];

const CONFIDENCE = {
  high: { label: 'High confidence', className: 'positive' },
  medium: { label: 'Medium confidence', className: 'accent' },
  low: { label: 'Low confidence', className: 'negative' }
};

const AskYourData = ({ surveyId }) => {
  const [messages, setMessages] = useState([
    {
      role: 'assistant',
      content: "Hi! I'm your **AI analyst**. Ask me anything about this survey in plain English — I'll answer from the responses and show you exactly which ones I used."
    }
  ]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const scrollRef = useRef(null);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' });
  }, [messages, loading]);

  const ask = async (text) => {
    const question = (text ?? input).trim();
    if (!question || loading) return;
    setInput('');
    setMessages(prev => [...prev, { role: 'user', content: question }]);
    setLoading(true);

    try {
      const res = await api.post(`/surveys/${surveyId}/analytics/ask`, { question });
      const { answer, supporting_responses, confidence } = res.data;
      setMessages(prev => [...prev, {
        role: 'assistant',
        content: answer,
        sources: supporting_responses || [],
        confidence
      }]);
    } catch {
      setMessages(prev => [...prev, {
        role: 'assistant',
        content: 'I could not reach the AI service. Make sure the Python service is running on port 5001.',
        isError: true
      }]);
    } finally {
      setLoading(false);
    }
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      ask();
    }
  };

  return (
    <div className="grid grid-main" style={{ alignItems: 'start' }}>
      <div className="card" style={{ padding: 0, display: 'flex', flexDirection: 'column', height: 620, overflow: 'hidden' }}>
        <div className="row" style={{ padding: '16px 20px', borderBottom: '1px solid var(--border)' }}>
          <span className="brand-mark" style={{ width: 36, height: 36 }}><Sparkles size={18} /></span>
          <div>
            <div style={{ fontWeight: 700 }}>Ask your data</div>
            <div className="muted" style={{ fontSize: '0.76rem' }}>Answers come only from this survey’s responses</div>
          </div>
          <span className="pill" style={{ marginLeft: 'auto' }}><ShieldCheck size={13} /> Cited answers</span>
        </div>

        <div ref={scrollRef} style={{ flex: 1, overflowY: 'auto', padding: 20, display: 'flex', flexDirection: 'column', gap: 14 }}>
          {messages.map((msg, i) => (
            <div key={i} className="fade-up" style={{ display: 'flex', justifyContent: msg.role === 'user' ? 'flex-end' : 'flex-start' }}>
              <div style={{
                maxWidth: '86%',
                padding: '12px 16px',
                borderRadius: msg.role === 'user' ? '18px 18px 4px 18px' : '18px 18px 18px 4px',
                background: msg.role === 'user' ? 'var(--accent)' : msg.isError ? 'rgba(229,96,79,0.1)' : 'var(--surface-2)',
                border: msg.role === 'user' ? 'none' : '1px solid var(--border)',
                color: msg.role === 'user' ? '#fff' : 'var(--text)',
                fontSize: '0.9rem',
                lineHeight: 1.65
              }}>
                <div className="prose" style={{ color: 'inherit', fontSize: 'inherit' }} dangerouslySetInnerHTML={{ __html: renderRichText(msg.content) }} />

                {msg.sources?.length > 0 && (
                  <div style={{ marginTop: 12, display: 'flex', flexDirection: 'column', gap: 6 }}>
                    <div className="muted" style={{ fontSize: '0.74rem', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.06em' }}>
                      Sources · survey responses
                    </div>
                    {msg.sources.map((s, j) => (
                      <div key={j} className="row" style={{ alignItems: 'flex-start', gap: 8, fontSize: '0.82rem', color: 'var(--text-2)' }}>
                        <span className="pill accent" style={{ padding: '1px 7px' }}>{j + 1}</span>
                        <span style={{ fontStyle: 'italic' }}>“{s.text}”</span>
                      </div>
                    ))}
                  </div>
                )}

                {msg.confidence && CONFIDENCE[msg.confidence] && (
                  <span className={`pill ${CONFIDENCE[msg.confidence].className}`} style={{ marginTop: 10 }}>
                    {CONFIDENCE[msg.confidence].label}
                  </span>
                )}
              </div>
            </div>
          ))}
          {loading && (
            <div className="row" style={{ gap: 6, padding: '8px 4px' }}>
              {[0, 1, 2].map(i => (
                <span key={i} style={{ width: 8, height: 8, borderRadius: '50%', background: 'var(--accent)', animation: `bounce 1.2s ease-in-out ${i * 0.2}s infinite` }} />
              ))}
              <span className="muted" style={{ fontSize: '0.8rem', marginLeft: 6 }}>Reading the responses…</span>
            </div>
          )}
        </div>

        <div className="row" style={{ padding: 14, borderTop: '1px solid var(--border)' }}>
          <textarea
            className="form-input"
            value={input}
            onChange={e => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Ask anything, e.g. “Why are people unhappy with delivery?”"
            rows={1}
            style={{ resize: 'none', borderRadius: 999, padding: '12px 18px' }}
          />
          <button className="icon-btn" style={{ background: 'var(--accent)', borderColor: 'var(--accent)', color: '#fff', width: 44, height: 44 }}
            onClick={() => ask()} disabled={loading || !input.trim()} aria-label="Send question">
            <ArrowUp size={18} />
          </button>
        </div>
      </div>

      <div className="stack">
        <div className="card">
          <div className="card-title" style={{ marginBottom: 12 }}>Try asking</div>
          <div className="stack" style={{ gap: 8 }}>
            {SUGGESTIONS.map(q => (
              <button key={q} className="list-row" style={{ cursor: 'pointer', color: 'var(--text-2)', font: 'inherit', fontSize: '0.86rem', textAlign: 'left', padding: '11px 14px' }}
                onClick={() => ask(q)} disabled={loading}>
                <Quote size={14} color="var(--accent)" /> {q}
              </button>
            ))}
          </div>
        </div>
        <div className="card">
          <div className="card-title" style={{ marginBottom: 8 }}>How answers stay reliable</div>
          <p style={{ fontSize: '0.84rem' }}>
            Your question is matched against every response by meaning (Gemini embeddings + Pinecone).
            The most relevant ones are handed to the AI, which must answer only from them and cite them as [1], [2]…
            If the data can’t answer, it says so.
          </p>
        </div>
      </div>
    </div>
  );
};

export default AskYourData;
