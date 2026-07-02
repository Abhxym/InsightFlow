const axios = require('axios');

const AI_SERVICE_URL = 'http://localhost:5000/api/analyze';

const analyzeText = async (text) => {
  try {
    const response = await axios.post(AI_SERVICE_URL, { text });
    return response.data; // { sentiment, topic, keywords }
  } catch (error) {
    console.error('Error calling AI service:', error.message);
    return null;
  }
};

module.exports = {
  analyzeText
};
