// Seeds a demo account with a realistic survey and ~40 responses spread over the last two weeks.
// Text answers are scored by the AI service (/api/analyze/batch) in one call.
// Usage: node scripts/seedDemo.js   (MySQL running; AI service on :5001 optional)
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });
const bcrypt = require('bcrypt');
const pool = require('../config/db');
const { analyzeTexts } = require('../utils/ai');

const DEMO_EMAIL = 'demo@insightflow.test';
const DEMO_PASSWORD = 'demo1234';

const COMMENTS = [
  [9, 'Delivery was super fast and the packaging was great.'],
  [10, 'Love the product quality, best purchase this year.'],
  [3, 'My package arrived two weeks late and nobody told me why.'],
  [2, 'Support agent was rude and closed my ticket without fixing anything.'],
  [8, 'Good value for the price, would buy again.'],
  [4, 'The app keeps crashing when I try to track my order.'],
  [9, 'Customer service was friendly and solved my issue in minutes.'],
  [5, 'Product is okay but a bit expensive compared to others.'],
  [1, 'Item arrived broken and the refund is taking forever.'],
  [10, 'Easy checkout, quick shipping, very happy.'],
  [6, 'Delivery was late again, second time this month.'],
  [7, 'Decent quality, though the instructions were confusing.'],
  [3, 'Never got a reply to my email about a missing item.'],
  [9, 'Great design and it works exactly as described.'],
  [8, 'Shipping was quick, but the box was a little damaged.'],
  [2, 'Way too expensive for what you get.'],
  [10, 'Helpful support team, they went above and beyond.'],
  [6, 'Tracking information was not updated for days.'],
  [9, 'Fast delivery and great price.'],
  [4, 'Quality dropped compared to my last order.']
];
const CHANNELS = ['Website', 'Mobile app', 'In store', 'Phone'];
const LIKES = ['Price', 'Delivery speed', 'Product quality', 'Support', 'Easy returns'];

const pick = (arr) => arr[Math.floor(Math.random() * arr.length)];

async function main() {
  const hash = await bcrypt.hash(DEMO_PASSWORD, 10);
  await pool.execute('INSERT IGNORE INTO users (username, email, password, role_id) VALUES (?, ?, ?, 1)', ['Demo Analyst', DEMO_EMAIL, hash]);
  const [[owner]] = await pool.execute('SELECT id FROM users WHERE email = ?', [DEMO_EMAIL]);

  // Start fresh so the script can be re-run
  await pool.execute('DELETE FROM surveys WHERE creator_id = ?', [owner.id]);

  const [s] = await pool.execute(
    'INSERT INTO surveys (title, description, status, creator_id, created_at) VALUES (?, ?, ?, ?, NOW() - INTERVAL 15 DAY)',
    ['Customer Experience — Q4', 'Tell us how your last order went. Takes 2 minutes.', 'published', owner.id]
  );
  const surveyId = s.insertId;
  await pool.execute('INSERT INTO surveys (title, description, status, creator_id) VALUES (?, ?, ?, ?)',
    ['Employee Pulse — November', 'Quick monthly check-in.', 'draft', owner.id]);

  const questionDefs = [
    ['How likely are you to recommend us to a friend?', 'rating', null, { scale: 10 }],
    ['How would you rate our support? (1–5 stars)', 'rating', null, { scale: 5 }],
    ['How did you place your order?', 'radio', CHANNELS],
    ['What did you like? (pick any)', 'checkbox', LIKES],
    ['Tell us about your experience.', 'long_text', null]
  ];
  const qIds = [];
  for (let i = 0; i < questionDefs.length; i++) {
    const [text, type, options, rules] = questionDefs[i];
    const [q] = await pool.execute(
      'INSERT INTO questions (survey_id, question_text, question_type, options, validation_rules, order_index, is_required) VALUES (?, ?, ?, ?, ?, ?, ?)',
      [surveyId, text, type, options ? JSON.stringify(options) : null, rules ? JSON.stringify(rules) : null, i, i === 0]
    );
    qIds.push(q.insertId);
  }

  // Score every distinct demo comment in one AI call
  const comments = COMMENTS.map(([, c]) => c);
  const insights = await analyzeTexts(comments);
  const insightFor = new Map(comments.map((c, i) => [c, insights[i]]));

  const total = 40;
  for (let n = 0; n < total; n++) {
    const email = `respondent${n}@insightflow.test`;
    await pool.execute('INSERT IGNORE INTO users (username, email, password, role_id) VALUES (?, ?, ?, 2)', [`respondent${n}`, email, hash]);
    const [[u]] = await pool.execute('SELECT id FROM users WHERE email = ?', [email]);

    const daysAgo = Math.floor(Math.pow(Math.random(), 1.4) * 14);
    const [r] = await pool.execute(
      'INSERT INTO survey_responses (survey_id, user_id, submitted_at) VALUES (?, ?, NOW() - INTERVAL ? DAY - INTERVAL ? MINUTE)',
      [surveyId, u.id, daysAgo, Math.floor(Math.random() * 600)]
    );

    const [score, comment] = COMMENTS[n % COMMENTS.length];
    const likes = LIKES.filter(() => Math.random() < 0.35);
    const insight = insightFor.get(comment);
    const stars = Math.max(1, Math.min(5, Math.round(score / 2) + (Math.random() < 0.3 ? 1 : 0)));

    const rows = [
      [qIds[0], score, null],
      [qIds[1], stars, null],
      [qIds[2], pick(CHANNELS), null],
      [qIds[3], likes.length ? likes : [pick(LIKES)], null],
      [qIds[4], comment, insight ? JSON.stringify(insight) : null]
    ];
    for (const [qid, answer, ai] of rows) {
      await pool.execute('INSERT INTO question_responses (response_id, question_id, answer, ai_insight) VALUES (?, ?, ?, ?)',
        [r.insertId, qid, JSON.stringify(answer), ai]);
    }
    process.stdout.write(`\rSeeded ${n + 1}/${total} responses${insight ? '' : ' (AI service offline: no sentiment)'}`);
  }

  console.log(`\nDone. Log in as ${DEMO_EMAIL} / ${DEMO_PASSWORD}`);
  await pool.end();
}

main().catch(err => { console.error(err); process.exit(1); });
