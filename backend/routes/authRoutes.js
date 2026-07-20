const express = require('express');
const router = express.Router();
const {
  registerUser,
  loginUser,
  verifyOtp,
  verifyEmail,
  resendOtp,
  resendVerificationEmail,
  checkOtp,
  forgotPassword,
  validateResetToken,
  resetPassword,
  getUserProfile,
  updateUserProfile,
  changePassword,
  updateNotificationPreferences,
  logoutAllDevices,
  deleteUserAccount
} = require('../controllers/authController');
const { protect } = require('../middleware/authMiddleware');
const { rateLimiter } = require('../middleware/rateLimiter');

// Rate limiters
const loginLimit = rateLimiter(15, 900000); // 15 requests / 15 mins
const registerLimit = rateLimiter(10, 900000); // 10 requests / 15 mins
const authActionLimit = rateLimiter(10, 900000); // 10 requests / 15 mins

// Authentication & Registration
router.post('/register', registerLimit, registerUser);
router.post('/login', loginLimit, loginUser);

// OTP Verification Endpoints
router.post('/verify-otp', authActionLimit, verifyOtp);
router.post('/resend-otp', authActionLimit, resendOtp);
router.post('/check-otp', authActionLimit, checkOtp);

// Compatibility Verification Endpoints
router.get('/verify-email', authActionLimit, verifyEmail);
router.post('/verify-email', authActionLimit, verifyOtp);
router.post('/resend-verification', authActionLimit, resendOtp);

// Password Reset Links
router.post('/forgot-password', authActionLimit, forgotPassword);
router.get('/validate-reset-token', authActionLimit, validateResetToken);
router.post('/reset-password', authActionLimit, resetPassword);

// Protected Routes
router.route('/profile')
  .get(protect, getUserProfile)
  .put(protect, updateUserProfile);

router.put('/password', protect, changePassword);
router.put('/preferences', protect, updateNotificationPreferences);
router.post('/logout-all', protect, logoutAllDevices);
router.delete('/account', protect, deleteUserAccount);

module.exports = router;
