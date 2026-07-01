const express = require('express');
const router = express.Router();
const { getSuggestions } = require('../controllers/aiController');
const { protect } = require('../middleware/authMiddleware');

router.use(protect);

router.route('/suggestions')
  .post(getSuggestions);

module.exports = router;
