const mongoose = require('mongoose');

const budgetSchema = new mongoose.Schema({
  user: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  monthlyBudget: {
    type: Number,
    required: [true, 'Please specify the monthly budget limit'],
    min: [0, 'Budget limit cannot be negative'],
    default: 0
  },
  month: {
    type: String,
    required: [true, 'Please specify the budget month (format: YYYY-MM)'],
    validate: {
      validator: function(v) {
        return /^\d{4}-\d{2}$/.test(v);
      },
      message: props => `${props.value} is not a valid month format! Use YYYY-MM.`
    }
  }
}, {
  timestamps: true
});

// Compound index to ensure a user only has one budget entry per month
budgetSchema.index({ user: 1, month: 1 }, { unique: true });

module.exports = mongoose.model('Budget', budgetSchema);
