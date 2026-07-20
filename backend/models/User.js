const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

const userSchema = new mongoose.Schema({
  fullName: {
    type: String,
    trim: true
  },
  username: {
    type: String,
    required: [true, 'Please provide a username'],
    trim: true,
    unique: true
  },
  email: {
    type: String,
    required: [true, 'Please provide an email'],
    unique: true,
    lowercase: true,
    trim: true,
    index: true
  },
  password: {
    type: String,
    required: [true, 'Please provide a password'],
    minlength: 6,
    select: false
  },
  role: {
    type: String,
    enum: ['user', 'admin'],
    default: 'user'
  },
  tokenVersion: {
    type: Number,
    default: 0
  },
  isVerified: {
    type: Boolean,
    default: false,
    index: true
  },
  emailVerified: {
    type: Boolean,
    default: false,
    index: true
  },
  verificationToken: {
    type: String,
    select: false
  },
  verificationExpires: {
    type: Date,
    select: false
  },
  verificationOTP: {
    type: String,
    select: false
  },
  verificationOTPExpiry: {
    type: Date,
    select: false
  },
  verificationAttempts: {
    type: Number,
    default: 0,
    select: false
  },
  verifiedAt: {
    type: Date
  },
  resetToken: {
    type: String,
    select: false
  },
  resetExpires: {
    type: Date,
    select: false
  },
  lastResendTimestamp: {
    type: Date,
    select: false
  },
  notificationPreferences: {
    type: Map,
    of: Boolean,
    default: {
      expenseAdded: true,
      incomeAdded: true,
      budgetExceeded: true,
      monthlyReportGenerated: true
    }
  }
}, {
  timestamps: true
});

// Pre-save hook to hash password
userSchema.pre('save', async function(next) {
  if (!this.isModified('password')) {
    return next();
  }
  const salt = await bcrypt.genSalt(12);
  this.password = await bcrypt.hash(this.password, salt);
  next();
});

// Method to match entered password
userSchema.methods.matchPassword = async function(enteredPassword) {
  return await bcrypt.compare(enteredPassword, this.password);
};

module.exports = mongoose.model('User', userSchema);
