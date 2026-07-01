const express = require('express');
const router = express.Router();
const {
  getUsers,
  deleteUser,
  getSystemAnalytics
} = require('../controllers/adminController');
const { protect } = require('../middleware/authMiddleware');
const { admin } = require('../middleware/adminMiddleware');

router.use(protect); // Secure all routes
router.use(admin);   // Restrict to admins

router.route('/users')
  .get(getUsers);

router.route('/users/:id')
  .delete(deleteUser);

router.route('/analytics')
  .get(getSystemAnalytics);

module.exports = router;
