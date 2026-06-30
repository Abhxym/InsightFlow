const { Parser } = require('json2csv');
const { getSurveyAnalytics } = require('../models/analyticsModel');

const fetchAnalytics = async (req, res, next) => {
  try {
    const { surveyId } = req.params;
    const data = await getSurveyAnalytics(surveyId);
    
    if (!data) {
      return res.status(404).json({ message: 'Survey not found' });
    }

    res.json(data);
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

    // Prepare fields for CSV
    // We want Date, and then each Question's Text as a column
    const fields = ['submitted_at'];
    questions.forEach(q => fields.push(q.id.toString()));

    // Map question IDs back to readable text for the header
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
  exportCSV
};
