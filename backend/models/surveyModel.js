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
  const [rows] = await pool.execute('SELECT * FROM surveys WHERE creator_id = ? ORDER BY created_at DESC', [creatorId]);
  return rows;
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
  getSurveyById,
  deleteSurvey
};
