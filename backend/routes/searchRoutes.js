const express = require('express');
const router = express.Router();
const { searchTransactions } = require('../controllers/searchController');
const { protect } = require('../middleware/authMiddleware');

router.use(protect);

router.route('/')
  .get(searchTransactions);

module.exports = router;
