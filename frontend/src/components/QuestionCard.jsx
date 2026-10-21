import { ChevronUp, ChevronDown, Trash2, Plus, X, GitBranch, SlidersHorizontal } from 'lucide-react';

export const questionTypes = [
  { value: 'short_text', label: 'Short text' },
  { value: 'long_text', label: 'Long text' },
  { value: 'radio', label: 'Single choice' },
  { value: 'checkbox', label: 'Multiple choice' },
  { value: 'dropdown', label: 'Dropdown' },
  { value: 'rating', label: 'Rating (0–10)' },
  { value: 'number', label: 'Number' },
  { value: 'email', label: 'Email' },
  { value: 'date', label: 'Date' }
];

const subPanel = {
  marginTop: 16,
  padding: 14,
  borderRadius: 14,
  background: 'var(--bg-shell)',
  border: '1px solid var(--border)'
};

const QuestionCard = ({ question, index, updateQuestion, removeQuestion, moveQuestion, allQuestions }) => {

  const handleTypeChange = (e) => {
    const type = e.target.value;
    const isChoiceType = ['radio', 'checkbox', 'dropdown'].includes(type);
    updateQuestion(index, {
      ...question,
      question_type: type,
      options: isChoiceType ? (question.options || ['Option 1']) : null,
      validation_rules: null,
      logic: null
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

  const handleValidationChange = (field, value) => {
    updateQuestion(index, {
      ...question,
      validation_rules: { ...(question.validation_rules || {}), [field]: value }
    });
  };

  const handleLogicChange = (field, value) => {
    // For simplicity, we support one logic rule per question: Show if Q[idx] == value
    updateQuestion(index, {
      ...question,
      logic: { ...(question.logic || { action: 'show' }), [field]: value }
    });
  };

  const prevQuestions = allQuestions.slice(0, index);

  return (
    <div className="card fade-up" style={{ marginBottom: 14 }}>
      <div className="card-head">
        <div className="row">
          <span className="pill accent">Q{index + 1}</span>
          <span className="muted" style={{ fontSize: '0.8rem' }}>{questionTypes.find(t => t.value === question.question_type)?.label}</span>
        </div>
        <div className="row" style={{ gap: 6 }}>
          <button type="button" className="icon-btn sm" onClick={() => moveQuestion(index, -1)} aria-label="Move up"><ChevronUp size={15} /></button>
          <button type="button" className="icon-btn sm" onClick={() => moveQuestion(index, 1)} aria-label="Move down"><ChevronDown size={15} /></button>
          <button type="button" className="icon-btn sm" onClick={() => removeQuestion(index)} aria-label="Delete question" style={{ color: 'var(--negative)' }}><Trash2 size={14} /></button>
        </div>
      </div>

      <input
        type="text"
        className="form-input"
        placeholder="Type your question…"
        style={{ fontSize: '1rem', fontWeight: 600 }}
        value={question.question_text}
        onChange={(e) => updateQuestion(index, { ...question, question_text: e.target.value })}
        required
      />

      <div className="row" style={{ marginTop: 12, gap: 12 }}>
        <select className="form-input" value={question.question_type} onChange={handleTypeChange} style={{ flex: 1 }}>
          {questionTypes.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
        </select>
        <label className="row" style={{ gap: 8, fontSize: '0.84rem', color: 'var(--text-2)', cursor: 'pointer', whiteSpace: 'nowrap' }}>
          <input type="checkbox" checked={!!question.is_required} onChange={(e) => updateQuestion(index, { ...question, is_required: e.target.checked })} />
          Required
        </label>
      </div>

      {['radio', 'checkbox', 'dropdown'].includes(question.question_type) && question.options && (
        <div style={subPanel}>
          <div className="form-label">Answer options</div>
          {question.options.map((opt, optIndex) => (
            <div key={optIndex} className="row" style={{ marginBottom: 8 }}>
              <span className="dot" style={{ background: 'var(--accent)' }} />
              <input type="text" className="form-input" style={{ padding: '8px 12px' }} value={opt} onChange={(e) => handleOptionChange(optIndex, e.target.value)} />
              {question.options.length > 1 && (
                <button type="button" className="icon-btn sm" onClick={() => removeOption(optIndex)} aria-label="Remove option"><X size={14} /></button>
              )}
            </div>
          ))}
          <button type="button" className="btn btn-sm btn-ghost" onClick={addOption}><Plus size={14} /> Add option</button>
        </div>
      )}

      {question.question_type === 'number' && (
        <div style={subPanel}>
          <div className="form-label row" style={{ gap: 6 }}><SlidersHorizontal size={13} /> Allowed range</div>
          <div className="row">
            <input type="number" className="form-input" placeholder="Min" value={question.validation_rules?.min || ''} onChange={(e) => handleValidationChange('min', e.target.value)} />
            <input type="number" className="form-input" placeholder="Max" value={question.validation_rules?.max || ''} onChange={(e) => handleValidationChange('max', e.target.value)} />
          </div>
        </div>
      )}

      {index > 0 && (
        <div style={subPanel}>
          <div className="form-label row" style={{ gap: 6 }}><GitBranch size={13} /> Show this question…</div>
          <div className="row wrap">
            <select className="form-input" style={{ flex: 1, minWidth: 180 }} value={question.logic?.conditionQuestionIndex ?? ''} onChange={(e) => handleLogicChange('conditionQuestionIndex', e.target.value)}>
              <option value="">Always</option>
              {prevQuestions.map((pq, pqIdx) => (
                <option key={pqIdx} value={pqIdx}>Only if Q{pqIdx + 1} ({pq.question_text.substring(0, 24) || 'untitled'}) equals…</option>
              ))}
            </select>
            {question.logic?.conditionQuestionIndex !== undefined && question.logic?.conditionQuestionIndex !== '' && (
              <input type="text" className="form-input" style={{ flex: 1, minWidth: 140 }} placeholder="Value, e.g. Yes" value={question.logic?.conditionValue || ''} onChange={(e) => handleLogicChange('conditionValue', e.target.value)} />
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default QuestionCard;
