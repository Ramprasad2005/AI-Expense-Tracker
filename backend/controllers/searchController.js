const Income = require('../models/Income');
const Expense = require('../models/Expense');

// @desc    Global search transactions
// @route   GET /api/search
// @access  Private
exports.searchTransactions = async (req, res, next) => {
  try {
    const qRaw = req.query.q;
    const q = typeof qRaw === 'string' ? qRaw.trim() : '';
    const { startDate, endDate, category, minAmount, maxAmount, sortBy = 'date', sortOrder = 'desc' } = req.query;

    const userId = req.user._id;

    // 1. Build Incomes query
    const incomeQuery = { user: userId };
    if (q) {
      incomeQuery.$or = [
        { source: { $regex: q, $options: 'i' } },
        { description: { $regex: q, $options: 'i' } }
      ];
    }
    if (startDate || endDate) {
      incomeQuery.date = {};
      if (startDate) incomeQuery.date.$gte = new Date(startDate);
      if (endDate) incomeQuery.date.$lte = new Date(endDate);
    }
    if (minAmount || maxAmount) {
      incomeQuery.amount = {};
      if (minAmount && !isNaN(parseFloat(minAmount))) incomeQuery.amount.$gte = parseFloat(minAmount);
      if (maxAmount && !isNaN(parseFloat(maxAmount))) incomeQuery.amount.$lte = parseFloat(maxAmount);
    }

    // 2. Build Expenses query
    const expenseQuery = { user: userId };
    if (q) {
      expenseQuery.$or = [
        { category: { $regex: q, $options: 'i' } },
        { description: { $regex: q, $options: 'i' } }
      ];
    }
    if (category) {
      expenseQuery.category = String(category);
    }
    if (startDate || endDate) {
      expenseQuery.date = {};
      if (startDate) expenseQuery.date.$gte = new Date(startDate);
      if (endDate) expenseQuery.date.$lte = new Date(endDate);
    }
    if (minAmount || maxAmount) {
      expenseQuery.amount = {};
      if (minAmount && !isNaN(parseFloat(minAmount))) expenseQuery.amount.$gte = parseFloat(minAmount);
      if (maxAmount && !isNaN(parseFloat(maxAmount))) expenseQuery.amount.$lte = parseFloat(maxAmount);
    }

    // Fetch in parallel
    const [incomes, expenses] = await Promise.all([
      Income.find(incomeQuery).lean(),
      Expense.find(expenseQuery).lean()
    ]);

    // Form unified ledger items
    const formattedIncomes = incomes.map(item => ({
      _id: item._id,
      amount: item.amount,
      date: item.date,
      description: item.description,
      type: 'Income',
      categoryOrSource: item.source
    }));

    const formattedExpenses = expenses.map(item => ({
      _id: item._id,
      amount: item.amount,
      date: item.date,
      description: item.description,
      type: 'Expense',
      categoryOrSource: item.category
    }));

    // Combine results
    let unified = [...formattedIncomes, ...formattedExpenses];

    // Sort by key
    unified.sort((a, b) => {
      let valA = a[sortBy];
      let valB = b[sortBy];

      if (sortBy === 'date') {
        valA = new Date(a.date).getTime();
        valB = new Date(b.date).getTime();
      }

      if (sortOrder === 'desc') {
        return valB > valA ? 1 : -1;
      } else {
        return valA > valB ? 1 : -1;
      }
    });

    // Pagination
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;
    const startIndex = (page - 1) * limit;
    const endIndex = page * limit;
    const paginated = unified.slice(startIndex, endIndex);

    res.json({
      success: true,
      count: unified.length,
      pagination: {
        page,
        limit,
        pages: Math.ceil(unified.length / limit),
        total: unified.length
      },
      data: paginated
    });
  } catch (error) {
    next(error);
  }
};
