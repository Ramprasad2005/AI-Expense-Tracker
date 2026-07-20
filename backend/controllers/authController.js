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
  sendPasswordResetEmail,
  sendPasswordChangedEmail
} = require('../utils/email');

// Helper to hash token with SHA-256
const hashToken = (token) => crypto.createHash('sha256').update(String(token)).digest('hex');

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

    const cleanEmail = email.toLowerCase().trim();
    const cleanUsername = username.trim();

    // ISSUE 1: Check MongoDB correctly for existing email
    const existingEmail = await User.findOne({ email: cleanEmail });
    if (existingEmail) {
      return res.status(409).json({ success: false, message: 'Email already registered.' });
    }

    const existingUsername = await User.findOne({ username: cleanUsername });
    if (existingUsername) {
      return res.status(409).json({ success: false, message: 'Username is already taken.' });
    }

    // ISSUE 4: Generate secure verification token
    const rawVerificationToken = crypto.randomBytes(32).toString('hex');
    const hashedVerificationToken = hashToken(rawVerificationToken);

    // Create user with isVerified: false and 24-hour verification token expiry
    const user = await User.create({
      username: cleanUsername,
      email: cleanEmail,
      password,
      role: role || 'user',
      tokenVersion: 0,
      isVerified: false,
      verificationToken: hashedVerificationToken,
      verificationExpires: Date.now() + 24 * 60 * 60 * 1000 // 24 hours
    });

    if (user) {
      console.log(`[AUTH] User registered: ${user.username} (Unverified)`);

      // Dispatch verification email with token link
      sendVerificationEmail(user.email, user.username, rawVerificationToken)
        .catch(err => console.error('[AUTH ERROR] Verification email dispatch error:', err.message));

      res.status(201).json({
        success: true,
        message: 'Verification email has been sent.'
      });
    } else {
      res.status(400).json({ success: false, message: 'Invalid user data' });
    }
  } catch (error) {
    if (error.code === 11000) {
      return res.status(409).json({ success: false, message: 'Email already registered.' });
    }
    next(error);
  }
};

// @desc    Verify Registration Email Link Token
// @route   POST /api/auth/verify-email or GET /api/auth/verify-email
// @access  Public
exports.verifyEmail = async (req, res, next) => {
  try {
    const token = req.query.token || req.body.token;
    if (!token) {
      return res.status(400).json({ success: false, message: 'Verification token is required.' });
    }

    const hashedToken = hashToken(token);

    const user = await User.findOne({
      verificationToken: hashedToken,
      verificationExpires: { $gt: Date.now() }
    }).select('+verificationToken +verificationExpires');

    if (!user) {
      return res.status(400).json({ success: false, message: 'Verification link expired.' });
    }

    // Mark user verified and delete token fields
    user.isVerified = true;
    user.verificationToken = undefined;
    user.verificationExpires = undefined;
    await user.save();

    console.log(`[AUTH] User verified successfully: ${user.username}`);

    sendWelcomeEmail(user.email, user.username).catch(err => console.error('Welcome email error:', err.message));

    await Notification.create({
      user: user._id,
      message: 'Welcome to AI Expense Tracker! Your email has been verified successfully.',
      type: 'month_end'
    });

    res.status(200).json({ success: true, message: 'Email Verified Successfully' });
  } catch (error) {
    console.error('[AUTH ERROR] verifyEmail failed:', error.message);
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

    const cleanEmail = email.toLowerCase().trim();

    const user = await User.findOne({ email: cleanEmail }).select('+password');
    if (!user) {
      return res.status(401).json({ success: false, message: 'Invalid email or password.' });
    }

    const isMatch = await user.matchPassword(password);
    if (!isMatch) {
      return res.status(401).json({ success: false, message: 'Invalid email or password.' });
    }

    // ISSUE 2 & ISSUE 11: Reject unverified users with explicit response
    if (!user.isVerified) {
      return res.status(401).json({
        success: false,
        message: 'Your email is not verified.',
        email: user.email
      });
    }

    res.status(200).json({
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

// @desc    Resend Verification Email Link
// @route   POST /api/auth/resend-verification
// @access  Public
exports.resendVerificationEmail = async (req, res, next) => {
  try {
    const { email } = req.body;
    if (!email) {
      return res.status(400).json({ success: false, message: 'Please provide an email address.' });
    }

    const cleanEmail = email.toLowerCase().trim();
    const user = await User.findOne({ email: cleanEmail }).select('+lastResendTimestamp');
    if (!user) {
      return res.status(400).json({ success: false, message: 'User account not found.' });
    }

    if (user.isVerified) {
      return res.status(400).json({ success: false, message: 'Account is already verified.' });
    }

    // Enforce 1 email per minute rate limiting
    if (user.lastResendTimestamp && (Date.now() - new Date(user.lastResendTimestamp).getTime() < 60000)) {
      return res.status(429).json({
        success: false,
        message: 'Please wait 1 minute before requesting another verification email.'
      });
    }

    // Generate new token & invalidate previous
    const rawVerificationToken = crypto.randomBytes(32).toString('hex');
    user.verificationToken = hashToken(rawVerificationToken);
    user.verificationExpires = Date.now() + 24 * 60 * 60 * 1000; // 24 hours
    user.lastResendTimestamp = Date.now();
    await user.save();

    console.log(`[AUTH] Resending verification email link to ${user.email}`);

    await sendVerificationEmail(user.email, user.username, rawVerificationToken);

    res.status(200).json({ success: true, message: 'Verification email sent.' });
  } catch (error) {
    console.error('[AUTH ERROR] resendVerificationEmail failed:', error.message);
    next(error);
  }
};

// @desc    Request forgot password link
// @route   POST /api/auth/forgot-password
// @access  Public
exports.forgotPassword = async (req, res, next) => {
  try {
    const { email } = req.body;
    if (!email) {
      return res.status(400).json({ success: false, message: 'Please provide email address.' });
    }

    const cleanEmail = email.toLowerCase().trim();
    const user = await User.findOne({ email: cleanEmail });

    if (!user) {
      // Prevent email enumeration
      return res.status(200).json({ success: true, message: 'Verification email sent.' });
    }

    const rawResetToken = crypto.randomBytes(32).toString('hex');
    user.resetToken = hashToken(rawResetToken);
    user.resetExpires = Date.now() + 60 * 60 * 1000; // 1 hour validity
    await user.save();

    try {
      await sendPasswordResetEmail(user.email, user.username, rawResetToken);
    } catch (emailErr) {
      console.error('[AUTH ERROR] Forgot password email failed:', emailErr.message);
    }

    res.status(200).json({ success: true, message: 'Verification email sent.' });
  } catch (error) {
    next(error);
  }
};

// @desc    Reset password using token
// @route   POST /api/auth/reset-password
// @access  Public
exports.resetPassword = async (req, res, next) => {
  try {
    const { token, newPassword } = req.body;
    if (!token || !newPassword) {
      return res.status(400).json({ success: false, message: 'Please provide token and new password.' });
    }

    if (newPassword.length < 6) {
      return res.status(400).json({ success: false, message: 'Password must be at least 6 characters long.' });
    }

    const hashedToken = hashToken(token);

    const user = await User.findOne({
      resetToken: hashedToken,
      resetExpires: { $gt: Date.now() }
    }).select('+resetToken +resetExpires');

    if (!user) {
      return res.status(400).json({ success: false, message: 'Verification link expired.' });
    }

    // Set new password (hashed via pre-save hook with 12 rounds bcrypt)
    user.password = newPassword;
    user.resetToken = undefined;
    user.resetExpires = undefined;
    
    // Invalidate previous sessions
    user.tokenVersion = (user.tokenVersion || 0) + 1;
    await user.save();

    await Notification.create({
      user: user._id,
      message: 'Your account password was successfully reset.',
      type: 'month_end'
    });

    sendPasswordChangedEmail(user.email, user.username).catch(err => console.error('Password changed notification error:', err.message));

    res.status(200).json({ success: true, message: 'Password reset successful.' });
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

      if (username && username.trim() !== user.username) {
        const usernameExists = await User.findOne({ username: username.trim() });
        if (usernameExists) {
          return res.status(409).json({ success: false, message: 'Username is already taken' });
        }
        user.username = username.trim();
      }

      if (email && email.toLowerCase().trim() !== user.email) {
        const emailExists = await User.findOne({ email: email.toLowerCase().trim() });
        if (emailExists) {
          return res.status(409).json({ success: false, message: 'Email already registered.' });
        }
        user.email = email.toLowerCase().trim();
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
    user.tokenVersion = (user.tokenVersion || 0) + 1;
    await user.save();

    await Notification.create({
      user: user._id,
      message: 'Your account password was updated successfully.',
      type: 'month_end'
    });

    sendPasswordChangedEmail(user.email, user.username).catch(err => console.error('Password changed email error:', err.message));

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

// @desc    Delete user account
// @route   DELETE /api/auth/account
// @access  Private
exports.deleteUserAccount = async (req, res, next) => {
  try {
    const userId = req.user._id;

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
