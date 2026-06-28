const { saveSurvey, getSurveysByCreator, getSurveyById, deleteSurvey } = require('../models/surveyModel');

const createSurvey = async (req, res, next) => {
  try {
    const { title, description, status, questions } = req.body;
    const creatorId = req.user.id;

    if (!title) {
      return res.status(400).json({ message: 'Survey title is required' });
    }

    const surveyId = await saveSurvey(title, description, status || 'draft', creatorId, questions);
    res.status(201).json({ message: 'Survey created successfully', surveyId });
  } catch (error) {
    next(error);
  }
};

const getMySurveys = async (req, res, next) => {
  try {
    const creatorId = req.user.id;
    const surveys = await getSurveysByCreator(creatorId);
    res.json(surveys);
  } catch (error) {
    next(error);
  }
};

const getSurvey = async (req, res, next) => {
  try {
    const { id } = req.params;
    const survey = await getSurveyById(id);
    
    if (!survey) {
      return res.status(404).json({ message: 'Survey not found' });
    }

    res.json(survey);
  } catch (error) {
    next(error);
  }
};

const removeSurvey = async (req, res, next) => {
  try {
    const { id } = req.params;
    await deleteSurvey(id);
    res.json({ message: 'Survey deleted successfully' });
  } catch (error) {
    next(error);
  }
};

module.exports = {
  createSurvey,
  getMySurveys,
  getSurvey,
  removeSurvey
};
