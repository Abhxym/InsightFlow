import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import api from '../services/axios';

const TakeSurvey = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const [survey, setSurvey] = useState(null);
  const [answers, setAnswers] = useState({});
  const [error, setError] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [success, setSuccess] = useState(false);

  useEffect(() => {
    const fetchSurvey = async () => {
      try {
        const res = await api.get(`/surveys/${id}`);
        setSurvey(res.data);
      } catch (err) {
        setError('Failed to load survey.');
      }
    };
    fetchSurvey();
  }, [id]);

  const handleAnswerChange = (questionId, value) => {
    setAnswers(prev => ({
      ...prev,
      [questionId]: value
    }));
  };

  const evaluateLogic = (question, allAnswers, allQuestions) => {
    if (!question.logic || !question.logic.conditionQuestionIndex) return true; // Always show if no logic

    const targetIdx = parseInt(question.logic.conditionQuestionIndex, 10);
    const targetQ = allQuestions[targetIdx];
    if (!targetQ) return true;

    const targetAnswer = allAnswers[targetQ.id];
    const conditionVal = question.logic.conditionValue;

    // Simple equals check
    return targetAnswer === conditionVal;
  };

  const validateAnswers = (visibleQuestions) => {
    for (const q of visibleQuestions) {
      const val = answers[q.id];

      // Check required
      if (q.is_required && (!val || val.length === 0)) {
        return `Question "${q.question_text}" is required.`;
      }

      // Check validation rules
      if (val && q.validation_rules) {
        if (q.question_type === 'number') {
          const num = parseFloat(val);
          if (q.validation_rules.min && num < parseFloat(q.validation_rules.min)) {
            return `Question "${q.question_text}" must be at least ${q.validation_rules.min}.`;
          }
          if (q.validation_rules.max && num > parseFloat(q.validation_rules.max)) {
            return `Question "${q.question_text}" must be at most ${q.validation_rules.max}.`;
          }
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
      return;
    }

    // Format for backend
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

  if (error && !survey) return <div className="container" style={{ textAlign: 'center', marginTop: '2rem' }}>{error}</div>;
  if (!survey) return <div className="container" style={{ textAlign: 'center', marginTop: '2rem' }}>Loading Survey...</div>;
  if (success) return (
    <div className="container animate-fade-in" style={{ textAlign: 'center', marginTop: '5rem' }}>
      <div className="glass-panel" style={{ padding: '3rem', maxWidth: '600px', margin: '0 auto' }}>
        <h1 style={{ color: '#4ade80' }}>Thank You!</h1>
        <p>Your response has been recorded successfully.</p>
        <button onClick={() => navigate('/dashboard')} className="btn btn-primary" style={{ marginTop: '2rem' }}>Return to Dashboard</button>
      </div>
    </div>
  );

  return (
    <div className="container animate-fade-in" style={{ maxWidth: '800px' }}>
      <div className="glass-panel" style={{ padding: '2rem', marginBottom: '2rem' }}>
        <h1 style={{ margin: 0, marginBottom: '0.5rem' }}>{survey.title}</h1>
        {survey.description && <p>{survey.description}</p>}
      </div>

      {error && <div style={{ background: 'rgba(239, 68, 68, 0.2)', color: 'var(--danger-color)', padding: '1rem', borderRadius: '8px', marginBottom: '1.5rem' }}>{error}</div>}

      <form onSubmit={handleSubmit}>
        {survey.questions.map((q, index) => {
          const isVisible = evaluateLogic(q, answers, survey.questions);
          if (!isVisible) return null;

          return (
            <div key={q.id} className="glass-panel animate-fade-in" style={{ padding: '2rem', marginBottom: '1.5rem' }}>
              <h3 style={{ marginBottom: '1rem' }}>
                {q.question_text} {q.is_required && <span style={{ color: 'var(--danger-color)' }}>*</span>}
              </h3>
              
              {q.question_type === 'short_text' && (
                <input type="text" className="form-input" value={answers[q.id] || ''} onChange={e => handleAnswerChange(q.id, e.target.value)} />
              )}
              
              {q.question_type === 'long_text' && (
                <textarea className="form-input" style={{ minHeight: '100px', resize: 'vertical' }} value={answers[q.id] || ''} onChange={e => handleAnswerChange(q.id, e.target.value)} />
              )}
              
              {q.question_type === 'number' && (
                <input type="number" className="form-input" value={answers[q.id] || ''} onChange={e => handleAnswerChange(q.id, e.target.value)} />
              )}

              {q.question_type === 'email' && (
                <input type="email" className="form-input" value={answers[q.id] || ''} onChange={e => handleAnswerChange(q.id, e.target.value)} />
              )}
              
              {q.question_type === 'date' && (
                <input type="date" className="form-input" value={answers[q.id] || ''} onChange={e => handleAnswerChange(q.id, e.target.value)} />
              )}

              {q.question_type === 'radio' && q.options && q.options.map((opt, i) => (
                <div key={i} style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.5rem' }}>
                  <input type="radio" id={`q-${q.id}-opt-${i}`} name={`q-${q.id}`} value={opt} checked={answers[q.id] === opt} onChange={e => handleAnswerChange(q.id, e.target.value)} />
                  <label htmlFor={`q-${q.id}-opt-${i}`}>{opt}</label>
                </div>
              ))}

              {q.question_type === 'checkbox' && q.options && q.options.map((opt, i) => (
                <div key={i} style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.5rem' }}>
                  <input 
                    type="checkbox" 
                    id={`q-${q.id}-opt-${i}`} 
                    value={opt} 
                    checked={(answers[q.id] || []).includes(opt)} 
                    onChange={e => {
                      const currentAnswers = answers[q.id] || [];
                      if (e.target.checked) {
                        handleAnswerChange(q.id, [...currentAnswers, opt]);
                      } else {
                        handleAnswerChange(q.id, currentAnswers.filter(a => a !== opt));
                      }
                    }} 
                  />
                  <label htmlFor={`q-${q.id}-opt-${i}`}>{opt}</label>
                </div>
              ))}

              {q.question_type === 'dropdown' && q.options && (
                <select className="form-input" value={answers[q.id] || ''} onChange={e => handleAnswerChange(q.id, e.target.value)}>
                  <option value="">Select an option</option>
                  {q.options.map((opt, i) => (
                    <option key={i} value={opt}>{opt}</option>
                  ))}
                </select>
              )}
            </div>
          );
        })}

        <button type="submit" className="btn btn-primary" style={{ width: '100%', padding: '1rem', fontSize: '1.1rem' }} disabled={isSubmitting}>
          {isSubmitting ? 'Submitting...' : 'Submit Survey'}
        </button>
      </form>
    </div>
  );
};

export default TakeSurvey;
