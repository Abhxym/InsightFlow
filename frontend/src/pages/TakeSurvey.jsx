import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { CheckCircle2, AlertTriangle, Loader2, Send, ArrowLeft } from 'lucide-react';
import api from '../services/axios';
import { ProgressBar } from '../components/ui';

const choiceStyle = (selected) => ({
  display: 'flex',
  alignItems: 'center',
  gap: 10,
  padding: '12px 14px',
  borderRadius: 12,
  cursor: 'pointer',
  border: `1px solid ${selected ? 'var(--accent)' : 'var(--border-strong)'}`,
  background: selected ? 'var(--accent-soft)' : 'var(--bg-shell)',
  transition: 'all 0.15s',
  fontSize: '0.9rem'
});

const TakeSurvey = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const [survey, setSurvey] = useState(null);
  const [answers, setAnswers] = useState({});
  const [error, setError] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [success, setSuccess] = useState(false);

  useEffect(() => {
    api.get(`/surveys/${id}`)
      .then(res => setSurvey(res.data))
      .catch(() => setError('Failed to load survey.'));
  }, [id]);

  const handleAnswerChange = (questionId, value) => {
    setAnswers(prev => ({ ...prev, [questionId]: value }));
  };

  const evaluateLogic = (question, allAnswers, allQuestions) => {
    if (!question.logic || !question.logic.conditionQuestionIndex) return true; // Always show if no logic

    const targetIdx = parseInt(question.logic.conditionQuestionIndex, 10);
    const targetQ = allQuestions[targetIdx];
    if (!targetQ) return true;

    // Simple equals check (ratings are numbers, so compare as strings)
    return String(allAnswers[targetQ.id] ?? '') === String(question.logic.conditionValue ?? '');
  };

  const validateAnswers = (visibleQuestions) => {
    for (const q of visibleQuestions) {
      const val = answers[q.id];

      if (q.is_required && (val === undefined || val === null || val === '' || val.length === 0)) {
        return `Please answer “${q.question_text}”.`;
      }

      if (val && q.validation_rules && q.question_type === 'number') {
        const num = parseFloat(val);
        if (q.validation_rules.min && num < parseFloat(q.validation_rules.min)) {
          return `“${q.question_text}” must be at least ${q.validation_rules.min}.`;
        }
        if (q.validation_rules.max && num > parseFloat(q.validation_rules.max)) {
          return `“${q.question_text}” must be at most ${q.validation_rules.max}.`;
        }
      }
    }
    return null;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!survey) return;

    setError('');
    const visibleQuestions = survey.questions.filter(q => evaluateLogic(q, answers, survey.questions));

    const validationError = validateAnswers(visibleQuestions);
    if (validationError) {
      setError(validationError);
      window.scrollTo({ top: 0, behavior: 'smooth' });
      return;
    }

    const submissionData = visibleQuestions.map(q => ({
      question_id: q.id,
      answer_data: answers[q.id]
    }));

    setIsSubmitting(true);
    try {
      await api.post(`/surveys/${id}/responses`, { answers: submissionData });
      setSuccess(true);
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to submit survey.');
    } finally {
      setIsSubmitting(false);
    }
  };

  if (error && !survey) return <div className="alert"><AlertTriangle size={17} /> {error}</div>;
  if (!survey) return (
    <div style={{ display: 'grid', placeItems: 'center', minHeight: '50vh' }}>
      <Loader2 size={30} className="spin" color="var(--accent)" />
    </div>
  );

  if (success) return (
    <div className="card fade-up" style={{ maxWidth: 520, margin: '60px auto', textAlign: 'center', padding: 40 }}>
      <CheckCircle2 size={52} color="var(--accent)" style={{ marginBottom: 14 }} />
      <h1>Thank you!</h1>
      <p style={{ marginTop: 8 }}>Your response has been recorded.</p>
      <button onClick={() => navigate('/dashboard')} className="btn btn-primary" style={{ marginTop: 24 }}>Back to dashboard</button>
    </div>
  );

  const visible = survey.questions.filter(q => evaluateLogic(q, answers, survey.questions));
  const answered = visible.filter(q => {
    const v = answers[q.id];
    return v !== undefined && v !== '' && !(Array.isArray(v) && v.length === 0);
  }).length;
  const progress = visible.length ? Math.round((answered / visible.length) * 100) : 0;

  return (
    <div style={{ maxWidth: 760, margin: '0 auto' }}>
      <button className="btn btn-ghost btn-sm" style={{ marginBottom: 12, paddingLeft: 0 }} onClick={() => navigate('/dashboard')}>
        <ArrowLeft size={15} /> Back
      </button>

      <div className="card fade-up" style={{ marginBottom: 14, position: 'sticky', top: 74, zIndex: 5 }}>
        <h1 style={{ fontSize: '1.6rem' }}>{survey.title}</h1>
        {survey.description && <p style={{ marginTop: 6 }}>{survey.description}</p>}
        <div className="row" style={{ marginTop: 16, gap: 14 }}>
          <div style={{ flex: 1 }}><ProgressBar thin value={progress} /></div>
          <span className="muted" style={{ fontSize: '0.8rem', whiteSpace: 'nowrap' }}>{answered} of {visible.length} answered</span>
        </div>
      </div>

      {error && <div className="alert" style={{ marginBottom: 14 }}><AlertTriangle size={17} /> {error}</div>}

      <form onSubmit={handleSubmit}>
        {visible.map((q, index) => (
          <div key={q.id} className="card fade-up" style={{ marginBottom: 14 }}>
            <div className="row" style={{ alignItems: 'flex-start', marginBottom: 14 }}>
              <span className="pill accent">{index + 1}</span>
              <h3 style={{ fontSize: '1.02rem', lineHeight: 1.4 }}>
                {q.question_text} {!!q.is_required && <span style={{ color: 'var(--accent)' }}>*</span>}
              </h3>
            </div>

            {q.question_type === 'short_text' && (
              <input type="text" className="form-input" placeholder="Your answer" value={answers[q.id] || ''} onChange={e => handleAnswerChange(q.id, e.target.value)} />
            )}

            {q.question_type === 'long_text' && (
              <textarea className="form-input" placeholder="Tell us more…" style={{ minHeight: 110, resize: 'vertical' }} value={answers[q.id] || ''} onChange={e => handleAnswerChange(q.id, e.target.value)} />
            )}

            {q.question_type === 'number' && (
              <input type="number" className="form-input" value={answers[q.id] || ''} onChange={e => handleAnswerChange(q.id, e.target.value)} />
            )}

            {q.question_type === 'email' && (
              <input type="email" className="form-input" placeholder="name@example.com" value={answers[q.id] || ''} onChange={e => handleAnswerChange(q.id, e.target.value)} />
            )}

            {q.question_type === 'date' && (
              <input type="date" className="form-input" value={answers[q.id] || ''} onChange={e => handleAnswerChange(q.id, e.target.value)} />
            )}

            {q.question_type === 'rating' && (
              <div>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(11, minmax(0, 1fr))', gap: 6 }}>
                  {Array.from({ length: 11 }, (_, n) => (
                    <button
                      type="button"
                      key={n}
                      onClick={() => handleAnswerChange(q.id, n)}
                      aria-pressed={answers[q.id] === n}
                      style={{
                        ...choiceStyle(answers[q.id] === n),
                        justifyContent: 'center',
                        padding: '12px 0',
                        fontWeight: 700,
                        color: answers[q.id] === n ? '#fff' : 'var(--text-2)',
                        background: answers[q.id] === n ? 'var(--accent)' : 'var(--bg-shell)'
                      }}
                    >
                      {n}
                    </button>
                  ))}
                </div>
                <div className="row muted" style={{ justifyContent: 'space-between', fontSize: '0.76rem', marginTop: 8 }}>
                  <span>Not at all likely</span><span>Extremely likely</span>
                </div>
              </div>
            )}

            {q.question_type === 'radio' && q.options && (
              <div className="stack" style={{ gap: 8 }}>
                {q.options.map((opt, i) => (
                  <label key={i} style={choiceStyle(answers[q.id] === opt)}>
                    <input type="radio" name={`q-${q.id}`} value={opt} checked={answers[q.id] === opt} onChange={e => handleAnswerChange(q.id, e.target.value)} />
                    {opt}
                  </label>
                ))}
              </div>
            )}

            {q.question_type === 'checkbox' && q.options && (
              <div className="stack" style={{ gap: 8 }}>
                {q.options.map((opt, i) => {
                  const current = answers[q.id] || [];
                  return (
                    <label key={i} style={choiceStyle(current.includes(opt))}>
                      <input
                        type="checkbox"
                        value={opt}
                        checked={current.includes(opt)}
                        onChange={e => handleAnswerChange(q.id, e.target.checked ? [...current, opt] : current.filter(a => a !== opt))}
                      />
                      {opt}
                    </label>
                  );
                })}
              </div>
            )}

            {q.question_type === 'dropdown' && q.options && (
              <select className="form-input" value={answers[q.id] || ''} onChange={e => handleAnswerChange(q.id, e.target.value)}>
                <option value="">Select an option</option>
                {q.options.map((opt, i) => <option key={i} value={opt}>{opt}</option>)}
              </select>
            )}
          </div>
        ))}

        <button type="submit" className="btn btn-primary btn-block" style={{ padding: 14, fontSize: '0.95rem' }} disabled={isSubmitting}>
          {isSubmitting ? <><Loader2 size={16} className="spin" /> Submitting…</> : <><Send size={16} /> Submit answers</>}
        </button>
      </form>
    </div>
  );
};

export default TakeSurvey;
