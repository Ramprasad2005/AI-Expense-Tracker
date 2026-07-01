const express = require('express');
const router = express.Router();
const {
  getCurrentBudget,
  setBudget,
  getBudgets
} = require('../controllers/budgetController');
const { protect } = require('../middleware/authMiddleware');

router.use(protect); // Secure all routes

router.route('/')
  .get(getBudgets)
  .post(setBudget);

router.route('/current')
  .get(getCurrentBudget);

module.exports = router;
