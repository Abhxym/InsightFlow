// Rating questions can use a 1–5 or a 0–10 scale (stored as validation_rules.scale).
// Averages, CSAT and the distribution use answers normalised to 0–10;
// NPS is only meaningful on the 0–10 "how likely are you to recommend" scale.

const parseRules = (rules) => {
  if (!rules) return {};
  if (typeof rules === 'string') {
    try { return JSON.parse(rules) || {}; } catch { return {}; }
  }
  return rules;
};

const ratingScale = (question) => (Number(parseRules(question.validation_rules).scale) === 5 ? 5 : 10);

const normaliseRating = (value, scale) => {
  const num = parseFloat(value);
  if (Number.isNaN(num)) return null;
  const max = scale === 5 ? 5 : 10;
  if (num < 0 || num > max) return null;
  return Math.round((num * 10 / max) * 100) / 100;
};

/** Split rating answers into normalised scores and NPS-eligible scores. */
const collectRatings = (answers) => {
  const scores = [];
  const npsScores = [];
  answers.forEach(({ question, value }) => {
    if (question.question_type !== 'rating') return;
    const scale = ratingScale(question);
    const normalised = normaliseRating(value, scale);
    if (normalised === null) return;
    scores.push(normalised);
    if (scale === 10) npsScores.push(parseFloat(value));
  });
  return { scores, npsScores };
};

const computeNps = (npsScores) => {
  if (!npsScores.length) return null;
  const promoters = npsScores.filter(s => s >= 9).length;
  const detractors = npsScores.filter(s => s <= 6).length;
  return Math.round(((promoters - detractors) / npsScores.length) * 100);
};

module.exports = { parseRules, ratingScale, normaliseRating, collectRatings, computeNps };
