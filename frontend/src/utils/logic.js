// Branch logic: decide whether a question is shown, based on earlier answers.
//
// Stored on a question as:
//   { match: 'all' | 'any', conditions: [{ questionIndex, operator, value }] }
// Older surveys stored a single rule { conditionQuestionIndex, conditionValue }
// meaning "equals"; normalizeLogic() upgrades that shape transparently.

export const OPERATORS = [
  { value: 'equals', label: 'is' },
  { value: 'not_equals', label: 'is not' },
  { value: 'contains', label: 'contains' },
  { value: 'greater_than', label: 'is more than' },
  { value: 'less_than', label: 'is less than' },
  { value: 'answered', label: 'is answered' }
];

export const normalizeLogic = (logic) => {
  if (!logic) return null;
  if (typeof logic === 'string') {
    try { logic = JSON.parse(logic); } catch { return null; }
  }
  if (Array.isArray(logic.conditions)) {
    const conditions = logic.conditions.filter(c => c && c.questionIndex !== '' && c.questionIndex !== undefined && c.questionIndex !== null);
    return conditions.length ? { match: logic.match === 'any' ? 'any' : 'all', conditions } : null;
  }
  if (logic.conditionQuestionIndex !== undefined && logic.conditionQuestionIndex !== '' && logic.conditionQuestionIndex !== null) {
    return {
      match: 'all',
      conditions: [{ questionIndex: logic.conditionQuestionIndex, operator: 'equals', value: logic.conditionValue ?? '' }]
    };
  }
  return null;
};

const isEmpty = (v) => v === undefined || v === null || v === '' || (Array.isArray(v) && v.length === 0);
const norm = (v) => String(v ?? '').trim().toLowerCase();

export const evaluateCondition = (answer, operator, value) => {
  switch (operator) {
    case 'answered':
      return !isEmpty(answer);
    case 'not_equals':
      if (Array.isArray(answer)) return !answer.some(a => norm(a) === norm(value));
      return norm(answer) !== norm(value);
    case 'contains':
      if (Array.isArray(answer)) return answer.some(a => norm(a) === norm(value) || norm(a).includes(norm(value)));
      return !isEmpty(answer) && norm(answer).includes(norm(value));
    case 'greater_than':
    case 'less_than': {
      const a = parseFloat(answer);
      const b = parseFloat(value);
      if (Number.isNaN(a) || Number.isNaN(b)) return false;
      return operator === 'greater_than' ? a > b : a < b;
    }
    case 'equals':
    default:
      // A multiple-choice answer "equals" a value when that option was picked
      if (Array.isArray(answer)) return answer.some(a => norm(a) === norm(value));
      return norm(answer) === norm(value);
  }
};

/** answers: { [questionId]: value }; allQuestions: the survey's questions in order */
export const isQuestionVisible = (question, answers, allQuestions) => {
  const logic = normalizeLogic(question.logic);
  if (!logic) return true;

  const results = logic.conditions.map(c => {
    const target = allQuestions[parseInt(c.questionIndex, 10)];
    if (!target) return true; // a rule pointing at a removed question never hides anything
    // If the target question is itself hidden, treat its answer as empty
    const answer = isQuestionVisible(target, answers, allQuestions) ? answers[target.id] : undefined;
    return evaluateCondition(answer, c.operator || 'equals', c.value);
  });

  return logic.match === 'any' ? results.some(Boolean) : results.every(Boolean);
};
