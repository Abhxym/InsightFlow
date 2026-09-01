import React, { useState, useRef, useEffect } from 'react';
import api from '../services/axios';

const AskYourData = ({ surveyId }) => {
  const [messages, setMessages] = useState([
    {
      role: 'assistant',
      content: "Hi! I'm your **AI Data Analyst**. Ask me anything about this survey's responses.\n\nTry: *\"What are the top complaints?\"*, *\"Why did satisfaction drop?\"*, or *\"Show me negative responses.\"*"
    }
  ]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const bottomRef = useRef(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const handleSend = async () => {
    if (!input.trim() || loading) return;
    const question = input.trim();
    setInput('');
    setMessages(prev => [...prev, { role: 'user', content: question }]);
    setLoading(true);

    try {
      const res = await api.post(`/surveys/${surveyId}/analytics/ask`, { question });
      const { answer, supporting_responses, confidence } = res.data;

      let fullAnswer = answer;
      if (supporting_responses && supporting_responses.length > 0) {
        fullAnswer += '\n\n**Most Relevant Responses:**\n' +
          supporting_responses.map((r, i) => `${i + 1}. *"${r.text}"*`).join('\n');
      }

      setMessages(prev => [...prev, {
        role: 'assistant',
        content: fullAnswer,
        confidence
      }]);
    } catch (err) {
      setMessages(prev => [...prev, {
        role: 'assistant',
        content: '⚠️ Could not connect to AI analyst. Make sure the Python service is running.',
        isError: true
      }]);
    } finally {
      setLoading(false);
    }
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const renderMessage = (content) => {
    // Simple markdown-like rendering
    return content
      .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
      .replace(/\*(.*?)\*/g, '<em>$1</em>')
      .replace(/\n/g, '<br/>');
  };

  const confidenceColor = { high: '#4ade80', medium: '#facc15', low: '#f87171' };

  return (
    <div style={{
      display: 'flex',
      flexDirection: 'column',
      height: '500px',
      background: 'rgba(17, 24, 39, 0.9)',
      border: '1px solid rgba(139, 92, 246, 0.3)',
      borderRadius: '20px',
      overflow: 'hidden'
    }}>
      {/* Header */}
      <div style={{
        padding: '1.25rem 1.5rem',
        borderBottom: '1px solid rgba(255,255,255,0.08)',
        background: 'linear-gradient(135deg, rgba(139,92,246,0.15), rgba(236,72,153,0.15))',
        display: 'flex', alignItems: 'center', gap: '0.75rem'
      }}>
        <div style={{
          width: 36, height: 36, borderRadius: '50%',
          background: 'linear-gradient(135deg, #8b5cf6, #ec4899)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontSize: '1.1rem'
        }}>🤖</div>
        <div>
          <div style={{ fontWeight: 700, fontSize: '1rem' }}>Ask Your Data</div>
          <div style={{ fontSize: '0.8rem', color: '#94a3b8' }}>Powered by RAG + Semantic Search</div>
        </div>
      </div>

      {/* Messages */}
      <div style={{ flex: 1, overflowY: 'auto', padding: '1.25rem', display: 'flex', flexDirection: 'column', gap: '1rem' }}>
        {messages.map((msg, i) => (
          <div key={i} style={{
            display: 'flex',
            justifyContent: msg.role === 'user' ? 'flex-end' : 'flex-start'
          }}>
            <div style={{
              maxWidth: '85%',
              padding: '0.875rem 1.25rem',
              borderRadius: msg.role === 'user' ? '18px 18px 4px 18px' : '18px 18px 18px 4px',
              background: msg.role === 'user'
                ? 'linear-gradient(135deg, #8b5cf6, #ec4899)'
                : msg.isError ? 'rgba(239,68,68,0.1)' : 'rgba(255,255,255,0.05)',
              border: msg.role === 'assistant' ? '1px solid rgba(255,255,255,0.08)' : 'none',
              fontSize: '0.9rem',
              lineHeight: 1.6,
              color: '#f8fafc'
            }}>
              <div dangerouslySetInnerHTML={{ __html: renderMessage(msg.content) }} />
              {msg.confidence && (
                <div style={{ marginTop: '0.5rem', fontSize: '0.75rem', color: confidenceColor[msg.confidence] }}>
                  Confidence: {msg.confidence}
                </div>
              )}
            </div>
          </div>
        ))}
        {loading && (
          <div style={{ display: 'flex', gap: '0.4rem', padding: '0.5rem 1rem' }}>
            {[0, 1, 2].map(i => (
              <div key={i} style={{
                width: 8, height: 8, borderRadius: '50%',
                background: '#8b5cf6',
                animation: `bounce 1.2s ease-in-out ${i * 0.2}s infinite`
              }} />
            ))}
          </div>
        )}
        <div ref={bottomRef} />
      </div>

      {/* Input */}
      <div style={{ padding: '1rem 1.25rem', borderTop: '1px solid rgba(255,255,255,0.08)', display: 'flex', gap: '0.75rem' }}>
        <textarea
          value={input}
          onChange={e => setInput(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="Ask anything about your data..."
          rows={1}
          style={{
            flex: 1,
            padding: '0.75rem 1rem',
            background: 'rgba(255,255,255,0.05)',
            border: '1px solid rgba(255,255,255,0.1)',
            borderRadius: '12px',
            color: '#f8fafc',
            fontSize: '0.9rem',
            resize: 'none',
            fontFamily: 'inherit',
            outline: 'none'
          }}
        />
        <button
          onClick={handleSend}
          disabled={loading || !input.trim()}
          style={{
            padding: '0.75rem 1.25rem',
            background: 'linear-gradient(135deg, #8b5cf6, #ec4899)',
            border: 'none',
            borderRadius: '12px',
            color: '#fff',
            fontWeight: 700,
            cursor: loading || !input.trim() ? 'not-allowed' : 'pointer',
            opacity: loading || !input.trim() ? 0.5 : 1,
            fontSize: '1rem'
          }}
        >
          ↑
        </button>
      </div>

      <style>{`
        @keyframes bounce {
          0%, 80%, 100% { transform: scale(0); }
          40% { transform: scale(1); }
        }
      `}</style>
    </div>
  );
};

export default AskYourData;
