// Run with: npm test  (Node's built-in test runner, no extra dependencies)
const { test } = require('node:test');
const assert = require('node:assert/strict');
const { ratingScale, normaliseRating, collectRatings, computeNps } = require('../utils/ratings');

const tenPoint = { question_type: 'rating', validation_rules: { scale: 10 } };
const fivePoint = { question_type: 'rating', validation_rules: JSON.stringify({ scale: 5 }) };
const legacy = { question_type: 'rating', validation_rules: null };
const number = { question_type: 'number', validation_rules: null };

test('scale defaults to 0–10 and reads JSON strings', () => {
  assert.equal(ratingScale(tenPoint), 10);
  assert.equal(ratingScale(fivePoint), 5);
  assert.equal(ratingScale(legacy), 10);
});

test('1–5 answers are normalised to a 0–10 scale', () => {
  assert.equal(normaliseRating(5, 5), 10);
  assert.equal(normaliseRating('4', 5), 8);
  assert.equal(normaliseRating(7, 10), 7);
});

test('out-of-range and non-numeric answers are ignored', () => {
  assert.equal(normaliseRating(6, 5), null);
  assert.equal(normaliseRating(-1, 10), null);
  assert.equal(normaliseRating('abc', 10), null);
});

test('only 0–10 rating questions feed NPS; number questions are not ratings', () => {
  const { scores, npsScores } = collectRatings([
    { question: tenPoint, value: 9 },
    { question: fivePoint, value: 2 },
    { question: number, value: 42 }, // e.g. "your age" must not skew ratings
    { question: legacy, value: '3' }
  ]);
  assert.deepEqual(scores, [9, 4, 3]);
  assert.deepEqual(npsScores, [9, 3]);
});

test('a 1–5 survey no longer reads as all detractors', () => {
  const { npsScores } = collectRatings([5, 5, 4].map(value => ({ question: fivePoint, value })));
  assert.equal(computeNps(npsScores), null); // no NPS rather than a misleading -100
});

test('NPS formula', () => {
  assert.equal(computeNps([10, 9, 8, 7, 6, 0]), 0);
  assert.equal(computeNps([10, 10, 6]), 33);
});
