const Budget = require('../models/Budget');
const Expense = require('../models/Expense');

// Helper to calculate total expenses for a user in a specific month
const getMonthlyExpensesSum = async (userId, monthStr) => {
  const [year, month] = monthStr.split('-').map(Number);
  const startOfMonth = new Date(year, month - 1, 1);
  const endOfMonth = new Date(year, month, 0, 23, 59, 59, 999);

  const stats = await Expense.aggregate([
    {
      $match: {
        user: userId,
        date: { $gte: startOfMonth, $lte: endOfMonth }
      }
    },
    { $group: { _id: null, total: { $sum: '$amount' } } }
  ]);

  return stats.length > 0 ? stats[0].total : 0;
};

// @desc    Get or initialize current budget for a specific month
// @route   GET /api/budgets/current
// @access  Private
exports.getCurrentBudget = async (req, res, next) => {
  try {
    const monthStr = req.query.month || new Date().toISOString().slice(0, 7);

    // Validate month format
    if (!/^\d{4}-\d{2}$/.test(monthStr)) {
      return res.status(400).json({ success: false, message: 'Invalid month format. Use YYYY-MM.' });
    }

    let budget = await Budget.findOne({ user: req.user._id, month: monthStr });
    
    const monthlyLimit = budget ? budget.monthlyBudget : 0;
    const totalSpent = await getMonthlyExpensesSum(req.user._id, monthStr);
    const remaining = monthlyLimit - totalSpent;
    const isExceeded = totalSpent > monthlyLimit;

    res.json({
      success: true,
      data: {
        _id: budget ? budget._id : null,
        monthlyBudget: monthlyLimit,
        month: monthStr,
        totalSpent,
        remaining,
        status: monthlyLimit === 0 ? 'no_budget' : (isExceeded ? 'exceeded' : 'within_limit')
      }
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Create or update monthly budget
// @route   POST /api/budgets
// @access  Private
exports.setBudget = async (req, res, next) => {
  try {
    const { monthlyBudget, month } = req.body;

    if (monthlyBudget === undefined || !month) {
      return res.status(400).json({ success: false, message: 'Please provide budget limit and month' });
    }

    if (!/^\d{4}-\d{2}$/.test(month)) {
      return res.status(400).json({ success: false, message: 'Invalid month format. Use YYYY-MM.' });
    }

    // Find and update, or create if not exists
    const budget = await Budget.findOneAndUpdate(
      { user: req.user._id, month },
      { monthlyBudget },
      { new: true, upsert: true, runValidators: true }
    );

    const totalSpent = await getMonthlyExpensesSum(req.user._id, month);
    const remaining = budget.monthlyBudget - totalSpent;
    const isExceeded = totalSpent > budget.monthlyBudget;

    res.status(201).json({
      success: true,
      data: {
        _id: budget._id,
        monthlyBudget: budget.monthlyBudget,
        month: budget.month,
        totalSpent,
        remaining,
        status: isExceeded ? 'exceeded' : 'within_limit'
      }
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Get all budget settings history
// @route   GET /api/budgets
// @access  Private
exports.getBudgets = async (req, res, next) => {
  try {
    const budgets = await Budget.find({ user: req.user._id }).sort({ month: -1 });
    res.json({ success: true, data: budgets });
  } catch (error) {
    next(error);
  }
};
