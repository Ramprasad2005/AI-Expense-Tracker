const Income = require('../models/Income');
const Expense = require('../models/Expense');
const Report = require('../models/Report');
const { generateFinancialReportPDF } = require('../utils/pdfGenerator');

// Helper to calculate date ranges based on type and period string
const getDateRange = (type, period, start, end) => {
  let startDate, endDate;

  if (type === 'monthly') {
    // period format: YYYY-MM
    const [year, month] = period.split('-').map(Number);
    startDate = new Date(year, month - 1, 1);
    endDate = new Date(year, month, 0, 23, 59, 59, 999);
  } else if (type === 'yearly') {
    // period format: YYYY
    const year = Number(period);
    startDate = new Date(year, 0, 1);
    endDate = new Date(year, 11, 31, 23, 59, 59, 999);
  } else {
    // Custom range
    startDate = start ? new Date(start) : new Date();
    endDate = end ? new Date(end) : new Date();
    endDate.setHours(23, 59, 59, 999);
  }

  return { startDate, endDate };
};

// @desc    Generate financial report data and optionally export PDF/CSV
// @route   GET /api/reports
// @access  Private
exports.getReport = async (req, res, next) => {
  try {
    const type = req.query.type || 'monthly'; // 'monthly' | 'yearly' | 'custom'
    const period = req.query.period || new Date().toISOString().slice(0, 7); // YYYY-MM or YYYY
    const startDateParam = req.query.startDate;
    const endDateParam = req.query.endDate;
    const exportPdf = req.query.pdf === 'true';
    const exportCsv = req.query.csv === 'true';
    const isRefresh = req.query.refresh === 'true';

    // Validate type
    if (!['monthly', 'yearly', 'custom'].includes(type)) {
      return res.status(400).json({ success: false, message: 'Invalid report type. Use monthly, yearly, or custom.' });
    }

    // Validate period formats if monthly/yearly
    if (type === 'monthly' && !/^\d{4}-\d{2}$/.test(period)) {
      return res.status(400).json({ success: false, message: 'Invalid monthly period. Use YYYY-MM.' });
    }
    if (type === 'yearly' && !/^\d{4}$/.test(period)) {
      return res.status(400).json({ success: false, message: 'Invalid yearly period. Use YYYY.' });
    }

    const cacheKeyPeriod = type === 'custom' ? `${startDateParam}_${endDateParam}` : period;

    // Check DB cache first if not exporting and not refreshing
    if (!exportPdf && !exportCsv && !isRefresh) {
      const cachedReport = await Report.findOne({ user: req.user._id, type, period: cacheKeyPeriod });
      if (cachedReport) {
        console.log(`[REPORTS CACHE] Serving cached report for ${cacheKeyPeriod}`);
        return res.json({
          success: true,
          fromCache: true,
          data: {
            user: {
              username: req.user.username,
              email: req.user.email
            },
            type,
            period: cacheKeyPeriod,
            totalIncome: cachedReport.totalIncome,
            totalExpense: cachedReport.totalExpense,
            savings: cachedReport.savings,
            categoryBreakdown: cachedReport.categoryBreakdown,
            recentTransactions: cachedReport.recentTransactions || [],
            aiAdvice: cachedReport.aiAdvice || ''
          }
        });
      }
    }

    const { startDate, endDate } = getDateRange(type, period, startDateParam, endDateParam);

    // Parallelize income aggregation, expense aggregation, and raw data fetching
    const [incomeStats, expenseCategoryStats, rawIncomes, rawExpenses] = await Promise.all([
      Income.aggregate([
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
      ]),
      Expense.aggregate([
        {
          $match: {
            user: req.user._id,
            date: { $gte: startDate, $lte: endDate }
          }
        },
        {
          $group: {
            _id: '$category',
            amount: { $sum: '$amount' },
            count: { $sum: 1 }
          }
        },
        {
          $project: {
            _id: 0,
            category: '$_id',
            amount: 1,
            count: 1
          }
        },
        {
          $sort: { amount: -1 }
        }
      ]),
      Income.find({
        user: req.user._id,
        date: { $gte: startDate, $lte: endDate }
      }).lean(),
      Expense.find({
        user: req.user._id,
        date: { $gte: startDate, $lte: endDate }
      }).lean()
    ]);

    const totalIncome = incomeStats.length > 0 ? incomeStats[0].total : 0;
    const totalExpense = expenseCategoryStats.reduce((sum, item) => sum + item.amount, 0);
    const savings = totalIncome - totalExpense;

    // Ensure all standard categories exist in breakdown, even if 0
    const standardCategories = ['Food', 'Travel', 'Shopping', 'Rent', 'Bills', 'Medical', 'Entertainment', 'Education', 'Others'];
    const categoryBreakdown = standardCategories.map(cat => {
      const match = expenseCategoryStats.find(item => item.category === cat);
      return {
        category: cat,
        amount: match ? match.amount : 0,
        count: match ? match.count : 0
      };
    }).sort((a, b) => b.amount - a.amount);

    const recentTransactions = [
      ...rawIncomes.map(item => ({
        date: item.date,
        type: 'Income',
        categoryOrSource: item.source,
        description: item.description || '',
        amount: item.amount
      })),
      ...rawExpenses.map(item => ({
        date: item.date,
        type: 'Expense',
        categoryOrSource: item.category,
        description: item.description || '',
        amount: item.amount
      }))
    ].sort((a, b) => new Date(b.date) - new Date(a.date));

    // Get AI Recommendations
    let aiAdvice = '';
    const existing = await Report.findOne({ user: req.user._id, type, period: cacheKeyPeriod });
    if (existing && existing.aiAdvice && !isRefresh) {
      aiAdvice = existing.aiAdvice;
    } else if (totalIncome > 0 || totalExpense > 0) {
      const { generateFinancialSuggestions } = require('../utils/gemini');
      try {
        aiAdvice = await generateFinancialSuggestions({
          totalIncome,
          totalExpense,
          savings,
          categoryBreakdown
        });
      } catch (err) {
        console.error('[REPORTS] Error generating suggestions for report:', err.message);
      }
    }

    // Save report in Database (upsert)
    await Report.findOneAndUpdate(
      { user: req.user._id, type, period: cacheKeyPeriod },
      {
        totalIncome,
        totalExpense,
        savings,
        categoryBreakdown,
        recentTransactions,
        aiAdvice
      },
      { upsert: true, new: true }
    );

    const reportData = {
      user: {
        username: req.user.username,
        email: req.user.email
      },
      type,
      period: cacheKeyPeriod,
      totalIncome,
      totalExpense,
      savings,
      categoryBreakdown,
      recentTransactions,
      aiAdvice
    };

    if (exportPdf) {
      return await generateFinancialReportPDF(reportData, res);
    }

    if (exportCsv) {
      // Calculate running balance
      let runningBalance = 0;
      const sortedTx = [...recentTransactions].sort((a, b) => new Date(a.date) - new Date(b.date));
      sortedTx.forEach(t => {
        if (t.type === 'Income') {
          runningBalance += t.amount;
        } else {
          runningBalance -= t.amount;
        }
        t.runningBalance = runningBalance;
      });

      const escapeCSV = (val) => {
        if (val === undefined || val === null) return '';
        const str = String(val);
        if (/[",\n\r]/.test(str)) {
          return `"${str.replace(/"/g, '""')}"`;
        }
        return str;
      };

      const getPeriodFilename = (type, period) => {
        if (type === 'monthly' && period) {
          const [year, month] = period.split('-');
          const months = [
            'January', 'February', 'March', 'April', 'May', 'June',
            'July', 'August', 'September', 'October', 'November', 'December'
          ];
          const monthName = months[parseInt(month, 10) - 1] || 'Month';
          return `Financial_Report_${monthName}_${year}`;
        } else if (type === 'yearly' && period) {
          return `Financial_Report_Year_${period}`;
        }
        return 'Financial_Report_Statement';
      };

      let csvContent = 'Date,Type,Category,Description,Amount,Income,Expense,Balance,Report Month\n';
      
      const months = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
      let monthDisplay = period || 'Custom';
      if (type === 'monthly' && period) {
        const [year, month] = period.split('-');
        const monthName = months[parseInt(month, 10) - 1] || 'Month';
        monthDisplay = `${monthName} ${year}`;
      }

      recentTransactions.forEach(t => {
        const dateStr = new Date(t.date).toLocaleDateString();
        const typeStr = t.type;
        const categoryStr = t.categoryOrSource;
        const descStr = t.description || '';
        const amountStr = t.amount.toFixed(2);
        const incomeStr = t.type === 'Income' ? t.amount.toFixed(2) : '';
        const expenseStr = t.type === 'Expense' ? t.amount.toFixed(2) : '';
        const balanceStr = t.runningBalance.toFixed(2);

        csvContent += `${escapeCSV(dateStr)},${escapeCSV(typeStr)},${escapeCSV(categoryStr)},${escapeCSV(descStr)},${amountStr},${incomeStr},${expenseStr},${balanceStr},${escapeCSV(monthDisplay)}\n`;
      });

      const filename = `${getPeriodFilename(type, period)}.csv`;
      res.setHeader('Content-Type', 'text/csv; charset=utf-8');
      res.setHeader('Content-Disposition', `attachment; filename=${filename}`);
      return res.send('\uFEFF' + csvContent);
    }

    res.json({
      success: true,
      data: reportData
    });
  } catch (error) {
    next(error);
  }
};
