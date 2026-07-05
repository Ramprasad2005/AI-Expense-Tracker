const mongoose = require('mongoose');

const reportSchema = new mongoose.Schema({
  user: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  type: {
    type: String,
    enum: ['monthly', 'yearly'],
    required: true
  },
  period: {
    type: String,
    required: true // Format: "YYYY-MM" for monthly, "YYYY" for yearly
  },
  totalIncome: {
    type: Number,
    required: true,
    default: 0
  },
  totalExpense: {
    type: Number,
    required: true,
    default: 0
  },
  savings: {
    type: Number,
    required: true,
    default: 0
  },
  categoryBreakdown: [
    {
      category: {
        type: String,
        required: true
      },
      amount: {
        type: Number,
        required: true,
        default: 0
      }
    }
  ],
  aiAdvice: {
    type: String,
    default: ''
  },
  recentTransactions: [
    {
      date: {
        type: Date,
        required: true
      },
      type: {
        type: String,
        enum: ['Income', 'Expense'],
        required: true
      },
      categoryOrSource: {
        type: String,
        required: true
      },
      description: {
        type: String,
        default: ''
      },
      amount: {
        type: Number,
        required: true
      }
    }
  ]
}, {
  timestamps: true
});

reportSchema.index({ user: 1, type: 1, period: 1 }, { unique: true });

module.exports = mongoose.model('Report', reportSchema);
