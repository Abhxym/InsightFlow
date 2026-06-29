const express = require('express');
const { submitSurvey } = require('../controllers/responseController');
const { protect } = require('../middlewares/authMiddleware');

const router = express.Router({ mergeParams: true }); 
// mergeParams allows us to access :surveyId from the parent router

router.route('/')
  .post(protect, submitSurvey);

module.exports = router;
