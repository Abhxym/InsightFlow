const pool = require('../config/db');
const { analyzeTexts } = require('../utils/ai');

const checkDuplicateSubmission = async (surveyId, userId) => {
  const [rows] = await pool.execute(
    'SELECT id FROM survey_responses WHERE survey_id = ? AND user_id = ?',
    [surveyId, userId]
  );
  return rows.length > 0;
};

const saveResponse = async (surveyId, userId, answers) => {
  // Fetch questions to know their types
  const [questions] = await pool.execute('SELECT id, question_type FROM questions WHERE survey_id = ?', [surveyId]);
  const questionTypes = {};
  questions.forEach(q => { questionTypes[q.id] = q.question_type; });

  // Analyse every open-ended answer in one AI call, before the transaction starts
  const isText = (ans) => ['short_text', 'long_text'].includes(questionTypes[ans.question_id])
    && typeof ans.answer_data === 'string' && ans.answer_data.trim().length > 0;
  const textAnswers = answers.filter(isText);
  const insights = await analyzeTexts(textAnswers.map(a => a.answer_data));
  const insightFor = new Map(textAnswers.map((a, i) => [a, insights[i]]));

  const connection = await pool.getConnection();
  try {
    await connection.beginTransaction();

    // Create survey response record
    const [surveyRes] = await connection.execute(
      'INSERT INTO survey_responses (survey_id, user_id) VALUES (?, ?)',
      [surveyId, userId]
    );
    const responseId = surveyRes.insertId;

    // Insert individual answers
    for (const ans of answers) {
      const aiInsight = insightFor.get(ans) || null;
      const insightJson = aiInsight ? JSON.stringify(aiInsight) : null;

      await connection.execute(
        'INSERT INTO question_responses (response_id, question_id, answer, ai_insight) VALUES (?, ?, ?, ?)',
        [responseId, ans.question_id, JSON.stringify(ans.answer_data), insightJson]
      );
    }

    await connection.commit();
    return responseId;
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
  }
};

module.exports = {
  checkDuplicateSubmission,
  saveResponse
};
