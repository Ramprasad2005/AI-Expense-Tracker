const mongoose = require('mongoose');

const pendingUserSchema = new mongoose.Schema({
  fullName: {
    type: String,
    trim: true
  },
  username: {
    type: String,
    required: [true, 'Please provide a username'],
    trim: true,
    lowercase: true,
    index: true
  },
  email: {
    type: String,
    required: [true, 'Please provide an email'],
    lowercase: true,
    trim: true,
    index: true
  },
  password: {
    type: String,
    required: [true, 'Please provide a password']
  },
  role: {
    type: String,
    enum: ['user', 'admin'],
    default: 'user'
  },
  otp: {
    type: String,
    required: true
  },
  otpExpiry: {
    type: Date,
    required: true
  },
  verificationAttempts: {
    type: Number,
    default: 0
  },
  lastResendTimestamp: {
    type: Date,
    default: Date.now
  },
  createdAt: {
    type: Date,
    default: Date.now,
    expires: '15m' // Automatic TTL index: auto-deletes document 15 mins after creation
  }
});

module.exports = mongoose.model('PendingUser', pendingUserSchema);
