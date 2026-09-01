const { Parser } = require('json2csv');
const { getSurveyAnalytics } = require('../models/analyticsModel');
const axios = require('axios');

const AI_ENGINE_URL = 'http://localhost:5000/api/analytics/full';

const fetchAnalytics = async (req, res, next) => {
  try {
    const { surveyId } = req.params;
    const data = await getSurveyAnalytics(surveyId);

    if (!data) {
      return res.status(404).json({ message: 'Survey not found' });
    }

    // Collect text responses for AI engine
    const textResponses = [];
    const numericScores = [];
    const timestamps = [];
    const sentimentCounts = { Positive: 0, Negative: 0, Neutral: 0 };

    data.rawResponses.forEach(response => {
      if (response.submitted_at) {
        timestamps.push(new Date(response.submitted_at).toISOString());
      }
    });

    // Extract text answers and numeric answers from question responses
    if (data.rawResponses) {
      data.rawResponses.forEach(response => {
        data.questions.forEach(q => {
          const answer = response[q.id];
          if (!answer) return;

          if (['short_text', 'long_text'].includes(q.question_type) && typeof answer === 'string' && answer.trim()) {
            textResponses.push(answer.trim());
          }
          if (['rating', 'number'].includes(q.question_type)) {
            const num = parseFloat(answer);
            if (!isNaN(num)) numericScores.push(num);
          }
        });
      });
    }

    // Aggregate AI sentiment from stored insights
    if (data.ai && data.ai.sentimentData) {
      data.ai.sentimentData.forEach(s => {
        sentimentCounts[s.name] = s.value;
      });
    }

    // Call the Python AI Engine for full analysis
    let aiEngineResult = null;
    try {
      const aiResponse = await axios.post(AI_ENGINE_URL, {
        survey_title: data.survey.title,
        total_responses: data.kpis.totalResponses,
        text_responses: textResponses,
        numeric_scores: numericScores,
        timestamps: timestamps,
        sentiment_counts: sentimentCounts
      }, { timeout: 30000 });
      aiEngineResult = aiResponse.data;
    } catch (aiError) {
      console.warn('AI Engine unavailable, returning base analytics:', aiError.message);
    }

    res.json({
      ...data,
      aiEngine: aiEngineResult
    });
  } catch (error) {
    next(error);
  }
};

const askData = async (req, res, next) => {
  try {
    const { surveyId } = req.params;
    const { question } = req.body;

    if (!question) return res.status(400).json({ message: 'Question is required' });

    const data = await getSurveyAnalytics(surveyId);
    if (!data) return res.status(404).json({ message: 'Survey not found' });

    // Collect text responses
    const textResponses = [];
    data.rawResponses.forEach(response => {
      data.questions.forEach(q => {
        const answer = response[q.id];
        if (['short_text', 'long_text'].includes(q.question_type) && typeof answer === 'string' && answer.trim()) {
          textResponses.push(answer.trim());
        }
      });
    });

    const aiResponse = await axios.post('http://localhost:5000/api/analytics/ask', {
      question,
      text_responses: textResponses,
      analytics: {
        survey_title: data.survey.title,
        total_responses: data.kpis.totalResponses,
        sentiment: data.ai ? data.ai.sentimentData.reduce((acc, s) => ({ ...acc, [s.name]: s.value }), {}) : {},
        nps: { score: data.kpis.npsScore },
        statistics: { mean: parseFloat(data.kpis.averageRating) },
        themes: [],
        anomalies: {}
      }
    }, { timeout: 15000 });

    res.json(aiResponse.data);
  } catch (error) {
    next(error);
  }
};

const exportCSV = async (req, res, next) => {
  try {
    const { surveyId } = req.params;
    const data = await getSurveyAnalytics(surveyId);

    if (!data) {
      return res.status(404).json({ message: 'Survey not found' });
    }

    const { rawResponses, questions } = data;

    if (rawResponses.length === 0) {
      return res.status(400).json({ message: 'No responses to export' });
    }

    const fields = ['submitted_at'];
    questions.forEach(q => fields.push(q.id.toString()));

    const fieldNames = ['Date Submitted'];
    questions.forEach(q => fieldNames.push(q.question_text));

    const json2csvParser = new Parser({ fields, header: false });
    const csvHeader = fieldNames.map(f => `"${f.replace(/"/g, '""')}"`).join(',') + '\n';
    const csvData = json2csvParser.parse(rawResponses);

    const finalCsv = csvHeader + csvData;

    res.header('Content-Type', 'text/csv');
    res.attachment(`survey_${surveyId}_export.csv`);
    return res.send(finalCsv);
  } catch (error) {
    next(error);
  }
};

module.exports = {
  fetchAnalytics,
  askData,
  exportCSV
};
