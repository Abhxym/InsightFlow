const axios = require('axios');

const AI_SERVICE_URL = 'http://localhost:5001/api/analyze';

const analyzeText = async (text) => {
  try {
    const response = await axios.post(AI_SERVICE_URL, { text });
    return response.data; // { sentiment, topic, keywords }
  } catch (error) {
    console.error('Error calling AI service:', error.message);
    return null;
  }
};

// All open-ended answers of one submission in a single call (one Gemini request)
const analyzeTexts = async (texts) => {
  if (!texts.length) return [];
  try {
    const response = await axios.post('http://localhost:5001/api/analyze/batch', { texts }, { timeout: 60000 });
    return response.data.results;
  } catch (error) {
    console.error('Error calling AI service:', error.message);
    return texts.map(() => null);
  }
};

// Remove a deleted survey's vectors from the search index (best effort)
const deleteSurveyIndex = async (surveyId) => {
  try {
    await axios.delete(`http://localhost:5001/api/index/${surveyId}`, { timeout: 15000 });
  } catch (error) {
    console.error('Could not clean up search index:', error.message);
  }
};

module.exports = {
  analyzeText,
  analyzeTexts,
  deleteSurveyIndex
};
