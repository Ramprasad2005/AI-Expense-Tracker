const User = require('../models/User');
const Income = require('../models/Income');
const Expense = require('../models/Expense');
const Budget = require('../models/Budget');
const Notification = require('../models/Notification');
const Report = require('../models/Report');

// @desc    Get all users
// @route   GET /api/admin/users
// @access  Private/Admin
exports.getUsers = async (req, res, next) => {
  try {
    const users = await User.find({}).sort({ createdAt: -1 });
    res.json({ success: true, count: users.length, data: users });
  } catch (error) {
    next(error);
  }
};

// @desc    Delete user and their financial records
// @route   DELETE /api/admin/users/:id
// @access  Private/Admin
exports.deleteUser = async (req, res, next) => {
  try {
    const user = await User.findById(req.params.id);

    if (!user) {
      return res.status(404).json({ success: false, message: 'User not found' });
    }

    if (user.role === 'admin' && req.user._id.toString() === user._id.toString()) {
      return res.status(400).json({ success: false, message: 'Admin cannot delete themselves' });
    }

    const userId = user._id;

    // Delete all records associated with this user
    await Income.deleteMany({ user: userId });
    await Expense.deleteMany({ user: userId });
    await Budget.deleteMany({ user: userId });
    await Notification.deleteMany({ user: userId });
    await Report.deleteMany({ user: userId });

    // Delete user
    await user.deleteOne();

    res.json({ success: true, message: 'User and all associated financial records deleted successfully' });
  } catch (error) {
    next(error);
  }
};

// @desc    Get system-wide metrics and analytics
// @route   GET /api/admin/analytics
// @access  Private/Admin
exports.getSystemAnalytics = async (req, res, next) => {
  try {
    const totalUsers = await User.countDocuments({});
    
    const totalIncomeTransactions = await Income.countDocuments({});
    const totalExpenseTransactions = await Expense.countDocuments({});
    const totalTransactions = totalIncomeTransactions + totalExpenseTransactions;

    const incomeVolumeStats = await Income.aggregate([{ $group: { _id: null, total: { $sum: '$amount' } } }]);
    const expenseVolumeStats = await Expense.aggregate([{ $group: { _id: null, total: { $sum: '$amount' } } }]);

    const totalIncomeVolume = incomeVolumeStats.length > 0 ? incomeVolumeStats[0].total : 0;
    const totalExpenseVolume = expenseVolumeStats.length > 0 ? expenseVolumeStats[0].total : 0;

    // Compile list of users with their counts
    const usersList = await User.find({}).lean();
    const userStats = await Promise.all(usersList.map(async (u) => {
      const incCount = await Income.countDocuments({ user: u._id });
      const expCount = await Expense.countDocuments({ user: u._id });
      return {
        _id: u._id,
        username: u.username,
        email: u.email,
        role: u.role,
        createdAt: u.createdAt,
        incomesCount: incCount,
        expensesCount: expCount,
        totalTransactions: incCount + expCount
      };
    }));

    res.json({
      success: true,
      data: {
        totalUsers,
        totalTransactions,
        totalIncomeVolume,
        totalExpenseVolume,
        userStats
      }
    });
  } catch (error) {
    next(error);
  }
};
