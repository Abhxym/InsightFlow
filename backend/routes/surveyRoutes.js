const express = require('express');
const { createSurvey, getMySurveys, getSurvey, removeSurvey } = require('../controllers/surveyController');
const { protect } = require('../middlewares/authMiddleware');

const router = express.Router();

router.route('/')
  .post(protect, createSurvey)
  .get(protect, getMySurveys);

router.route('/:id')
  .get(protect, getSurvey)
  .delete(protect, removeSurvey);

module.exports = router;
