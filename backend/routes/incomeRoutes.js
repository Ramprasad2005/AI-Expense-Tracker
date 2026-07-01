const express = require('express');
const router = express.Router();
const {
  getIncomes,
  getIncomeById,
  createIncome,
  updateIncome,
  deleteIncome
} = require('../controllers/incomeController');
const { protect } = require('../middleware/authMiddleware');

router.use(protect); // Secure all routes

router.route('/')
  .get(getIncomes)
  .post(createIncome);

router.route('/:id')
  .get(getIncomeById)
  .put(updateIncome)
  .delete(deleteIncome);

module.exports = router;
