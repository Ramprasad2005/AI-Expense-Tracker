const User = require('../models/User');
const PendingUser = require('../models/PendingUser');
const Income = require('../models/Income');
const Expense = require('../models/Expense');
const Budget = require('../models/Budget');
const Notification = require('../models/Notification');
const jwt = require('jsonwebtoken');
const crypto = require('crypto');
const bcrypt = require('bcryptjs');
const {
  sendWelcomeEmail,
  sendOtpVerificationEmail,
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

// @desc    Register a new user & Send 6-digit OTP (Do NOT create account before OTP verification)
// @route   POST /api/auth/register
// @access  Public
exports.registerUser = async (req, res, next) => {
  try {
    const { fullName, username, email, password, role } = req.body;

    if (!username || !email || !password) {
      return res.status(400).json({ success: false, message: 'Please provide all required fields' });
    }

    if (password.length < 6) {
      return res.status(400).json({ success: false, message: 'Password must be at least 6 characters long' });
    }

    const cleanEmail = email.toLowerCase().trim();
    const cleanUsername = username.trim().toLowerCase();

    // 1. Check if user ALREADY exists in verified User database
    const existingUser = await User.findOne({
      $or: [{ email: cleanEmail }, { username: cleanUsername }]
    });

    if (existingUser) {
      if (existingUser.email === cleanEmail) {
        return res.status(409).json({ success: false, message: 'Email already registered.' });
      }
      return res.status(409).json({ success: false, message: 'Username is already taken.' });
    }

    // 2. Remove any previous unverified pending registration for this email/username
    await PendingUser.deleteMany({
      $or: [{ email: cleanEmail }, { username: cleanUsername }]
    });

    // 3. Hash password for secure temporary storage
    const salt = await bcrypt.genSalt(12);
    const hashedPassword = await bcrypt.hash(password, salt);

    // 4. Generate secure 6-digit OTP
    const otp = crypto.randomInt(100000, 1000000).toString();
    const hashedOtp = hashToken(otp);
    const otpExpiry = new Date(Date.now() + 10 * 60 * 1000); // 10 mins

    // 5. Store registration details in temporary PendingUser collection (NOT User collection)
    await PendingUser.create({
      fullName: fullName || '',
      username: cleanUsername,
      email: cleanEmail,
      password: hashedPassword,
      role: role || (cleanEmail.startsWith('admin@') ? 'admin' : 'user'),
      otp: hashedOtp,
      otpExpiry,
      verificationAttempts: 0,
      lastResendTimestamp: new Date()
    });

    console.log(`[AUTH OTP GENERATED] Email: ${cleanEmail} | OTP: ${otp} (Expires in 10 mins)`);

    // 6. Dispatch OTP email asynchronously
    sendOtpVerificationEmail(cleanEmail, cleanUsername, otp).catch(err =>
      console.error('[AUTH ERROR] OTP Email failed:', err.message)
    );

    res.status(201).json({
      success: true,
      message: 'Verification code sent to your email.',
      data: {
        email: cleanEmail
      }
    });
  } catch (error) {
    if (error.code === 11000) {
      return res.status(409).json({ success: false, message: 'Email or Username already registered.' });
    }
    next(error);
  }
};

// @desc    Verify 6-Digit OTP Code & Create User Account
// @route   POST /api/auth/verify-otp (and POST /api/auth/verify-email)
// @access  Public
exports.verifyOtp = async (req, res, next) => {
  try {
    const email = req.body.email || req.query.email;
    const otp = req.body.otp || req.body.token || req.query.token;

    if (!email || !otp) {
      return res.status(400).json({ success: false, message: 'Please provide email and 6-digit verification code.' });
    }

    const cleanEmail = email.toLowerCase().trim();
    const cleanOtp = String(otp).trim();

    // Look for pending registration
    const pendingUser = await PendingUser.findOne({ email: cleanEmail });

    if (!pendingUser) {
      // Check if user is already registered in User database
      const existingUser = await User.findOne({ email: cleanEmail });
      if (existingUser) {
        return res.status(200).json({ success: true, message: 'Email is already verified. You can log in.' });
      }
      return res.status(400).json({
        success: false,
        message: 'Verification code expired or registration timed out. Please register again.'
      });
    }

    // Lock check: max 5 attempts
    if (pendingUser.verificationAttempts >= 5) {
      return res.status(400).json({
        success: false,
        message: 'Maximum OTP verification attempts reached. Please register again or request a new code.'
      });
    }

    // Expiry check: 10 minutes
    if (!pendingUser.otpExpiry || Date.now() > new Date(pendingUser.otpExpiry).getTime()) {
      return res.status(400).json({
        success: false,
        message: 'Verification code has expired. Please click "Resend Code" to receive a new OTP.'
      });
    }

    // Compare SHA-256 OTP Hash
    const hashedSubmittedOtp = hashToken(cleanOtp);
    if (hashedSubmittedOtp !== pendingUser.otp) {
      pendingUser.verificationAttempts = (pendingUser.verificationAttempts || 0) + 1;
      await pendingUser.save();

      const remainingAttempts = 5 - pendingUser.verificationAttempts;
      if (remainingAttempts <= 0) {
        return res.status(400).json({
          success: false,
          message: 'Maximum verification attempts reached (5/5). Please request a new verification code.'
        });
      }

      return res.status(400).json({
        success: false,
        message: `Invalid verification code. ${remainingAttempts} attempt${remainingAttempts === 1 ? '' : 's'} remaining.`
      });
    }

    // Verification Success: NOW create the actual User Account in MongoDB
    const newUser = await User.create({
      fullName: pendingUser.fullName,
      username: pendingUser.username,
      email: pendingUser.email,
      password: pendingUser.password, // already hashed
      role: pendingUser.role,
      tokenVersion: 0,
      isVerified: true,
      emailVerified: true,
      verifiedAt: new Date()
    });

    // Delete temporary PendingUser record
    await PendingUser.deleteOne({ _id: pendingUser._id });

    console.log(`[AUTH VERIFIED & CREATED] User account created: ${newUser.username} (${newUser.email})`);

    // Send Welcome Email
    sendWelcomeEmail(newUser.email, newUser.username).catch(err =>
      console.error('[AUTH ERROR] Welcome email failed:', err.message)
    );

    const token = generateToken(newUser._id, newUser.tokenVersion);

    res.status(200).json({
      success: true,
      message: 'Email verified successfully!',
      data: {
        _id: newUser._id,
        username: newUser.username,
        email: newUser.email,
        role: newUser.role,
        notificationPreferences: newUser.notificationPreferences,
        token
      }
    });
  } catch (error) {
    if (error.code === 11000) {
      return res.status(409).json({ success: false, message: 'Email or Username already registered.' });
    }
    next(error);
  }
};

// @desc    Alias for verifyOtp to maintain backward compatibility
exports.verifyEmail = exports.verifyOtp;

// @desc    Resend 6-Digit OTP Code
// @route   POST /api/auth/resend-otp (and POST /api/auth/resend-verification)
// @access  Public
exports.resendOtp = async (req, res, next) => {
  try {
    const { email } = req.body;

    if (!email) {
      return res.status(400).json({ success: false, message: 'Please provide email address.' });
    }

    const cleanEmail = email.toLowerCase().trim();
    const pendingUser = await PendingUser.findOne({ email: cleanEmail });

    if (!pendingUser) {
      const existingUser = await User.findOne({ email: cleanEmail });
      if (existingUser) {
        return res.status(400).json({ success: false, message: 'Email is already verified.' });
      }
      return res.status(404).json({ success: false, message: 'No pending registration found for this email. Please register first.' });
    }

    // Enforce 60-second cooldown rate limit
    if (pendingUser.lastResendTimestamp) {
      const timeElapsed = Date.now() - new Date(pendingUser.lastResendTimestamp).getTime();
      if (timeElapsed < 60000) {
        const secondsLeft = Math.ceil((60000 - timeElapsed) / 1000);
        return res.status(429).json({
          success: false,
          message: `Please wait ${secondsLeft} seconds before requesting a new code.`,
          secondsLeft
        });
      }
    }

    // Generate new OTP & invalidate previous OTP
    const newOtp = crypto.randomInt(100000, 1000000).toString();
    pendingUser.otp = hashToken(newOtp);
    pendingUser.otpExpiry = new Date(Date.now() + 10 * 60 * 1000); // 10 mins
    pendingUser.verificationAttempts = 0;
    pendingUser.lastResendTimestamp = new Date();

    await pendingUser.save();

    console.log(`[AUTH OTP RESENT] Email: ${cleanEmail} | New OTP: ${newOtp}`);

    sendOtpVerificationEmail(pendingUser.email, pendingUser.username, newOtp).catch(err =>
      console.error('[AUTH ERROR] Resend OTP Email failed:', err.message)
    );

    res.status(200).json({
      success: true,
      message: 'A new 6-digit verification code has been sent to your email.'
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Alias for resendOtp
exports.resendVerificationEmail = exports.resendOtp;

// @desc    Check OTP Status (Pre-validation check)
// @route   POST /api/auth/check-otp
// @access  Public
exports.checkOtp = async (req, res, next) => {
  try {
    const { email, otp } = req.body;
    if (!email || !otp) {
      return res.status(400).json({ success: false, message: 'Email and OTP are required' });
    }

    const cleanEmail = email.toLowerCase().trim();
    const cleanOtp = String(otp).trim();

    const pendingUser = await PendingUser.findOne({ email: cleanEmail });
    if (!pendingUser) {
      return res.status(200).json({ success: false, valid: false, message: 'No pending registration found.' });
    }

    if (pendingUser.verificationAttempts >= 5) {
      return res.status(200).json({ success: false, valid: false, message: 'Max attempts exceeded.' });
    }

    if (!pendingUser.otpExpiry || Date.now() > new Date(pendingUser.otpExpiry).getTime()) {
      return res.status(200).json({ success: false, valid: false, message: 'OTP expired.' });
    }

    const isValid = hashToken(cleanOtp) === pendingUser.otp;
    res.status(200).json({
      success: true,
      valid: isValid,
      message: isValid ? 'OTP code is valid.' : 'Incorrect verification code.'
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Auth user & get token (Only verified users can log in)
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
      // Check if there is a pending unverified registration for this email
      const pending = await PendingUser.findOne({ email: cleanEmail });
      if (pending) {
        return res.status(401).json({
          success: false,
          isUnverified: true,
          email: pending.email,
          message: 'Verify your email first.'
        });
      }
      return res.status(401).json({ success: false, message: 'Invalid email or password.' });
    }

    const isMatch = await user.matchPassword(password);
    if (!isMatch) {
      return res.status(401).json({ success: false, message: 'Invalid email or password.' });
    }

    // Check email verification state
    if (!user.isVerified && !user.emailVerified) {
      return res.status(401).json({
        success: false,
        isUnverified: true,
        email: user.email,
        message: 'Verify your email first.'
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

    const successMessage = "We've securely sent a password reset link to your registered email address.";

    if (!user) {
      return res.status(200).json({ success: true, message: successMessage });
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

    res.status(200).json({ success: true, message: successMessage });
  } catch (error) {
    next(error);
  }
};

// @desc    Validate password reset token on page load
// @route   GET /api/auth/validate-reset-token
// @access  Public
exports.validateResetToken = async (req, res, next) => {
  try {
    const token = req.query.token;
    if (!token) {
      return res.status(400).json({ success: false, message: 'Please provide token.' });
    }

    const hashedToken = hashToken(token);

    const user = await User.findOne({
      resetToken: hashedToken,
      resetExpires: { $gt: Date.now() }
    });

    if (!user) {
      return res.status(400).json({ success: false, message: 'Verification link expired or invalid.' });
    }

    res.status(200).json({ success: true, message: 'Token is valid.' });
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

    user.password = newPassword;
    user.resetToken = undefined;
    user.resetExpires = undefined;
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

      if (username && username.trim().toLowerCase() !== user.username) {
        const usernameExists = await User.findOne({ username: username.trim().toLowerCase() });
        if (usernameExists) {
          return res.status(409).json({ success: false, message: 'Username is already taken' });
        }
        user.username = username.trim().toLowerCase();
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
