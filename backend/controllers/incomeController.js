const Income = require('../models/Income');

// @desc    Get all incomes for logged in user (with search, filter, sort, paginate)
// @route   GET /api/income
// @access  Private
exports.getIncomes = async (req, res, next) => {
  try {
    const { search, source, startDate, endDate, sortBy = 'date', sortOrder = 'desc', page = 1, limit = 10 } = req.query;

    const query = { user: req.user._id };

    // Search query
    if (search) {
      query.$or = [
        { source: { $regex: search, $options: 'i' } },
        { description: { $regex: search, $options: 'i' } }
      ];
    }

    // Filter by source
    if (source) {
      query.source = { $regex: source, $options: 'i' };
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
    const incomes = await Income.find(query)
      .sort(sort)
      .skip(skip)
      .limit(limitNum);

    // Total count for frontend pagination calculations
    const total = await Income.countDocuments(query);

    res.json({
      success: true,
      count: incomes.length,
      pagination: {
        total,
        page: pageNum,
        limit: limitNum,
        pages: Math.ceil(total / limitNum)
      },
      data: incomes
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Get a single income
// @route   GET /api/income/:id
// @access  Private
exports.getIncomeById = async (req, res, next) => {
  try {
    const income = await Income.findOne({ _id: req.params.id, user: req.user._id });
    if (!income) {
      return res.status(404).json({ success: false, message: 'Income not found' });
    }
    res.json({ success: true, data: income });
  } catch (error) {
    next(error);
  }
};

// @desc    Create new income
// @route   POST /api/income
// @access  Private
exports.createIncome = async (req, res, next) => {
  try {
    const { source, amount, date, description } = req.body;

    if (!source || amount === undefined) {
      return res.status(400).json({ success: false, message: 'Please provide source and amount' });
    }

    const income = await Income.create({
      user: req.user._id,
      source,
      amount,
      date: date || new Date(),
      description
    });

    res.status(201).json({ success: true, data: income });
  } catch (error) {
    next(error);
  }
};

// @desc    Update income
// @route   PUT /api/income/:id
// @access  Private
exports.updateIncome = async (req, res, next) => {
  try {
    let income = await Income.findOne({ _id: req.params.id, user: req.user._id });
    if (!income) {
      return res.status(404).json({ success: false, message: 'Income not found' });
    }

    income = await Income.findByIdAndUpdate(
      req.params.id,
      { $set: req.body },
      { new: true, runValidators: true }
    );

    res.json({ success: true, data: income });
  } catch (error) {
    next(error);
  }
};

// @desc    Delete income
// @route   DELETE /api/income/:id
// @access  Private
exports.deleteIncome = async (req, res, next) => {
  try {
    const income = await Income.findOne({ _id: req.params.id, user: req.user._id });
    if (!income) {
      return res.status(404).json({ success: false, message: 'Income not found' });
    }

    await income.deleteOne();

    res.json({ success: true, message: 'Income deleted successfully' });
  } catch (error) {
    next(error);
  }
};
