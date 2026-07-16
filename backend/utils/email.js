const nodemailer = require('nodemailer');

// Main helper to send email
const sendEmail = async (options) => {
  const host = process.env.EMAIL_HOST;
  const port = process.env.EMAIL_PORT;
  const user = process.env.EMAIL_USER;
  const pass = process.env.EMAIL_PASSWORD || process.env.EMAIL_PASS;
  const from = process.env.EMAIL_FROM || user || 'noreply@tracker.com';

  console.log('\n[EMAIL DEBUG] ─── sendEmail called ───');
  console.log(`[EMAIL DEBUG] To: ${options.email}`);
  console.log(`[EMAIL DEBUG] Subject: ${options.subject}`);
  console.log(`[EMAIL DEBUG] EMAIL_HOST: ${host || '(not set)'}`);
  console.log(`[EMAIL DEBUG] EMAIL_PORT: ${port || '(not set)'}`);
  console.log(`[EMAIL DEBUG] EMAIL_USER: ${user || '(not set)'}`);
  console.log(`[EMAIL DEBUG] EMAIL_PASSWORD: ${pass ? '****' + pass.slice(-4) : '(not set)'}`);
  console.log(`[EMAIL DEBUG] EMAIL_FROM: ${from}`);

  const hasCredentials = host && port && user && pass;

  if (!hasCredentials) {
    console.warn('[EMAIL WARN] Missing SMTP credentials. Falling back to mock console email.');
    console.warn('[EMAIL WARN] Set EMAIL_HOST, EMAIL_PORT, EMAIL_USER, EMAIL_PASSWORD in .env');
    // Graceful fallback to console logging for local sandbox testing
    const plainText = options.html.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim();
    console.log('\n========================================================================');
    console.log(`[MOCK EMAIL SENT]`);
    console.log(`To:      ${options.email}`);
    console.log(`Subject: ${options.subject}`);
    console.log(`Body:    ${plainText.slice(0, 300)}...`);
    console.log('========================================================================\n');
    return { success: true, mock: true };
  }

  try {
    console.log('[EMAIL DEBUG] Creating Nodemailer transporter...');
    const transporter = nodemailer.createTransport({
      host,
      port: parseInt(port),
      secure: parseInt(port) === 465,
      auth: { user, pass }
    });

    console.log('[EMAIL DEBUG] Verifying SMTP connection with transporter.verify()...');
    await transporter.verify();
    console.log('[EMAIL DEBUG] ✅ SMTP connection verified successfully.');

    const mailOptions = {
      from: `"AI Expense Tracker" <${from}>`,
      to: options.email,
      subject: options.subject,
      html: options.html
    };

    console.log('[EMAIL DEBUG] Sending email...');
    const info = await transporter.sendMail(mailOptions);
    console.log(`[EMAIL DEBUG] ✅ Email sent successfully!`);
    console.log(`[EMAIL DEBUG] Message ID: ${info.messageId}`);
    console.log(`[EMAIL DEBUG] Response: ${info.response}`);
    return { success: true, mock: false, messageId: info.messageId };
  } catch (error) {
    console.error('[EMAIL ERROR] ❌ Failed to send email:');
    console.error(`[EMAIL ERROR] Code: ${error.code || 'N/A'}`);
    console.error(`[EMAIL ERROR] Message: ${error.message}`);
    console.error(`[EMAIL ERROR] Stack: ${error.stack}`);
    // Re-throw so the caller can decide how to handle it
    throw error;
  }
};


// HTML Email Layout Wrapper
const getHtmlLayout = (title, content) => {
  return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${title}</title>
  <style>
    body { font-family: 'Helvetica Neue', Helvetica, Arial, sans-serif; background-color: #F8FAFC; color: #1E293B; margin: 0; padding: 0; }
    .wrapper { width: 100%; max-width: 600px; margin: 0 auto; background-color: #FFFFFF; border: 1px solid #E2E8F0; border-radius: 8px; overflow: hidden; margin-top: 20px; }
    .header { background-color: #111827; padding: 24px; text-align: center; color: #FFFFFF; }
    .header h2 { margin: 0; font-size: 20px; font-weight: 700; letter-spacing: -0.5px; }
    .content { padding: 40px 30px; line-height: 1.6; }
    .content p { font-size: 15px; margin-bottom: 20px; color: #334155; }
    .btn { display: inline-block; padding: 12px 24px; background-color: #2563EB; color: #FFFFFF !important; text-decoration: none; border-radius: 6px; font-weight: 600; font-size: 14px; margin-top: 10px; }
    .footer { background-color: #F8FAFC; padding: 20px; text-align: center; border-top: 1px solid #E2E8F0; font-size: 12px; color: #64748B; }
  </style>
</head>
<body>
  <div class="wrapper">
    <div class="header">
      <h2>AI Expense Tracker</h2>
    </div>
    <div class="content">
      ${content}
    </div>
    <div class="footer">
      &copy; 2026 AI Expense Tracker. All rights reserved.<br>
      This is an automated transaction warning message. Please do not reply directly.
    </div>
  </div>
</body>
</html>
  `;
};

// Welcome email
const sendWelcomeEmail = async (email, username) => {
  const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:4200';
  const content = `
    <h3>Welcome to AI Expense Tracker, ${username}!</h3>
    <p>We are excited to help you optimize your personal budget. Log in to create custom limits, export PDF statements, and receive financial optimization suggestions compiled by Google Gemini AI.</p>
    <a href="${frontendUrl}/login" class="btn">Access Dashboard</a>
  `;
  await sendEmail({
    email,
    subject: 'Welcome to AI Expense Tracker',
    html: getHtmlLayout('Welcome', content)
  });
};

// Verification OTP for Registration
const sendVerificationEmail = async (email, username, otpCode) => {
  const content = `
    <h3>Welcome to AI Expense Tracker, ${username}!</h3>
    <p>Thank you for registering. Use the following 6-digit verification code to complete your registration and activate your account. This code is valid for exactly <strong>24 hours</strong>.</p>
    <div style="font-size: 32px; font-weight: 800; text-align: center; margin: 30px 0; letter-spacing: 5px; color: #2563EB;">
      ${otpCode}
    </div>
    <p>If you did not create an account, please ignore this email.</p>
  `;
  await sendEmail({
    email,
    subject: 'Activate Your AI Expense Tracker Account - Verification Code',
    html: getHtmlLayout('Email Verification', content)
  });
};

// Password Reset OTP
const sendOtpEmail = async (email, otpCode) => {
  const content = `
    <h3>Verify Password Reset Request</h3>
    <p>You requested to reset your password. Use the following 6-digit code to authorize this action. This code is valid for exactly <strong>5 minutes</strong>.</p>
    <div style="font-size: 32px; font-weight: 800; text-align: center; margin: 30px 0; letter-spacing: 5px; color: #2563EB;">
      ${otpCode}
    </div>
    <p>If you did not request this code, please secure your credentials immediately.</p>
  `;
  await sendEmail({
    email,
    subject: 'Password Reset OTP Verification',
    html: getHtmlLayout('Password Reset Code', content)
  });
};

// Password Change Confirmation
const sendPasswordChangedEmail = async (email, username) => {
  const content = `
    <h3>Security Alert: Password Updated</h3>
    <p>Hello ${username},</p>
    <p>This is to confirm that the password for your AI Expense Tracker account has been successfully changed.</p>
    <p>If you did not perform this change, please contact administration or reset your credentials immediately to secure your active assets.</p>
  `;
  await sendEmail({
    email,
    subject: 'Security Alert: Password Changed',
    html: getHtmlLayout('Password Changed', content)
  });
};

// Budget Alert Exceeded
const sendBudgetAlertEmail = async (email, budgetLimit, totalSpent, month) => {
  const content = `
    <h3 style="color: #EF4444;">Warning: Budget Exceeded</h3>
    <p>You have exceeded your monthly limit for the period <strong>${month}</strong>.</p>
    <div style="background-color: #FEE2E2; padding: 20px; border-radius: 6px; margin: 20px 0; border: 1px solid #FCA5A5;">
      <p style="margin: 5px 0;"><strong>Budget Limit:</strong> $${budgetLimit.toFixed(2)}</p>
      <p style="margin: 5px 0; color: #DC2626;"><strong>Total Spent:</strong> $${totalSpent.toFixed(2)}</p>
    </div>
    <p>Review your expense records to identify categories for cost optimization, or request suggestions from the AI financial advisor.</p>
  `;
  await sendEmail({
    email,
    subject: `Budget Warning: Limit Exceeded for ${month}`,
    html: getHtmlLayout('Budget Exceeded', content)
  });
};

// Account notification
const sendAccountNotificationEmail = async (email, subject, message) => {
  const content = `
    <h3>Account Notice</h3>
    <p>${message}</p>
  `;
  await sendEmail({
    email,
    subject: `Account Notice: ${subject}`,
    html: getHtmlLayout('Account Notice', content)
  });
};

module.exports = {
  sendWelcomeEmail,
  sendVerificationEmail,
  sendOtpEmail,
  sendPasswordChangedEmail,
  sendBudgetAlertEmail,
  sendAccountNotificationEmail
};
