const nodemailer = require('nodemailer');

// Main helper to send email
const sendEmail = async (options) => {
  const host = process.env.EMAIL_HOST || 'smtp.gmail.com';
  const port = parseInt(process.env.EMAIL_PORT || '587');
  const user = process.env.EMAIL_USER;
  const pass = process.env.EMAIL_PASS || process.env.EMAIL_PASSWORD;
  const from = user || 'noreply@tracker.com';

  console.log('\n[EMAIL DEBUG] ─── sendEmail called ───');
  console.log(`[EMAIL DEBUG] To: ${options.email}`);
  console.log(`[EMAIL DEBUG] Subject: ${options.subject}`);
  console.log(`[EMAIL DEBUG] EMAIL_HOST: ${host}`);
  console.log(`[EMAIL DEBUG] EMAIL_PORT: ${port}`);
  console.log(`[EMAIL DEBUG] EMAIL_USER: ${user || '(not set)'}`);
  console.log(`[EMAIL DEBUG] EMAIL_FROM: ${from}`);

  const hasCredentials = user && pass;

  if (!hasCredentials) {
    console.warn('[EMAIL WARN] Missing SMTP credentials. Falling back to mock console email.');
    console.warn('[EMAIL WARN] Set EMAIL_USER and EMAIL_PASS in .env');
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
    const transporter = nodemailer.createTransport({
      host,
      port,
      secure: port === 465,
      auth: { user, pass }
    });

    const mailOptions = {
      from: `"AI Expense Tracker" <${from}>`,
      to: options.email,
      subject: options.subject,
      html: options.html
    };

    const info = await transporter.sendMail(mailOptions);
    console.log(`[EMAIL DEBUG] ✅ Email sent successfully! Message ID: ${info.messageId}`);
    return { success: true, mock: false, messageId: info.messageId };
  } catch (error) {
    console.error('[EMAIL ERROR] ❌ Failed to send email:', error.message);
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
    .btn { display: inline-block; padding: 14px 28px; background-color: #2563EB; color: #FFFFFF !important; text-decoration: none; border-radius: 6px; font-weight: 600; font-size: 15px; margin-top: 15px; }
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
      &copy; ${new Date().getFullYear()} AI Expense Tracker. All rights reserved.<br>
      This is an automated system message. Please do not reply directly.
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
    <p>We are excited to help you optimize your personal budget. Log in to create custom limits, export PDF statements, and receive financial optimization suggestions.</p>
    <a href="${frontendUrl}/login" class="btn">Access Dashboard</a>
  `;
  await sendEmail({
    email,
    subject: 'Welcome to AI Expense Tracker',
    html: getHtmlLayout('Welcome', content)
  });
};

// Verification Link for Registration
const sendVerificationEmail = async (email, username, token) => {
  const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:4200';
  const verificationUrl = `${frontendUrl}/verify-email?token=${token}`;
  const content = `
    <h3>Welcome to AI Expense Tracker, ${username}!</h3>
    <p>Thank you for registering. Please click the button below to verify your email address and activate your account. This link is valid for <strong>24 hours</strong>.</p>
    <div style="text-align: center; margin: 30px 0;">
      <a href="${verificationUrl}" class="btn">Verify Email Address</a>
    </div>
    <p style="font-size: 13px; color: #64748B;">Or copy and paste this link in your browser:<br><a href="${verificationUrl}">${verificationUrl}</a></p>
    <p>If you did not create an account, please ignore this email.</p>
  `;
  await sendEmail({
    email,
    subject: 'Verify Your Email Address - AI Expense Tracker',
    html: getHtmlLayout('Email Verification', content)
  });
};

// Password Reset Link
const sendPasswordResetEmail = async (email, username, token) => {
  const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:4200';
  const resetUrl = `${frontendUrl}/reset-password?token=${token}`;
  const content = `
    <h3>Reset Your Password</h3>
    <p>Hello ${username},</p>
    <p>You requested to reset your password for AI Expense Tracker. Click the button below to choose a new password. This link is valid for <strong>1 hour</strong>.</p>
    <div style="text-align: center; margin: 30px 0;">
      <a href="${resetUrl}" class="btn">Reset Password</a>
    </div>
    <p style="font-size: 13px; color: #64748B;">Or copy and paste this link in your browser:<br><a href="${resetUrl}">${resetUrl}</a></p>
    <p>If you did not request a password reset, please ignore this email and your password will remain unchanged.</p>
  `;
  await sendEmail({
    email,
    subject: 'Password Reset Request - AI Expense Tracker',
    html: getHtmlLayout('Password Reset Link', content)
  });
};

// Password Change Confirmation
const sendPasswordChangedEmail = async (email, username) => {
  const content = `
    <h3>Security Alert: Password Updated</h3>
    <p>Hello ${username},</p>
    <p>This is to confirm that the password for your AI Expense Tracker account has been successfully changed.</p>
    <p>If you did not perform this change, please contact support or reset your password immediately.</p>
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
    <p>Review your expense records to identify categories for cost optimization.</p>
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
  sendPasswordResetEmail,
  sendPasswordChangedEmail,
  sendBudgetAlertEmail,
  sendAccountNotificationEmail
};
