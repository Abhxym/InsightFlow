import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Type, AlignLeft, CircleDot, CheckSquare, ChevronDownSquare, Star, Hash, AtSign, CalendarDays,
  Save, Rocket, AlertTriangle, ListChecks, CheckCircle2, Circle
} from 'lucide-react';
import QuestionCard, { questionTypes } from '../components/QuestionCard';
import { Empty } from '../components/ui';
import api from '../services/axios';

const TYPE_ICONS = {
  short_text: Type, long_text: AlignLeft, radio: CircleDot, checkbox: CheckSquare,
  dropdown: ChevronDownSquare, rating: Star, number: Hash, email: AtSign, date: CalendarDays
};

const SurveyBuilder = () => {
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [questions, setQuestions] = useState([]);
  const [isPublishing, setIsPublishing] = useState(false);
  const [error, setError] = useState('');
  const navigate = useNavigate();

  const addQuestion = (type = 'short_text') => {
    const isChoiceType = ['radio', 'checkbox', 'dropdown'].includes(type);
    setQuestions([
      ...questions,
      {
        question_text: '',
        question_type: type,
        is_required: false,
        options: isChoiceType ? ['Option 1', 'Option 2'] : null
      }
    ]);
  };

  const updateQuestion = (index, updatedQuestion) => {
    const newQs = [...questions];
    newQs[index] = updatedQuestion;
    setQuestions(newQs);
  };

  const removeQuestion = (index) => {
    setQuestions(questions.filter((_, i) => i !== index));
  };

  const moveQuestion = (index, dir) => {
    if (index + dir < 0 || index + dir >= questions.length) return;
    const newQs = [...questions];
    [newQs[index], newQs[index + dir]] = [newQs[index + dir], newQs[index]];
    setQuestions(newQs);
  };

  const handleSave = async (status) => {
    if (!title.trim()) {
      setError('Give your survey a title first.');
      window.scrollTo({ top: 0, behavior: 'smooth' });
      return;
    }

    setIsPublishing(true);
    setError('');

    try {
      await api.post('/surveys', { title, description, status, questions });
      navigate('/dashboard');
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to save survey');
      setIsPublishing(false);
    }
  };

  const checklist = [
    { done: !!title.trim(), label: 'Add a title' },
    { done: questions.length > 0, label: 'Add at least one question' },
    { done: questions.length > 0 && questions.every(q => q.question_text.trim()), label: 'Write every question' },
    { done: questions.some(q => ['long_text', 'short_text'].includes(q.question_type)), label: 'Include an open question (for AI themes)' },
    { done: questions.some(q => q.question_type === 'rating'), label: 'Include a rating (for NPS)' }
  ];
  const readyCount = checklist.filter(c => c.done).length;

  return (
    <>
      <div className="page-head">
        <div>
          <h1>New survey</h1>
          <p>Add questions on the left. Mix in an open question and a rating to get the most out of the AI insights.</p>
        </div>
        <div className="row wrap">
          <button className="btn btn-ghost" onClick={() => navigate('/dashboard')}>Cancel</button>
          <button className="btn" onClick={() => handleSave('draft')} disabled={isPublishing}><Save size={15} /> Save draft</button>
          <button className="btn btn-primary" onClick={() => handleSave('published')} disabled={isPublishing}>
            <Rocket size={15} /> {isPublishing ? 'Publishing…' : 'Publish'}
          </button>
        </div>
      </div>

      {error && <div className="alert" style={{ marginBottom: 16 }}><AlertTriangle size={17} /> {error}</div>}

      <div className="grid grid-main" style={{ alignItems: 'start' }}>
        <div>
          <div className="card" style={{ marginBottom: 14 }}>
            <input
              type="text"
              className="form-input"
              placeholder="Survey title, e.g. Customer satisfaction — Q4"
              style={{ fontSize: '1.4rem', fontWeight: 600, border: 'none', background: 'transparent', padding: '4px 0', boxShadow: 'none' }}
              value={title}
              onChange={(e) => setTitle(e.target.value)}
            />
            <textarea
              className="form-input"
              placeholder="Short description shown to respondents (optional)"
              style={{ border: 'none', background: 'transparent', padding: '4px 0', resize: 'vertical', minHeight: 50, boxShadow: 'none' }}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
            />
          </div>

          {questions.length === 0 ? (
            <Empty icon={ListChecks} title="No questions yet">Pick a question type on the right to add your first one.</Empty>
          ) : questions.map((q, i) => (
            <QuestionCard
              key={i}
              index={i}
              question={q}
              updateQuestion={updateQuestion}
              removeQuestion={removeQuestion}
              moveQuestion={moveQuestion}
              allQuestions={questions}
            />
          ))}
        </div>

        <div className="stack" style={{ position: 'sticky', top: 84 }}>
          <div className="card">
            <div className="card-title" style={{ marginBottom: 12 }}>Add a question</div>
            <div className="grid" style={{ gridTemplateColumns: 'repeat(3, 1fr)', gap: 8 }}>
              {questionTypes.map(t => {
                const Icon = TYPE_ICONS[t.value];
                return (
                  <button key={t.value} className="list-row" onClick={() => addQuestion(t.value)}
                    style={{ flexDirection: 'column', gap: 6, padding: '12px 6px', cursor: 'pointer', color: 'var(--text-2)', font: 'inherit', fontSize: '0.74rem', textAlign: 'center' }}>
                    <Icon size={17} color="var(--accent)" />
                    {t.label.replace(' (0–10)', '')}
                  </button>
                );
              })}
            </div>
          </div>

          <div className="card">
            <div className="row" style={{ justifyContent: 'space-between', marginBottom: 12 }}>
              <div className="card-title">Ready to publish?</div>
              <span className="pill accent">{readyCount}/{checklist.length}</span>
            </div>
            <div className="bar-track bar-thin" style={{ marginBottom: 14 }}>
              <div className="bar-fill" style={{ width: `${(readyCount / checklist.length) * 100}%` }} />
            </div>
            <div className="stack" style={{ gap: 9 }}>
              {checklist.map(c => (
                <div key={c.label} className="row" style={{ fontSize: '0.84rem', color: c.done ? 'var(--text)' : 'var(--text-3)' }}>
                  {c.done ? <CheckCircle2 size={16} color="var(--accent)" /> : <Circle size={16} />} {c.label}
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </>
  );
};

export default SurveyBuilder;
