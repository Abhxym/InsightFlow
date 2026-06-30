const express = require('express');
const { fetchAnalytics, exportCSV } = require('../controllers/analyticsController');
const { protect } = require('../middlewares/authMiddleware');

const router = express.Router({ mergeParams: true });

router.route('/')
  .get(protect, fetchAnalytics);

router.route('/export')
  .get(protect, exportCSV);

module.exports = router;
