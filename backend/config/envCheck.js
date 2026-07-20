/**
 * Startup Environment Variable Diagnostics & Validation
 */

const validateEnv = () => {
  const checkPresent = (varName) => {
    if (varName === 'MONGODB_URI') {
      return !!(process.env.MONGODB_URI || process.env.MONGO_URI);
    }
    if (varName === 'EMAIL_PASS') {
      return !!(process.env.EMAIL_PASS || process.env.EMAIL_PASSWORD);
    }
    if (varName === 'GOOGLE_API_KEY') {
      return !!(process.env.GOOGLE_API_KEY || process.env.GEMINI_API_KEY);
    }
    return !!process.env[varName];
  };

  const requiredVars = [
    'JWT_SECRET',
    'MONGODB_URI'
  ];

  const recommendedVars = [
    'EMAIL_USER',
    'EMAIL_PASS',
    'FRONTEND_URL',
    'BACKEND_URL',
    'GOOGLE_API_KEY'
  ];

  const missingRequired = [];
  const missingRecommended = [];

  requiredVars.forEach(v => {
    if (!checkPresent(v)) {
      missingRequired.push(v);
    }
  });

  recommendedVars.forEach(v => {
    if (!checkPresent(v)) {
      missingRecommended.push(v);
    }
  });

  if (missingRequired.length > 0) {
    console.error('\n========================================================================');
    console.error('❌ CRITICAL STARTUP ERROR: Missing required environment variable(s):');
    missingRequired.forEach(v => console.error(`   - ${v}`));
    console.error('Please configure these variables in your .env or Vercel environment.');
    console.error('========================================================================\n');
  }

  if (missingRecommended.length > 0) {
    console.warn('\n------------------------------------------------------------------------');
    console.warn('⚠️ STARTUP WARNING: Missing recommended environment variable(s):');
    missingRecommended.forEach(v => console.warn(`   - ${v}`));
    console.warn('Some services (such as email delivery or Gemini AI features) may be limited.');
    console.warn('------------------------------------------------------------------------\n');
  }

  if (missingRequired.length === 0 && missingRecommended.length === 0) {
    console.log('✅ Environment configuration check passed.');
  }
};

module.exports = { validateEnv };
