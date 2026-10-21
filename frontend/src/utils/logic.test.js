// Run with: npm test  (Node's built-in test runner, no extra dependencies)
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { normalizeLogic, evaluateCondition, isQuestionVisible } from './logic.js';

const questions = [
  { id: 1, question_type: 'radio', options: ['Yes', 'No'] },
  { id: 2, question_type: 'rating' },
  { id: 3, question_type: 'checkbox', options: ['Price', 'Support'] },
  { id: 4, question_type: 'long_text' }
];

test('no logic means always visible', () => {
  assert.equal(isQuestionVisible({ id: 9 }, {}, questions), true);
});

test('legacy single rule is upgraded to an equals condition', () => {
  assert.deepEqual(normalizeLogic({ conditionQuestionIndex: '0', conditionValue: 'Yes' }), {
    match: 'all',
    conditions: [{ questionIndex: '0', operator: 'equals', value: 'Yes' }]
  });
  const q = { id: 5, logic: { conditionQuestionIndex: '0', conditionValue: 'Yes' } };
  assert.equal(isQuestionVisible(q, { 1: 'Yes' }, questions), true);
  assert.equal(isQuestionVisible(q, { 1: 'No' }, questions), false);
});

test('logic stored as a JSON string is parsed', () => {
  const q = { id: 5, logic: JSON.stringify({ match: 'all', conditions: [{ questionIndex: 0, operator: 'equals', value: 'yes' }] }) };
  assert.equal(isQuestionVisible(q, { 1: 'Yes' }, questions), true); // case-insensitive
});

test('all: every condition must match', () => {
  const q = { id: 5, logic: { match: 'all', conditions: [
    { questionIndex: 0, operator: 'equals', value: 'Yes' },
    { questionIndex: 1, operator: 'less_than', value: '7' }
  ] } };
  assert.equal(isQuestionVisible(q, { 1: 'Yes', 2: 4 }, questions), true);
  assert.equal(isQuestionVisible(q, { 1: 'Yes', 2: 9 }, questions), false);
});

test('any: one matching condition is enough', () => {
  const q = { id: 5, logic: { match: 'any', conditions: [
    { questionIndex: 0, operator: 'equals', value: 'Yes' },
    { questionIndex: 1, operator: 'greater_than', value: '8' }
  ] } };
  assert.equal(isQuestionVisible(q, { 1: 'No', 2: 10 }, questions), true);
  assert.equal(isQuestionVisible(q, { 1: 'No', 2: 3 }, questions), false);
});

test('operators', () => {
  assert.equal(evaluateCondition(['Price', 'Support'], 'contains', 'support'), true);
  assert.equal(evaluateCondition(['Price'], 'equals', 'Price'), true);
  assert.equal(evaluateCondition(['Price'], 'not_equals', 'Support'), true);
  assert.equal(evaluateCondition('Shipping was slow', 'contains', 'slow'), true);
  assert.equal(evaluateCondition('', 'answered'), false);
  assert.equal(evaluateCondition([], 'answered'), false);
  assert.equal(evaluateCondition(0, 'answered'), true); // a rating of 0 is an answer
  assert.equal(evaluateCondition('abc', 'greater_than', '3'), false);
});

test('a hidden question cannot reveal its follow-ups', () => {
  const qs = [
    questions[0],
    { id: 2, question_type: 'radio', logic: { match: 'all', conditions: [{ questionIndex: 0, operator: 'equals', value: 'Yes' }] } },
    { id: 3, question_type: 'text', logic: { match: 'all', conditions: [{ questionIndex: 1, operator: 'answered' }] } }
  ];
  // Q2 was answered earlier, then Q1 changed to "No": Q2 is hidden, so Q3 must hide too
  assert.equal(isQuestionVisible(qs[2], { 1: 'No', 2: 'Something' }, qs), false);
});

test('a rule pointing at a missing question never hides anything', () => {
  const q = { id: 5, logic: { match: 'all', conditions: [{ questionIndex: 42, operator: 'equals', value: 'x' }] } };
  assert.equal(isQuestionVisible(q, {}, questions), true);
});
