const nodemailer = require('nodemailer');

// Dynamic Frontend URL resolution helper (Production vs Development)
const getFrontendUrl = () => {
  if (process.env.FRONTEND_URL && process.env.FRONTEND_URL.trim() !== '') {
    return process.env.FRONTEND_URL.trim().replace(/\/$/, '');
  }
  if (process.env.NODE_ENV === 'production' || process.env.VERCEL) {
    return 'https://aiexpensetrackerbeta.vercel.app';
  }
  return 'http://localhost:4200';
};

// Main helper to send email
const sendEmail = async (options) => {
  const host = process.env.EMAIL_HOST || 'smtp.gmail.com';
  const port = parseInt(process.env.EMAIL_PORT || '587');
  const user = process.env.EMAIL_USER;
  const pass = process.env.EMAIL_PASS || process.env.EMAIL_PASSWORD;
  const from = user || 'noreply@aiexpensetracker.com';

  console.log('\n[EMAIL DEBUG] ─── sendEmail called ───');
  console.log(`[EMAIL DEBUG] To: ${options.email}`);
  console.log(`[EMAIL DEBUG] Subject: ${options.subject}`);
  console.log(`[EMAIL DEBUG] FRONTEND_URL: ${getFrontendUrl()}`);

  const hasCredentials = user && pass;

  if (!hasCredentials) {
    console.warn('[EMAIL WARN] Missing SMTP credentials. Falling back to mock console email.');
    console.warn('[EMAIL WARN] Set EMAIL_USER and EMAIL_PASS in .env');
    const plainText = options.html.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim();
    console.log('\n========================================================================');
    console.log(`[MOCK EMAIL SENT]`);
    console.log(`To:      ${options.email}`);
    console.log(`Subject: ${options.subject}`);
    console.log(`Body:    ${plainText.slice(0, 350)}...`);
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

// Luxury Black & Royal Gold Centered HTML Email Layout Wrapper
const getHtmlLayout = (title, content) => {
  return `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${title}</title>
  <!--[if mso]>
  <style type="text/css">
    table { border-collapse: collapse; }
    .btn-td, .btn-a { padding: 16px 36px !important; }
  </style>
  <![endif]-->
</head>
<body style="margin: 0; padding: 0; background-color: #050505; color: #FFFFFF; font-family: 'Helvetica Neue', Helvetica, Arial, sans-serif; -webkit-font-smoothing: antialiased;">
  <table role="presentation" width="100%" border="0" cellspacing="0" cellpadding="0" style="background-color: #050505; width: 100%; min-height: 100vh; padding: 40px 10px;">
    <tr>
      <td align="center" valign="top">
        <!-- Main Card Container -->
        <table role="presentation" width="100%" border="0" cellspacing="0" cellpadding="0" style="max-width: 580px; background-color: #181818; border: 1px solid rgba(212, 175, 55, 0.25); border-radius: 16px; overflow: hidden; box-shadow: 0 20px 40px rgba(0,0,0,0.9);">
          
          <!-- Header Branding -->
          <tr>
            <td align="center" style="padding: 36px 30px 24px 30px; border-bottom: 1px solid rgba(212, 175, 55, 0.15);">
              <table role="presentation" border="0" cellspacing="0" cellpadding="0">
                <tr>
                  <td align="center" style="background-color: #D4AF37; width: 44px; height: 44px; border-radius: 10px; text-align: center; vertical-align: middle;">
                    <span style="color: #050505; font-size: 22px; font-weight: bold; line-height: 44px;">&#9819;</span>
                  </td>
                </tr>
              </table>
              <h1 style="margin: 16px 0 4px 0; color: #D4AF37; font-size: 20px; font-weight: 700; letter-spacing: 1px; text-transform: uppercase;">AI EXPENSE TRACKER</h1>
              <p style="margin: 0; color: #B5B5B5; font-size: 11px; font-weight: 600; letter-spacing: 2px; text-transform: uppercase;">ENTERPRISE FINTECH PLATFORM</p>
            </td>
          </tr>

          <!-- Content Body -->
          <tr>
            <td align="center" style="padding: 40px 36px; text-align: center;">
              ${content}
            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td align="center" style="padding: 24px 30px; background-color: #101010; border-top: 1px solid rgba(212, 175, 55, 0.15); text-align: center;">
              <p style="margin: 0 0 8px 0; color: #B5B5B5; font-size: 12px; line-height: 1.5;">
                &copy; ${new Date().getFullYear()} Centurion AI Expense Tracker. All rights reserved.
              </p>
              <p style="margin: 0; color: #777777; font-size: 11px;">
                This is an automated security transmission. Please do not reply directly.
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>
  `;
};

// Welcome email
const sendWelcomeEmail = async (email, username) => {
  const frontendUrl = getFrontendUrl();
  const content = `
    <h2 style="margin: 0 0 16px 0; color: #FFFFFF; font-size: 22px; font-weight: 700;">Welcome, ${username}!</h2>
    <p style="margin: 0 0 24px 0; color: #B5B5B5; font-size: 15px; line-height: 1.6;">
      Your executive account has been initialized. Track liquidity streams, manage corporate envelopes, and receive real-time portfolio suggestions powered by Google Gemini AI.
    </p>
    <table role="presentation" border="0" cellspacing="0" cellpadding="0" style="margin: 0 auto 20px auto;">
      <tr>
        <td align="center" style="background-color: #D4AF37; border-radius: 10px;">
          <a href="${frontendUrl}/login" target="_blank" style="display: inline-block; padding: 16px 36px; color: #050505; font-family: sans-serif; font-size: 15px; font-weight: 700; text-decoration: none; border-radius: 10px; letter-spacing: 0.5px;">ACCESS PORTAL</a>
        </td>
      </tr>
    </table>
  `;
  await sendEmail({
    email,
    subject: 'Welcome to Centurion AI Expense Tracker',
    html: getHtmlLayout('Welcome', content)
  });
};

// Verification Link for Registration
const sendVerificationEmail = async (email, username, token) => {
  const frontendUrl = getFrontendUrl();
  const verificationUrl = `${frontendUrl}/verify-email?token=${token}`;
  const content = `
    <h2 style="margin: 0 0 16px 0; color: #FFFFFF; font-size: 22px; font-weight: 700;">Verify Your Email Address</h2>
    <p style="margin: 0 0 20px 0; color: #B5B5B5; font-size: 15px; line-height: 1.6;">Hello <strong style="color: #FFFFFF;">${username}</strong>,</p>
    <p style="margin: 0 0 30px 0; color: #B5B5B5; font-size: 15px; line-height: 1.6;">
      Thank you for registering. Please click the button below to verify your email address and activate your executive dashboard access. This link is valid for <strong>24 hours</strong>.
    </p>
    <table role="presentation" border="0" cellspacing="0" cellpadding="0" style="margin: 0 auto 30px auto;">
      <tr>
        <td align="center" style="background-color: #D4AF37; border-radius: 10px;">
          <a href="${verificationUrl}" target="_blank" style="display: inline-block; padding: 16px 36px; color: #050505; font-family: sans-serif; font-size: 15px; font-weight: 700; text-decoration: none; border-radius: 10px; letter-spacing: 0.5px;">VERIFY EMAIL ADDRESS</a>
        </td>
      </tr>
    </table>
    <p style="margin: 0 0 10px 0; color: #B5B5B5; font-size: 13px; line-height: 1.5;">Or copy and paste this link in your browser:</p>
    <p style="margin: 0 0 30px 0; word-break: break-all; font-size: 12px;"><a href="${verificationUrl}" target="_blank" style="color: #D4AF37; text-decoration: underline;">${verificationUrl}</a></p>
  `;
  await sendEmail({
    email,
    subject: 'Verify Your Email Address - AI Expense Tracker',
    html: getHtmlLayout('Email Verification', content)
  });
};

// Password Reset Link
const sendPasswordResetEmail = async (email, username, token) => {
  const frontendUrl = getFrontendUrl();
  const resetUrl = `${frontendUrl}/reset-password?token=${token}`;
  const content = `
    <h2 style="margin: 0 0 16px 0; color: #FFFFFF; font-size: 22px; font-weight: 700;">Password Reset Request</h2>
    <p style="margin: 0 0 20px 0; color: #B5B5B5; font-size: 15px; line-height: 1.6;">Hello <strong style="color: #FFFFFF;">${username}</strong>,</p>
    <p style="margin: 0 0 30px 0; color: #B5B5B5; font-size: 15px; line-height: 1.6;">
      You requested to reset your account password for <strong>AI Expense Tracker</strong>. Click the button below to choose a new password. This link is secure and valid for <strong>1 hour</strong>.
    </p>

    <table role="presentation" border="0" cellspacing="0" cellpadding="0" style="margin: 0 auto 30px auto;">
      <tr>
        <td align="center" style="background-color: #D4AF37; border-radius: 10px;">
          <a href="${resetUrl}" target="_blank" style="display: inline-block; padding: 16px 36px; color: #050505; font-family: sans-serif; font-size: 15px; font-weight: 700; text-decoration: none; border-radius: 10px; letter-spacing: 0.5px;">RESET PASSWORD</a>
        </td>
      </tr>
    </table>

    <p style="margin: 0 0 10px 0; color: #B5B5B5; font-size: 13px; line-height: 1.5;">Or copy and paste this link in your browser:</p>
    <p style="margin: 0 0 30px 0; word-break: break-all; font-size: 12px;"><a href="${resetUrl}" target="_blank" style="color: #D4AF37; text-decoration: underline;">${resetUrl}</a></p>

    <p style="margin: 0; color: #777777; font-size: 13px; line-height: 1.5;">If you did not request a password reset, please ignore this email and your password will remain unchanged.</p>
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
    <h2 style="margin: 0 0 16px 0; color: #FFFFFF; font-size: 22px; font-weight: 700;">Security Alert: Password Updated</h2>
    <p style="margin: 0 0 20px 0; color: #B5B5B5; font-size: 15px; line-height: 1.6;">Hello <strong style="color: #FFFFFF;">${username}</strong>,</p>
    <p style="margin: 0 0 20px 0; color: #B5B5B5; font-size: 15px; line-height: 1.6;">
      This email confirms that the password for your <strong>AI Expense Tracker</strong> account was successfully updated.
    </p>
    <p style="margin: 0; color: #777777; font-size: 13px; line-height: 1.5;">
      If you did not perform this change, please reset your password immediately or contact executive security support.
    </p>
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
    <h2 style="margin: 0 0 16px 0; color: #FF5A5F; font-size: 22px; font-weight: 700;">Warning: Budget Exceeded</h2>
    <p style="margin: 0 0 20px 0; color: #B5B5B5; font-size: 15px; line-height: 1.6;">
      You have exceeded your monthly threshold for period <strong style="color: #FFFFFF;">${month}</strong>.
    </p>
    <div style="background-color: #251214; padding: 20px; border-radius: 10px; margin: 20px 0; border: 1px solid rgba(255, 90, 95, 0.4); text-align: left;">
      <p style="margin: 5px 0; color: #FFFFFF;"><strong>Budget Limit:</strong> ₹${budgetLimit.toFixed(2)}</p>
      <p style="margin: 5px 0; color: #FF5A5F;"><strong>Total Outflow:</strong> ₹${totalSpent.toFixed(2)}</p>
    </div>
    <p style="margin: 0; color: #B5B5B5; font-size: 14px;">Review your expense records to optimize high-outflow categories.</p>
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
    <h2 style="margin: 0 0 16px 0; color: #D4AF37; font-size: 22px; font-weight: 700;">${subject}</h2>
    <p style="margin: 0; color: #B5B5B5; font-size: 15px; line-height: 1.6;">${message}</p>
  `;
  await sendEmail({
    email,
    subject: `Account Notice: ${subject}`,
    html: getHtmlLayout('Account Notice', content)
  });
};

module.exports = {
  getFrontendUrl,
  sendWelcomeEmail,
  sendVerificationEmail,
  sendPasswordResetEmail,
  sendPasswordChangedEmail,
  sendBudgetAlertEmail,
  sendAccountNotificationEmail
};
