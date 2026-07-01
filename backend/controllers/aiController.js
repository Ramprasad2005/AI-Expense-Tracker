const Income = require('../models/Income');
const Expense = require('../models/Expense');
const { generateFinancialSuggestions } = require('../utils/gemini');

// @desc    Get AI advisor suggestions
// @route   POST /api/ai/suggestions
// @access  Private
exports.getSuggestions = async (req, res, next) => {
  try {
    const today = new Date();
    const year = today.getFullYear();
    const month = today.getMonth();

    const startDate = new Date(year, month, 1);
    const endDate = new Date(year, month + 1, 0, 23, 59, 59, 999);

    // 1. Sum up Incomes
    const incomeStats = await Income.aggregate([
      {
        $match: {
          user: req.user._id,
          date: { $gte: startDate, $lte: endDate }
        }
      },
      {
        $group: {
          _id: null,
          total: { $sum: '$amount' }
        }
      }
    ]);

    const totalIncome = incomeStats.length > 0 ? incomeStats[0].total : 0;

    // 2. Sum up Expenses and Group by Category
    const expenseCategoryStats = await Expense.aggregate([
      {
        $match: {
          user: req.user._id,
          date: { $gte: startDate, $lte: endDate }
        }
      },
      {
        $group: {
          _id: '$category',
          amount: { $sum: '$amount' }
        }
      },
      {
        $project: {
          _id: 0,
          category: '$_id',
          amount: 1
        }
      }
    ]);

    const totalExpense = expenseCategoryStats.reduce((sum, item) => sum + item.amount, 0);
    const savings = totalIncome - totalExpense;

    const standardCategories = ['Food', 'Travel', 'Shopping', 'Rent', 'Bills', 'Medical', 'Entertainment', 'Education', 'Others'];
    const categoryBreakdown = standardCategories.map(cat => {
      const match = expenseCategoryStats.find(item => item.category === cat);
      return {
        category: cat,
        amount: match ? match.amount : 0
      };
    });

    const suggestions = await generateFinancialSuggestions({
      totalIncome,
      totalExpense,
      savings,
      categoryBreakdown
    });

    res.json({
      success: true,
      data: suggestions
    });
  } catch (error) {
    next(error);
  }
};
