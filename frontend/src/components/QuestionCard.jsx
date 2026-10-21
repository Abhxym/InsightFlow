import { ChevronUp, ChevronDown, Trash2, Plus, X, GitBranch, SlidersHorizontal, Star } from 'lucide-react';
import { OPERATORS, normalizeLogic } from '../utils/logic';

export const questionTypes = [
  { value: 'short_text', label: 'Short text' },
  { value: 'long_text', label: 'Long text' },
  { value: 'radio', label: 'Single choice' },
  { value: 'checkbox', label: 'Multiple choice' },
  { value: 'dropdown', label: 'Dropdown' },
  { value: 'rating', label: 'Rating' },
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
      validation_rules: type === 'rating' ? { scale: 10 } : null
      // branch logic is kept: it depends on earlier questions, not on this one's type
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

  // ── Branch logic: any number of conditions, combined with all/any ──
  const logic = normalizeLogic(question.logic);
  const setLogic = (next) => updateQuestion(index, { ...question, logic: next && next.conditions.length ? next : null });
  const addCondition = () => setLogic({
    match: logic?.match || 'all',
    conditions: [...(logic?.conditions || []), { questionIndex: String(index - 1), operator: 'equals', value: '' }]
  });
  const updateCondition = (ci, patch) => setLogic({
    ...logic,
    conditions: logic.conditions.map((c, i) => (i === ci ? { ...c, ...patch } : c))
  });
  const removeCondition = (ci) => setLogic({ ...logic, conditions: logic.conditions.filter((_, i) => i !== ci) });

  const prevQuestions = allQuestions.slice(0, index);
  const scale = Number(question.validation_rules?.scale) === 5 ? 5 : 10;

  return (
    <div className="card fade-up" style={{ marginBottom: 14 }}>
      <div className="card-head">
        <div className="row">
          <span className="pill accent">Q{index + 1}</span>
          <span className="muted" style={{ fontSize: '0.8rem' }}>{questionTypes.find(t => t.value === question.question_type)?.label}</span>
          {logic && <span className="pill"><GitBranch size={12} /> conditional</span>}
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

      {question.question_type === 'rating' && (
        <div style={subPanel}>
          <div className="form-label row" style={{ gap: 6 }}><Star size={13} /> Rating scale</div>
          <div className="segmented">
            <button type="button" className={scale === 10 ? 'active' : ''} onClick={() => handleValidationChange('scale', 10)}>0–10 (counts toward NPS)</button>
            <button type="button" className={scale === 5 ? 'active' : ''} onClick={() => handleValidationChange('scale', 5)}>1–5 stars</button>
          </div>
          <p style={{ fontSize: '0.78rem', marginTop: 8 }}>
            Averages are shown out of 10 for both. Only 0–10 questions feed the Net Promoter Score.
          </p>
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
          <div className="row" style={{ justifyContent: 'space-between', flexWrap: 'wrap', gap: 8 }}>
            <div className="form-label row" style={{ gap: 6, marginBottom: 0 }}><GitBranch size={13} /> Show this question</div>
            {logic && logic.conditions.length > 1 && (
              <div className="segmented">
                <button type="button" className={logic.match === 'all' ? 'active' : ''} onClick={() => setLogic({ ...logic, match: 'all' })}>when all match</button>
                <button type="button" className={logic.match === 'any' ? 'active' : ''} onClick={() => setLogic({ ...logic, match: 'any' })}>when any matches</button>
              </div>
            )}
          </div>

          {!logic && <p style={{ fontSize: '0.82rem', marginTop: 6 }}>Always shown.</p>}

          {logic?.conditions.map((c, ci) => {
            const target = allQuestions[parseInt(c.questionIndex, 10)];
            const hasOptions = target && ['radio', 'checkbox', 'dropdown'].includes(target.question_type) && target.options?.length;
            return (
              <div key={ci} className="row wrap" style={{ marginTop: 10, gap: 8 }}>
                <span className="muted" style={{ fontSize: '0.78rem', width: 36 }}>{ci === 0 ? 'If' : logic.match === 'any' ? 'or' : 'and'}</span>
                <select className="form-input" style={{ flex: 2, minWidth: 160 }} value={c.questionIndex} onChange={(e) => updateCondition(ci, { questionIndex: e.target.value, value: '' })}>
                  {prevQuestions.map((pq, pqIdx) => (
                    <option key={pqIdx} value={String(pqIdx)}>Q{pqIdx + 1}: {pq.question_text.substring(0, 28) || 'untitled'}</option>
                  ))}
                </select>
                <select className="form-input" style={{ flex: 1, minWidth: 120 }} value={c.operator || 'equals'} onChange={(e) => updateCondition(ci, { operator: e.target.value })}>
                  {OPERATORS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
                </select>
                {c.operator !== 'answered' && (hasOptions ? (
                  <select className="form-input" style={{ flex: 1, minWidth: 120 }} value={c.value} onChange={(e) => updateCondition(ci, { value: e.target.value })}>
                    <option value="">Choose…</option>
                    {target.options.map(o => <option key={o} value={o}>{o}</option>)}
                  </select>
                ) : (
                  <input type={['rating', 'number'].includes(target?.question_type) ? 'number' : 'text'} className="form-input" style={{ flex: 1, minWidth: 110 }}
                    placeholder="Value" value={c.value} onChange={(e) => updateCondition(ci, { value: e.target.value })} />
                ))}
                <button type="button" className="icon-btn sm" onClick={() => removeCondition(ci)} aria-label="Remove condition"><X size={14} /></button>
              </div>
            );
          })}

          <button type="button" className="btn btn-sm btn-ghost" style={{ marginTop: 10 }} onClick={addCondition}>
            <Plus size={14} /> {logic ? 'Add another condition' : 'Only show this when…'}
          </button>
        </div>
      )}
    </div>
  );
};

export default QuestionCard;
