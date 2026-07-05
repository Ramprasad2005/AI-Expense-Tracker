const express = require('express');
const router = express.Router();
const {
  registerUser,
  loginUser,
  getUserProfile,
  updateUserProfile,
  changePassword,
  updateNotificationPreferences,
  logoutAllDevices,
  deleteUserAccount,
  forgotPassword,
  verifyOtp,
  resetPassword,
  verifyRegistrationOtp,
  resendRegistrationOtp
} = require('../controllers/authController');
const { protect } = require('../middleware/authMiddleware');
const { rateLimiter } = require('../middleware/rateLimiter');

// Rate limiters: 15 minutes window (900000ms)
const loginLimit = rateLimiter(15, 900000);
const registerLimit = rateLimiter(10, 900000);
const otpLimit = rateLimiter(10, 900000);

router.post('/register', registerLimit, registerUser);
router.post('/login', loginLimit, loginUser);

router.route('/profile')
  .get(protect, getUserProfile)
  .put(protect, updateUserProfile);

router.put('/password', protect, changePassword);
router.put('/preferences', protect, updateNotificationPreferences);
router.post('/logout-all', protect, logoutAllDevices);
router.delete('/account', protect, deleteUserAccount);

// Forgot Password Paths
router.post('/forgot-password', otpLimit, forgotPassword);
router.post('/verify-otp', otpLimit, verifyOtp);
router.post('/reset-password', otpLimit, resetPassword);

// Registration Verification Paths
router.post('/verify-registration-otp', otpLimit, verifyRegistrationOtp);
router.post('/resend-registration-otp', otpLimit, resendRegistrationOtp);



module.exports = router;
