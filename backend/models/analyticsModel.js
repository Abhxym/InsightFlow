const pool = require('../config/db');

const getSurveyAnalytics = async (surveyId) => {
  // 1. Get Survey metadata
  const [surveyRows] = await pool.execute('SELECT title, description, status FROM surveys WHERE id = ?', [surveyId]);
  if (surveyRows.length === 0) return null;
  const survey = surveyRows[0];

  // 2. Get Questions
  const [questionRows] = await pool.execute('SELECT id, question_text, question_type, options FROM questions WHERE survey_id = ? ORDER BY order_index ASC', [surveyId]);
  
  // 3. Get Responses Data
  const [responseRows] = await pool.execute(`
    SELECT sr.id as response_id, sr.submitted_at, qr.question_id, qr.answer 
    FROM survey_responses sr
    JOIN question_responses qr ON sr.id = qr.response_id
    WHERE sr.survey_id = ?
  `, [surveyId]);

  // Aggregate Data
  const totalResponses = new Set(responseRows.map(r => r.response_id)).size;
  
  // Calculate Avg Rating (assuming rating questions exist)
  let totalRatingScore = 0;
  let ratingCount = 0;
  let promoters = 0;
  let detractors = 0;
  let npsTotal = 0;

  // Chart Data structures
  // { [question_id]: { [option_text]: count } }
  const choiceDistribution = {};
  
  // Line chart: responses per day
  const responsesOverTime = {};

  // Raw data for CSV: 
  // Map of responseId -> { submitted_at, [qId]: answer }
  const rawResponsesMap = {};

  responseRows.forEach(row => {
    const q = questionRows.find(q => q.id === row.question_id);
    if (!q) return;

    // Track for CSV
    if (!rawResponsesMap[row.response_id]) {
      rawResponsesMap[row.response_id] = { submitted_at: row.submitted_at };
    }
    // Try parsing answer JSON if stored as such, else use string
    let parsedAnswer = row.answer;
    try {
        if(typeof row.answer === 'string' && row.answer.startsWith('"')) parsedAnswer = JSON.parse(row.answer);
    } catch(e){}
    rawResponsesMap[row.response_id][row.question_id] = parsedAnswer;

    // Track for timeline
    const dateStr = new Date(row.submitted_at).toISOString().split('T')[0];
    responsesOverTime[dateStr] = (responsesOverTime[dateStr] || new Set()).add(row.response_id);

    // Track choice distributions (bar/pie charts)
    if (['radio', 'checkbox', 'dropdown'].includes(q.question_type)) {
      if (!choiceDistribution[q.id]) choiceDistribution[q.id] = { title: q.question_text, type: q.question_type, data: {} };
      
      const answers = Array.isArray(parsedAnswer) ? parsedAnswer : [parsedAnswer];
      answers.forEach(ans => {
        if(ans) {
          choiceDistribution[q.id].data[ans] = (choiceDistribution[q.id].data[ans] || 0) + 1;
        }
      });
    }

    // Track Ratings
    if (q.question_type === 'rating' || q.question_type === 'number') {
      const num = parseFloat(parsedAnswer);
      if (!isNaN(num)) {
        totalRatingScore += num;
        ratingCount += 1;
        
        // Simple NPS logic if it's a 0-10 scale
        if (num >= 0 && num <= 10) {
            npsTotal++;
            if (num >= 9) promoters++;
            else if (num <= 6) detractors++;
        }
      }
    }
  });

  // Finalize aggregations
  const averageRating = ratingCount > 0 ? (totalRatingScore / ratingCount).toFixed(2) : 0;
  const npsScore = npsTotal > 0 ? Math.round(((promoters - detractors) / npsTotal) * 100) : null;

  // Format charts
  const timelineData = Object.keys(responsesOverTime).sort().map(date => ({
    date,
    count: responsesOverTime[date].size
  }));

  const chartsData = Object.values(choiceDistribution).map(chart => {
    return {
      title: chart.title,
      type: chart.type,
      data: Object.keys(chart.data).map(key => ({ name: key, value: chart.data[key] }))
    };
  });

  const rawResponses = Object.values(rawResponsesMap);

  return {
    survey,
    questions: questionRows,
    kpis: {
      totalResponses,
      averageRating,
      npsScore
    },
    charts: {
      timelineData,
      choiceCharts: chartsData
    },
    rawResponses
  };
};

module.exports = {
  getSurveyAnalytics
};
