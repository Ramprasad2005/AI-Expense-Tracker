const Expense = require('../models/Expense');
const Budget = require('../models/Budget');
const Notification = require('../models/Notification');

// Helper to check and create notifications
const checkBudgetAndCreateNotification = async (userId, expenseAmount, expenseDate, expenseCategory) => {
  try {
    const date = new Date(expenseDate);
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const monthStr = `${year}-${month}`;

    // 1. Check if single expense is unusually high (3x user average, with at least 3 total transactions)
    const avgStats = await Expense.aggregate([
      { $match: { user: userId } },
      { $group: { _id: null, avgAmount: { $avg: '$amount' }, count: { $sum: 1 } } }
    ]);

    if (avgStats.length > 0 && avgStats[0].count >= 3) {
      const avg = avgStats[0].avgAmount;
      if (expenseAmount > avg * 3) {
        await Notification.create({
          user: userId,
          message: `Alert: An unusually high expense of $${expenseAmount} was recorded for "${expenseCategory}". (Your average expense is $${avg.toFixed(2)})`,
          type: 'high_expense'
        });
      }
    }

    // 2. Check if total monthly expenses exceed monthly budget
    const budget = await Budget.findOne({ user: userId, month: monthStr });
    if (budget && budget.monthlyBudget > 0) {
      const startOfMonth = new Date(year, date.getMonth(), 1);
      const endOfMonth = new Date(year, date.getMonth() + 1, 0, 23, 59, 59, 999);

      const totalSpentStats = await Expense.aggregate([
        {
          $match: {
            user: userId,
            date: { $gte: startOfMonth, $lte: endOfMonth }
          }
        },
        { $group: { _id: null, total: { $sum: '$amount' } } }
      ]);

      const totalSpent = totalSpentStats.length > 0 ? totalSpentStats[0].total : 0;

      if (totalSpent > budget.monthlyBudget) {
        // Exceeded budget! Check if we already warned them for this specific month
        const alreadyWarned = await Notification.findOne({
          user: userId,
          type: 'budget_exceeded',
          message: { $regex: monthStr }
        });

        if (!alreadyWarned) {
          await Notification.create({
            user: userId,
            message: `Warning: You have exceeded your monthly budget of $${budget.monthlyBudget} for ${monthStr}! Total spent: $${totalSpent.toFixed(2)}.`,
            type: 'budget_exceeded'
          });
        }
      }
    }
  } catch (error) {
    console.error('Error checking notifications:', error);
  }
};

// @desc    Get all expenses for logged in user (with search, filter, sort, paginate)
// @route   GET /api/expenses
// @access  Private
exports.getExpenses = async (req, res, next) => {
  try {
    const { search, category, startDate, endDate, sortBy = 'date', sortOrder = 'desc', page = 1, limit = 10 } = req.query;

    const query = { user: req.user._id };

    // Search query (checks category or description)
    if (search) {
      query.$or = [
        { category: { $regex: search, $options: 'i' } },
        { description: { $regex: search, $options: 'i' } }
      ];
    }

    // Filter by category
    if (category) {
      query.category = category;
    }

    // Filter by date range
    if (startDate || endDate) {
      query.date = {};
      if (startDate) {
        query.date.$gte = new Date(startDate);
      }
      if (endDate) {
        query.date.$lte = new Date(endDate);
      }
    }

    // Sorting
    const sort = {};
    sort[sortBy] = sortOrder === 'asc' ? 1 : -1;

    // Pagination
    const pageNum = parseInt(page, 10);
    const limitNum = parseInt(limit, 10);
    const skip = (pageNum - 1) * limitNum;

    // Execute query
    const expenses = await Expense.find(query)
      .sort(sort)
      .skip(skip)
      .limit(limitNum);

    // Total count for pagination calculations
    const total = await Expense.countDocuments(query);

    res.json({
      success: true,
      count: expenses.length,
      pagination: {
        total,
        page: pageNum,
        limit: limitNum,
        pages: Math.ceil(total / limitNum)
      },
      data: expenses
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Get a single expense
// @route   GET /api/expenses/:id
// @access  Private
exports.getExpenseById = async (req, res, next) => {
  try {
    const expense = await Expense.findOne({ _id: req.params.id, user: req.user._id });
    if (!expense) {
      return res.status(404).json({ success: false, message: 'Expense not found' });
    }
    res.json({ success: true, data: expense });
  } catch (error) {
    next(error);
  }
};

// @desc    Create new expense
// @route   POST /api/expenses
// @access  Private
exports.createExpense = async (req, res, next) => {
  try {
    const { amount, category, date, description } = req.body;

    if (amount === undefined || !category) {
      return res.status(400).json({ success: false, message: 'Please provide amount and category' });
    }

    const expenseDate = date ? new Date(date) : new Date();

    const expense = await Expense.create({
      user: req.user._id,
      amount,
      category,
      date: expenseDate,
      description
    });

    // Check notifications asynchronously
    checkBudgetAndCreateNotification(req.user._id, amount, expenseDate, category);

    res.status(201).json({ success: true, data: expense });
  } catch (error) {
    next(error);
  }
};

// @desc    Update expense
// @route   PUT /api/expenses/:id
// @access  Private
exports.updateExpense = async (req, res, next) => {
  try {
    let expense = await Expense.findOne({ _id: req.params.id, user: req.user._id });
    if (!expense) {
      return res.status(404).json({ success: false, message: 'Expense not found' });
    }

    expense = await Expense.findByIdAndUpdate(
      req.params.id,
      { $set: req.body },
      { new: true, runValidators: true }
    );

    // Check notifications asynchronously
    checkBudgetAndCreateNotification(req.user._id, expense.amount, expense.date, expense.category);

    res.json({ success: true, data: expense });
  } catch (error) {
    next(error);
  }
};

// @desc    Delete expense
// @route   DELETE /api/expenses/:id
// @access  Private
exports.deleteExpense = async (req, res, next) => {
  try {
    const expense = await Expense.findOne({ _id: req.params.id, user: req.user._id });
    if (!expense) {
      return res.status(404).json({ success: false, message: 'Expense not found' });
    }

    await expense.deleteOne();

    res.json({ success: true, message: 'Expense deleted successfully' });
  } catch (error) {
    next(error);
  }
};
