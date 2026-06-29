const express = require('express');
const { createSurvey, getMySurveys, getSurvey, removeSurvey } = require('../controllers/surveyController');
const { protect } = require('../middlewares/authMiddleware');
const responseRoutes = require('./responseRoutes');

const router = express.Router();

router.use('/:surveyId/responses', responseRoutes);

router.route('/')
  .post(protect, createSurvey)
  .get(protect, getMySurveys);

router.route('/:id')
  .get(protect, getSurvey)
  .delete(protect, removeSurvey);

module.exports = router;
