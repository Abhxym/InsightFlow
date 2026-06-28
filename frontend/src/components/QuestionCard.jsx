import React from 'react';

const questionTypes = [
  { value: 'short_text', label: 'Short Text' },
  { value: 'long_text', label: 'Long Text' },
  { value: 'radio', label: 'Single Choice (Radio)' },
  { value: 'checkbox', label: 'Multiple Choice (Checkbox)' },
  { value: 'dropdown', label: 'Dropdown' },
  { value: 'rating', label: 'Rating' },
  { value: 'number', label: 'Number' },
  { value: 'email', label: 'Email' },
  { value: 'date', label: 'Date' }
];

const QuestionCard = ({ question, index, updateQuestion, removeQuestion, moveQuestion }) => {
  
  const handleTypeChange = (e) => {
    const type = e.target.value;
    const isChoiceType = ['radio', 'checkbox', 'dropdown'].includes(type);
    updateQuestion(index, { 
      ...question, 
      question_type: type,
      options: isChoiceType ? (question.options || ['Option 1']) : null
    });
  };

  const handleOptionChange = (optIndex, value) => {
    const newOptions = [...question.options];
    newOptions[optIndex] = value;
    updateQuestion(index, { ...question, options: newOptions });
  };

  const addOption = () => {
    updateQuestion(index, { ...question, options: [...question.options, `Option ${question.options.length + 1}`] });
  };

  const removeOption = (optIndex) => {
    const newOptions = question.options.filter((_, i) => i !== optIndex);
    updateQuestion(index, { ...question, options: newOptions });
  };

  return (
    <div className="glass-panel" style={{ padding: '1.5rem', marginBottom: '1.5rem', position: 'relative' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '1rem' }}>
        <h3 style={{ margin: 0 }}>Question {index + 1}</h3>
        <div style={{ display: 'flex', gap: '0.5rem' }}>
          <button type="button" onClick={() => moveQuestion(index, -1)} className="btn" style={{ padding: '0.2rem 0.5rem' }}>↑</button>
          <button type="button" onClick={() => moveQuestion(index, 1)} className="btn" style={{ padding: '0.2rem 0.5rem' }}>↓</button>
          <button type="button" onClick={() => removeQuestion(index)} className="btn" style={{ background: 'rgba(239, 68, 68, 0.2)', color: 'var(--danger-color)', padding: '0.2rem 0.5rem' }}>✕</button>
        </div>
      </div>

      <div className="form-group">
        <input 
          type="text" 
          className="form-input" 
          placeholder="Enter your question" 
          value={question.question_text}
          onChange={(e) => updateQuestion(index, { ...question, question_text: e.target.value })}
          required
        />
      </div>

      <div style={{ display: 'flex', gap: '1rem', alignItems: 'center' }}>
        <div className="form-group" style={{ flex: 1, marginBottom: 0 }}>
          <select 
            className="form-input" 
            value={question.question_type} 
            onChange={handleTypeChange}
          >
            {questionTypes.map(t => (
              <option key={t.value} value={t.value}>{t.label}</option>
            ))}
          </select>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <input 
            type="checkbox" 
            id={`req-${index}`} 
            checked={question.is_required}
            onChange={(e) => updateQuestion(index, { ...question, is_required: e.target.checked })}
          />
          <label htmlFor={`req-${index}`} style={{ fontSize: '0.9rem', color: 'var(--text-muted)' }}>Required</label>
        </div>
      </div>

      {['radio', 'checkbox', 'dropdown'].includes(question.question_type) && question.options && (
        <div style={{ marginTop: '1.5rem', paddingLeft: '1rem', borderLeft: '2px solid var(--border-color)' }}>
          <p style={{ fontSize: '0.9rem', marginBottom: '0.5rem' }}>Options</p>
          {question.options.map((opt, optIndex) => (
            <div key={optIndex} style={{ display: 'flex', gap: '0.5rem', marginBottom: '0.5rem' }}>
              <input 
                type="text" 
                className="form-input" 
                style={{ padding: '0.4rem 0.8rem' }}
                value={opt} 
                onChange={(e) => handleOptionChange(optIndex, e.target.value)}
              />
              {question.options.length > 1 && (
                <button type="button" onClick={() => removeOption(optIndex)} className="btn" style={{ padding: '0.2rem 0.5rem' }}>✕</button>
              )}
            </div>
          ))}
          <button type="button" onClick={addOption} className="btn" style={{ padding: '0.4rem 0.8rem', fontSize: '0.8rem', marginTop: '0.5rem' }}>
            + Add Option
          </button>
        </div>
      )}
    </div>
  );
};

export default QuestionCard;
