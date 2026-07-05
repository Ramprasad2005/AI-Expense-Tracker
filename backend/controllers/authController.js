const User = require('../models/User');
const Income = require('../models/Income');
const Expense = require('../models/Expense');
const Budget = require('../models/Budget');
const Notification = require('../models/Notification');
const jwt = require('jsonwebtoken');
const crypto = require('crypto');
const {
  sendWelcomeEmail,
  sendVerificationEmail,
  sendOtpEmail,
  sendPasswordChangedEmail
} = require('../utils/email');

// Helper to hash OTP code
const hashOtp = (otp) => crypto.createHash('sha256').update(String(otp)).digest('hex');

// Helper to generate JWT token with tokenVersion
const generateToken = (id, tokenVersion = 0) => {
  return jwt.sign({ id, tokenVersion }, process.env.JWT_SECRET, {
    expiresIn: '30d'
  });
};

// @desc    Register a new user
// @route   POST /api/auth/register
// @access  Public
exports.registerUser = async (req, res, next) => {
  try {
    const { username, email, password, role } = req.body;

    if (!username || !email || !password) {
      return res.status(400).json({ success: false, message: 'Please provide all required fields' });
    }

    // Check if user exists
    const userExists = await User.findOne({ $or: [{ email }, { username }] });
    if (userExists) {
      return res.status(400).json({ success: false, message: 'User already exists with this email or username' });
    }

    // Generate 6-digit verification code
    const verificationCode = String(Math.floor(100000 + Math.random() * 900000));
    
    // Create user with isVerified: false and save hashed verification code
    const user = await User.create({
      username,
      email,
      password,
      role: role || 'user',
      tokenVersion: 0,
      isVerified: false,
      verificationOtp: hashOtp(verificationCode),
      verificationOtpExpire: Date.now() + 24 * 60 * 60 * 1000 // 24 hours
    });

    if (user) {
      console.log(`[AUTH] User registered: ${user.username} (Unverified). Verification OTP: ${verificationCode}`);
      
      // Send verification email
      sendVerificationEmail(user.email, user.username, verificationCode)
        .catch(err => console.error('Verification email error:', err.message));

      res.status(201).json({
        success: true,
        message: 'Registration successful. A verification OTP code has been dispatched to your email.'
      });
    } else {
      res.status(400).json({ success: false, message: 'Invalid user data' });
    }
  } catch (error) {
    next(error);
  }
};

// @desc    Auth user & get token
// @route   POST /api/auth/login
// @access  Public
exports.loginUser = async (req, res, next) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({ success: false, message: 'Please provide email and password' });
    }

    // Find user and explicitly select password
    const user = await User.findOne({ email }).select('+password');
    if (!user) {
      return res.status(401).json({ success: false, message: 'Invalid email or password' });
    }

    const isMatch = await user.matchPassword(password);
    if (!isMatch) {
      return res.status(401).json({ success: false, message: 'Invalid email or password' });
    }

    // Block unverified logins
    if (!user.isVerified) {
      return res.status(401).json({ success: false, message: 'Your email address is not verified. Please verify your account.' });
    }

    // Log a notification of login if desired (optional)
    await Notification.create({
      user: user._id,
      message: `Login successful from active device at ${new Date().toLocaleTimeString()}`,
      type: 'month_end' // generic notification type
    });

    res.json({
      success: true,
      data: {
        _id: user._id,
        username: user.username,
        email: user.email,
        role: user.role,
        notificationPreferences: user.notificationPreferences,
        token: generateToken(user._id, user.tokenVersion)
      }
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Get user profile
// @route   GET /api/auth/profile
// @access  Private
exports.getUserProfile = async (req, res, next) => {
  try {
    const user = await User.findById(req.user._id);
    if (user) {
      res.json({
        success: true,
        data: {
          _id: user._id,
          username: user.username,
          email: user.email,
          role: user.role,
          notificationPreferences: user.notificationPreferences
        }
      });
    } else {
      res.status(404).json({ success: false, message: 'User not found' });
    }
  } catch (error) {
    next(error);
  }
};

// @desc    Update user profile
// @route   PUT /api/auth/profile
// @access  Private
exports.updateUserProfile = async (req, res, next) => {
  try {
    const user = await User.findById(req.user._id);

    if (user) {
      const { username, email } = req.body;

      if (username && username !== user.username) {
        const usernameExists = await User.findOne({ username });
        if (usernameExists) {
          return res.status(400).json({ success: false, message: 'Username is already taken' });
        }
        user.username = username;
      }

      if (email && email !== user.email) {
        const emailExists = await User.findOne({ email });
        if (emailExists) {
          return res.status(400).json({ success: false, message: 'Email is already taken' });
        }
        user.email = email;
      }

      const updatedUser = await user.save();

      res.json({
        success: true,
        data: {
          _id: updatedUser._id,
          username: updatedUser.username,
          email: updatedUser.email,
          role: updatedUser.role,
          notificationPreferences: updatedUser.notificationPreferences,
          token: generateToken(updatedUser._id, updatedUser.tokenVersion)
        }
      });
    } else {
      res.status(404).json({ success: false, message: 'User not found' });
    }
  } catch (error) {
    next(error);
  }
};

// @desc    Change password
// @route   PUT /api/auth/password
// @access  Private
exports.changePassword = async (req, res, next) => {
  try {
    const { oldPassword, newPassword } = req.body;

    if (!oldPassword || !newPassword) {
      return res.status(400).json({ success: false, message: 'Please provide old and new passwords' });
    }

    if (newPassword.length < 6) {
      return res.status(400).json({ success: false, message: 'New password must be at least 6 characters long' });
    }

    const user = await User.findById(req.user._id).select('+password');
    if (!user) {
      return res.status(404).json({ success: false, message: 'User not found' });
    }

    const isMatch = await user.matchPassword(oldPassword);
    if (!isMatch) {
      return res.status(400).json({ success: false, message: 'Incorrect current password' });
    }

    user.password = newPassword;
    // Log out other devices on password change for security
    user.tokenVersion = (user.tokenVersion || 0) + 1;
    await user.save();

    // Trigger Notification
    await Notification.create({
      user: user._id,
      message: 'Your account password was updated successfully.',
      type: 'month_end'
    });

    sendPasswordChangedEmail(user.email, user.username).catch(err => console.error('Password reset email error:', err.message));

    res.json({
      success: true,
      message: 'Password updated successfully',
      token: generateToken(user._id, user.tokenVersion)
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Update notification preferences
// @route   PUT /api/auth/preferences
// @access  Private
exports.updateNotificationPreferences = async (req, res, next) => {
  try {
    const user = await User.findById(req.user._id);
    if (!user) {
      return res.status(404).json({ success: false, message: 'User not found' });
    }

    if (req.body.preferences) {
      user.notificationPreferences = req.body.preferences;
      await user.save();
    }

    res.json({
      success: true,
      data: user.notificationPreferences
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Logout from all devices
// @route   POST /api/auth/logout-all
// @access  Private
exports.logoutAllDevices = async (req, res, next) => {
  try {
    const user = await User.findById(req.user._id);
    if (!user) {
      return res.status(404).json({ success: false, message: 'User not found' });
    }

    user.tokenVersion = (user.tokenVersion || 0) + 1;
    await user.save();

    res.json({ success: true, message: 'Successfully logged out from all active devices.' });
  } catch (error) {
    next(error);
  }
};

// @desc    Delete user account and all nested records
// @route   DELETE /api/auth/account
// @access  Private
exports.deleteUserAccount = async (req, res, next) => {
  try {
    const userId = req.user._id;

    // Remove all associated documents
    await Income.deleteMany({ user: userId });
    await Expense.deleteMany({ user: userId });
    await Budget.deleteMany({ user: userId });
    await Notification.deleteMany({ user: userId });
    
    await User.findByIdAndDelete(userId);

    res.json({ success: true, message: 'Account and associated records successfully erased.' });
  } catch (error) {
    next(error);
  }
};

// @desc    Request forgot password OTP code
// @route   POST /api/auth/forgot-password
// @access  Public
exports.forgotPassword = async (req, res, next) => {
  try {
    console.log('\n[AUTH] ─── forgot-password request received ───');
    const { email } = req.body;
    if (!email) {
      console.log('[AUTH] ❌ No email provided in request body');
      return res.status(400).json({ success: false, message: 'Please provide email address' });
    }
    console.log(`[AUTH] Email: ${email}`);

    const user = await User.findOne({ email }).select('+resetOtp +resetOtpExpire +resetOtpAttempts');
    if (!user) {
      console.log(`[AUTH] ⚠️ No user found with email: ${email} (returning generic success)`);
      // Graceful reply to prevent email enumeration attacks
      return res.json({ success: true, message: 'If this email exists, an OTP code has been dispatched.' });
    }
    console.log(`[AUTH] ✅ User found: ${user.username} (${user._id})`);

    // Generate 6-digit numeric OTP
    const otp = String(Math.floor(100000 + Math.random() * 900000));
    console.log(`[AUTH] 🔑 OTP generated: ${otp}`);
    
    user.resetOtp = hashOtp(otp);
    user.resetOtpExpire = Date.now() + 5 * 60 * 1000; // 5 minutes validity
    user.resetOtpAttempts = 0;
    await user.save();
    console.log('[AUTH] ✅ OTP hash saved to database');

    // Dispatch email — await it so we catch errors
    try {
      console.log('[AUTH] 📧 Dispatching OTP email...');
      const emailResult = await sendOtpEmail(user.email, otp);
      console.log('[AUTH] ✅ Email dispatch complete:', JSON.stringify(emailResult));
    } catch (emailErr) {
      console.error('[AUTH] ❌ Email dispatch FAILED:', emailErr.message);
      // Still return success — OTP is saved, user can use test-email to debug
      // But include a hint in development mode
      if (process.env.NODE_ENV === 'development') {
        return res.json({ 
          success: true, 
          message: 'OTP generated but email delivery failed. Check backend logs.',
          devOtp: otp // Only in development!
        });
      }
    }

    console.log('[AUTH] ✅ Returning success response');
    res.json({ success: true, message: 'Verification OTP has been sent to your email.' });
  } catch (error) {
    console.error('[AUTH] ❌ forgotPassword error:', error.message);
    next(error);
  }
};

// @desc    Verify OTP code
// @route   POST /api/auth/verify-otp
// @access  Public
exports.verifyOtp = async (req, res, next) => {
  try {
    const { email, otp } = req.body;
    if (!email || !otp) {
      return res.status(400).json({ success: false, message: 'Please provide email and OTP code' });
    }

    const user = await User.findOne({ email }).select('+resetOtp +resetOtpExpire +resetOtpAttempts');
    if (!user) {
      return res.status(400).json({ success: false, message: 'Invalid request' });
    }

    // Verify attempts
    if (user.resetOtpAttempts >= 5) {
      return res.status(400).json({ success: false, message: 'Maximum validation attempts exceeded. Request a new OTP.' });
    }

    // Verify expiry
    if (Date.now() > new Date(user.resetOtpExpire).getTime()) {
      return res.status(400).json({ success: false, message: 'OTP verification code has expired.' });
    }

    // Check code
    const hashed = hashOtp(otp);
    if (hashed !== user.resetOtp) {
      user.resetOtpAttempts += 1;
      await user.save();
      return res.status(400).json({ success: false, message: 'Incorrect OTP code.' });
    }

    // Create temporary reset token
    const resetToken = crypto.randomBytes(20).toString('hex');
    user.resetOtp = resetToken; // Reuse otp column to store temporary token
    user.resetOtpExpire = Date.now() + 10 * 60 * 1000; // Reset token valid for 10 mins
    await user.save();

    res.json({
      success: true,
      message: 'OTP verified successfully.',
      resetToken
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Reset password using token
// @route   POST /api/auth/reset-password
// @access  Public
exports.resetPassword = async (req, res, next) => {
  try {
    const { email, token, newPassword } = req.body;
    if (!email || !token || !newPassword) {
      return res.status(400).json({ success: false, message: 'Please provide all parameters' });
    }

    if (newPassword.length < 6) {
      return res.status(400).json({ success: false, message: 'Password must be at least 6 characters long' });
    }

    const user = await User.findOne({ email }).select('+resetOtp +resetOtpExpire');
    if (!user) {
      return res.status(400).json({ success: false, message: 'Invalid reset request' });
    }

    // Validate reset token matches and is not expired
    if (user.resetOtp !== token || Date.now() > new Date(user.resetOtpExpire).getTime()) {
      return res.status(400).json({ success: false, message: 'Reset token is invalid or expired.' });
    }

    // Set new password
    user.password = newPassword;
    user.resetOtp = undefined;
    user.resetOtpExpire = undefined;
    user.resetOtpAttempts = 0;
    
    // Invalidate other devices
    user.tokenVersion = (user.tokenVersion || 0) + 1;
    await user.save();

    // Trigger Notification
    await Notification.create({
      user: user._id,
      message: 'Your account password was successfully reset using OTP verification.',
      type: 'month_end'
    });

    sendPasswordChangedEmail(user.email, user.username).catch(err => console.error('Password changed notification error:', err.message));

    res.json({ success: true, message: 'Password reset completed. You can now login.' });
  } catch (error) {
    next(error);
  }
};

// @desc    Verify Registration Email OTP
// @route   POST /api/auth/verify-registration-otp
// @access  Public
exports.verifyRegistrationOtp = async (req, res, next) => {
  try {
    const { email, otp } = req.body;
    if (!email || !otp) {
      return res.status(400).json({ success: false, message: 'Please provide email and verification code.' });
    }

    const user = await User.findOne({ email }).select('+verificationOtp +verificationOtpExpire');
    if (!user) {
      return res.status(400).json({ success: false, message: 'User record not found.' });
    }

    if (user.isVerified) {
      return res.json({ success: true, message: 'Your account is already verified. Please login.' });
    }

    // Verify expiry
    if (Date.now() > new Date(user.verificationOtpExpire).getTime()) {
      return res.status(400).json({ success: false, message: 'Verification code has expired.' });
    }

    // Compare hashed code
    const hashed = hashOtp(otp);
    if (hashed !== user.verificationOtp) {
      return res.status(400).json({ success: false, message: 'Incorrect verification code.' });
    }

    // Activate user
    user.isVerified = true;
    user.verificationOtp = undefined;
    user.verificationOtpExpire = undefined;
    await user.save();

    console.log(`[AUTH] User verified successfully: ${user.username}`);

    // Trigger welcome notifications and emails
    sendWelcomeEmail(user.email, user.username).catch(err => console.error('Welcome email error:', err.message));
    await Notification.create({
      user: user._id,
      message: 'Welcome to AI Expense Tracker! Your email has been verified successfully.',
      type: 'month_end'
    });

    res.json({ success: true, message: 'Email verified successfully! You can now log in.' });
  } catch (error) {
    console.error('[AUTH ERROR] verifyRegistrationOtp failed:', error.message);
    next(error);
  }
};

// @desc    Resend Registration Verification Email OTP
// @route   POST /api/auth/resend-registration-otp
// @access  Public
exports.resendRegistrationOtp = async (req, res, next) => {
  try {
    const { email } = req.body;
    if (!email) {
      return res.status(400).json({ success: false, message: 'Please provide email address.' });
    }

    const user = await User.findOne({ email });
    if (!user) {
      return res.status(400).json({ success: false, message: 'User record not found.' });
    }

    if (user.isVerified) {
      return res.status(400).json({ success: false, message: 'Account is already verified.' });
    }

    // Generate new code
    const verificationCode = String(Math.floor(100000 + Math.random() * 900000));
    user.verificationOtp = hashOtp(verificationCode);
    user.verificationOtpExpire = Date.now() + 24 * 60 * 60 * 1000;
    await user.save();

    console.log(`[AUTH] Resending verification OTP to ${user.email}: ${verificationCode}`);
    
    await sendVerificationEmail(user.email, user.username, verificationCode);
    res.json({ success: true, message: 'Verification OTP code has been resent to your email.' });
  } catch (error) {
    console.error('[AUTH ERROR] resendRegistrationOtp failed:', error.message);
    next(error);
  }
};
