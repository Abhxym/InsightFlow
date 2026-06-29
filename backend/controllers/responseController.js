const { checkDuplicateSubmission, saveResponse } = require('../models/responseModel');

const submitSurvey = async (req, res, next) => {
  try {
    const { surveyId } = req.params;
    const { answers } = req.body;
    const userId = req.user.id;

    // Check for duplicate submission
    const hasSubmitted = await checkDuplicateSubmission(surveyId, userId);
    if (hasSubmitted) {
      return res.status(400).json({ message: 'You have already submitted this survey.' });
    }

    // Basic Validation: Ensure answers array is present
    if (!answers || !Array.isArray(answers)) {
      return res.status(400).json({ message: 'Invalid submission data.' });
    }

    const responseId = await saveResponse(surveyId, userId, answers);
    res.status(201).json({ message: 'Survey submitted successfully', responseId });

  } catch (error) {
    next(error);
  }
};

module.exports = { submitSurvey };
