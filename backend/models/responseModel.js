const pool = require('../config/db');

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

    // Create survey response record
    const [surveyRes] = await connection.execute(
      'INSERT INTO survey_responses (survey_id, user_id) VALUES (?, ?)',
      [surveyId, userId]
    );
    const responseId = surveyRes.insertId;

    // Insert individual answers
    // answers is expected to be an array of objects: { question_id, answer_data }
    for (const ans of answers) {
      await connection.execute(
        'INSERT INTO question_responses (response_id, question_id, answer) VALUES (?, ?, ?)',
        [responseId, ans.question_id, JSON.stringify(ans.answer_data)]
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
