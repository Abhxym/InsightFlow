import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import QuestionCard from '../components/QuestionCard';
import api from '../services/axios';

const SurveyBuilder = () => {
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [questions, setQuestions] = useState([]);
  const [isPublishing, setIsPublishing] = useState(false);
  const [error, setError] = useState('');
  const navigate = useNavigate();

  const addQuestion = () => {
    setQuestions([
      ...questions,
      {
        question_text: '',
        question_type: 'short_text',
        is_required: false,
        options: null
      }
    ]);
  };

  const updateQuestion = (index, updatedQuestion) => {
    const newQs = [...questions];
    newQs[index] = updatedQuestion;
    setQuestions(newQs);
  };

  const removeQuestion = (index) => {
    const newQs = questions.filter((_, i) => i !== index);
    setQuestions(newQs);
  };

  const moveQuestion = (index, dir) => {
    if (index + dir < 0 || index + dir >= questions.length) return;
    const newQs = [...questions];
    const temp = newQs[index];
    newQs[index] = newQs[index + dir];
    newQs[index + dir] = temp;
    setQuestions(newQs);
  };

  const handleSave = async (status) => {
    if (!title.trim()) {
      setError('Survey title is required.');
      return;
    }
    
    setIsPublishing(true);
    setError('');

    try {
      await api.post('/surveys', {
        title,
        description,
        status,
        questions
      });
      navigate('/dashboard');
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to save survey');
      setIsPublishing(false);
    }
  };

  return (
    <div className="container animate-fade-in" style={{ maxWidth: '800px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2rem' }}>
        <h1 style={{ margin: 0 }}>Survey Builder</h1>
        <div style={{ display: 'flex', gap: '1rem' }}>
          <button 
            onClick={() => navigate('/dashboard')} 
            className="btn" 
            style={{ background: 'rgba(255,255,255,0.1)', color: '#fff' }}
          >
            Cancel
          </button>
          <button 
            onClick={() => handleSave('draft')} 
            className="btn" 
            style={{ background: 'var(--surface-color)', color: 'var(--primary-color)', border: '1px solid var(--primary-color)' }}
            disabled={isPublishing}
          >
            Save Draft
          </button>
          <button 
            onClick={() => handleSave('published')} 
            className="btn btn-primary"
            disabled={isPublishing}
          >
            {isPublishing ? 'Publishing...' : 'Publish Survey'}
          </button>
        </div>
      </div>

      {error && <div style={{ background: 'rgba(239, 68, 68, 0.2)', color: 'var(--danger-color)', padding: '1rem', borderRadius: '8px', marginBottom: '1.5rem' }}>{error}</div>}

      <div className="glass-panel" style={{ padding: '2rem', marginBottom: '2rem' }}>
        <div className="form-group">
          <input 
            type="text" 
            className="form-input" 
            placeholder="Survey Title" 
            style={{ fontSize: '1.5rem', fontWeight: 600, border: 'none', background: 'transparent', padding: '0.5rem 0', borderBottom: '2px solid var(--border-color)', borderRadius: 0 }}
            value={title}
            onChange={(e) => setTitle(e.target.value)}
          />
        </div>
        <div className="form-group" style={{ marginBottom: 0 }}>
          <textarea 
            className="form-input" 
            placeholder="Survey Description (optional)" 
            style={{ border: 'none', background: 'transparent', padding: '0.5rem 0', resize: 'vertical', minHeight: '60px' }}
            value={description}
            onChange={(e) => setDescription(e.target.value)}
          />
        </div>
      </div>

      <div style={{ marginBottom: '2rem' }}>
        {questions.map((q, i) => (
          <QuestionCard 
            key={i} 
            index={i} 
            question={q} 
            updateQuestion={updateQuestion} 
            removeQuestion={removeQuestion}
            moveQuestion={moveQuestion}
          />
        ))}
      </div>

      <button onClick={addQuestion} className="btn glass-panel" style={{ width: '100%', padding: '1rem', color: 'var(--primary-color)', borderStyle: 'dashed' }}>
        + Add Question
      </button>

    </div>
  );
};

export default SurveyBuilder;
