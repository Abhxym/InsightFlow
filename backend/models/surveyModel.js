const pool = require('../config/db');

const saveSurvey = async (title, description, status, creatorId, questions) => {
  const connection = await pool.getConnection();
  try {
    await connection.beginTransaction();

    // Insert Survey
    const [surveyResult] = await connection.execute(
      'INSERT INTO surveys (title, description, status, creator_id) VALUES (?, ?, ?, ?)',
      [title, description, status, creatorId]
    );
    const surveyId = surveyResult.insertId;

    // Insert Questions
    if (questions && questions.length > 0) {
      for (const [index, q] of questions.entries()) {
        const optionsJson = q.options ? JSON.stringify(q.options) : null;
        const logicJson = q.logic ? JSON.stringify(q.logic) : null;
        const validationJson = q.validation_rules ? JSON.stringify(q.validation_rules) : null;
        await connection.execute(
          'INSERT INTO questions (survey_id, question_text, question_type, options, logic, validation_rules, order_index, is_required) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
          [surveyId, q.question_text, q.question_type, optionsJson, logicJson, validationJson, index, q.is_required ? 1 : 0]
        );
      }
    }

    await connection.commit();
    return surveyId;
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
  }
};

const getSurveysByCreator = async (creatorId) => {
  const [rows] = await pool.execute(
    `SELECT s.*,
            (SELECT COUNT(*) FROM questions q WHERE q.survey_id = s.id) AS question_count,
            (SELECT COUNT(*) FROM survey_responses sr WHERE sr.survey_id = s.id) AS response_count,
            (SELECT MAX(sr.submitted_at) FROM survey_responses sr WHERE sr.survey_id = s.id) AS last_response_at
     FROM surveys s WHERE s.creator_id = ? ORDER BY s.created_at DESC`,
    [creatorId]
  );
  return rows;
};

// Cross-survey numbers for the dashboard home page
const getCreatorOverview = async (creatorId) => {
  const [[totals]] = await pool.execute(
    `SELECT COUNT(*) AS surveys,
            COALESCE(SUM(status = 'published'), 0) AS published,
            (SELECT COUNT(*) FROM survey_responses sr JOIN surveys s2 ON s2.id = sr.survey_id WHERE s2.creator_id = ?) AS responses
     FROM surveys WHERE creator_id = ?`,
    [creatorId, creatorId]
  );

  const [daily] = await pool.execute(
    `SELECT DATE_FORMAT(sr.submitted_at, '%Y-%m-%d') AS date, COUNT(*) AS count
     FROM survey_responses sr JOIN surveys s ON s.id = sr.survey_id
     WHERE s.creator_id = ? AND sr.submitted_at >= CURDATE() - INTERVAL 13 DAY
     GROUP BY date ORDER BY date`,
    [creatorId]
  );

  const [sentimentRows] = await pool.execute(
    `SELECT JSON_UNQUOTE(JSON_EXTRACT(qr.ai_insight, '$.sentiment')) AS sentiment, COUNT(*) AS count
     FROM question_responses qr
     JOIN survey_responses sr ON sr.id = qr.response_id
     JOIN surveys s ON s.id = sr.survey_id
     WHERE s.creator_id = ? AND qr.ai_insight IS NOT NULL
     GROUP BY sentiment`,
    [creatorId]
  );

  const [[rating]] = await pool.execute(
    `SELECT AVG(CAST(JSON_UNQUOTE(qr.answer) AS DECIMAL(10,2))) AS avg_rating
     FROM question_responses qr
     JOIN questions q ON q.id = qr.question_id
     JOIN surveys s ON s.id = q.survey_id
     WHERE s.creator_id = ? AND q.question_type = 'rating'`,
    [creatorId]
  );

  // Fill the last 14 days so the chart has no gaps
  const byDate = Object.fromEntries(daily.map(d => [d.date, Number(d.count)]));
  const trend = [];
  for (let i = 13; i >= 0; i--) {
    const d = new Date();
    d.setDate(d.getDate() - i);
    const key = d.toLocaleDateString('en-CA');
    trend.push({ date: key, count: byDate[key] || 0 });
  }

  const sentiment = { Positive: 0, Neutral: 0, Negative: 0 };
  sentimentRows.forEach(r => { if (r.sentiment in sentiment) sentiment[r.sentiment] = Number(r.count); });

  return {
    totals: {
      surveys: Number(totals.surveys),
      published: Number(totals.published),
      responses: Number(totals.responses),
      avgRating: rating.avg_rating !== null ? Number(Number(rating.avg_rating).toFixed(2)) : null
    },
    trend,
    sentiment
  };
};

const getSurveyById = async (surveyId) => {
  const [surveyRows] = await pool.execute('SELECT * FROM surveys WHERE id = ?', [surveyId]);
  if (surveyRows.length === 0) return null;

  const survey = surveyRows[0];
  const [questionRows] = await pool.execute('SELECT * FROM questions WHERE survey_id = ? ORDER BY order_index ASC', [surveyId]);
  
  survey.questions = questionRows;
  return survey;
};

const deleteSurvey = async (surveyId) => {
  await pool.execute('DELETE FROM surveys WHERE id = ?', [surveyId]);
};

module.exports = {
  saveSurvey,
  getSurveysByCreator,
  getCreatorOverview,
  getSurveyById,
  deleteSurvey
};
