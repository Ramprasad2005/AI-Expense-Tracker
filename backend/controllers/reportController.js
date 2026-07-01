const Income = require('../models/Income');
const Expense = require('../models/Expense');
const Report = require('../models/Report');
const { generateFinancialReportPDF } = require('../utils/pdfGenerator');

// Helper to calculate date ranges based on type and period string
const getDateRange = (type, period) => {
  let startDate, endDate;

  if (type === 'monthly') {
    // period format: YYYY-MM
    const [year, month] = period.split('-').map(Number);
    startDate = new Date(year, month - 1, 1);
    endDate = new Date(year, month, 0, 23, 59, 59, 999);
  } else {
    // period format: YYYY
    const year = Number(period);
    startDate = new Date(year, 0, 1);
    endDate = new Date(year, 11, 31, 23, 59, 59, 999);
  }

  return { startDate, endDate };
};

// @desc    Generate financial report data and optionally export PDF
// @route   GET /api/reports
// @access  Private
exports.getReport = async (req, res, next) => {
  try {
    const type = req.query.type || 'monthly'; // 'monthly' | 'yearly'
    const period = req.query.period || new Date().toISOString().slice(0, 7); // YYYY-MM or YYYY
    const exportPdf = req.query.pdf === 'true';

    // Validate type
    if (!['monthly', 'yearly'].includes(type)) {
      return res.status(400).json({ success: false, message: 'Invalid report type. Use monthly or yearly.' });
    }

    // Validate period format
    if (type === 'monthly' && !/^\d{4}-\d{2}$/.test(period)) {
      return res.status(400).json({ success: false, message: 'Invalid monthly period. Use YYYY-MM.' });
    }
    if (type === 'yearly' && !/^\d{4}$/.test(period)) {
      return res.status(400).json({ success: false, message: 'Invalid yearly period. Use YYYY.' });
    }

    const { startDate, endDate } = getDateRange(type, period);

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
      },
      {
        $sort: { amount: -1 }
      }
    ]);

    const totalExpense = expenseCategoryStats.reduce((sum, item) => sum + item.amount, 0);
    const savings = totalIncome - totalExpense;

    // Ensure all standard categories exist in breakdown, even if 0
    const standardCategories = ['Food', 'Travel', 'Shopping', 'Rent', 'Bills', 'Medical', 'Entertainment', 'Education', 'Others'];
    const categoryBreakdown = standardCategories.map(cat => {
      const match = expenseCategoryStats.find(item => item.category === cat);
      return {
        category: cat,
        amount: match ? match.amount : 0
      };
    }).sort((a, b) => b.amount - a.amount);

    // 3. Fetch Recent Transactions in this period
    const rawIncomes = await Income.find({
      user: req.user._id,
      date: { $gte: startDate, $lte: endDate }
    }).lean();

    const rawExpenses = await Expense.find({
      user: req.user._id,
      date: { $gte: startDate, $lte: endDate }
    }).lean();

    const recentTransactions = [
      ...rawIncomes.map(item => ({
        date: item.date,
        type: 'Income',
        categoryOrSource: item.source,
        description: item.description,
        amount: item.amount
      })),
      ...rawExpenses.map(item => ({
        date: item.date,
        type: 'Expense',
        categoryOrSource: item.category,
        description: item.description,
        amount: item.amount
      }))
    ].sort((a, b) => new Date(b.date) - new Date(a.date));

    // Save report in Database (upsert)
    await Report.findOneAndUpdate(
      { user: req.user._id, type, period },
      {
        totalIncome,
        totalExpense,
        savings,
        categoryBreakdown
      },
      { upsert: true, new: true }
    );

    const reportData = {
      user: {
        username: req.user.username,
        email: req.user.email
      },
      type,
      period,
      totalIncome,
      totalExpense,
      savings,
      categoryBreakdown,
      recentTransactions
    };

    if (exportPdf) {
      return generateFinancialReportPDF(reportData, res);
    }

    res.json({
      success: true,
      data: reportData
    });
  } catch (error) {
    next(error);
  }
};
