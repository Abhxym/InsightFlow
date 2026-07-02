const pool = require('../config/db');
const { analyzeText } = require('../utils/ai');

const checkDuplicateSubmission = async (surveyId, userId) => {
  const [rows] = await pool.execute(
    'SELECT id FROM survey_responses WHERE survey_id = ? AND user_id = ?',
    [surveyId, userId]
  );
  return rows.length > 0;
};

const saveResponse = async (surveyId, userId, answers) => {
  const connection = await pool.getConnection();
  try {
    await connection.beginTransaction();

    // Fetch questions to know their types
    const [questions] = await connection.execute('SELECT id, question_type FROM questions WHERE survey_id = ?', [surveyId]);
    const questionTypes = {};
    questions.forEach(q => { questionTypes[q.id] = q.question_type; });

    // Create survey response record
    const [surveyRes] = await connection.execute(
      'INSERT INTO survey_responses (survey_id, user_id) VALUES (?, ?)',
      [surveyId, userId]
    );
    const responseId = surveyRes.insertId;

    // Insert individual answers
    for (const ans of answers) {
      let aiInsight = null;
      const qType = questionTypes[ans.question_id];

      // If it's a text question, analyze it using the AI service
      if ((qType === 'short_text' || qType === 'long_text') && typeof ans.answer_data === 'string' && ans.answer_data.trim().length > 0) {
        aiInsight = await analyzeText(ans.answer_data);
      }

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
