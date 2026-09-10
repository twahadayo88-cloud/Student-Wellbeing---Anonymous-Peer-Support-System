const nodemailer = require('nodemailer');
const env = require('../config/env.config');
const logger = require('./logger');

/**
 * PeerBridge — NodeMailer Configuration
 * =====================================
 * Handles all outgoing system emails (OTPs, Notifications).
 */

const transporter = nodemailer.createTransport({
  host: env.smtp?.host || 'smtp.gmail.com',
  port: env.smtp?.port || 587,
  secure: env.smtp?.port === 465, // true for 465, false for other ports
  auth: {
    user: env.smtp?.user,
    pass: env.smtp?.pass,
  },
});

/**
 * Send a styled HTML OTP email.
 * 
 * @param {string} to - Recipient email
 * @param {string} otp - 6-digit code
 */
async function sendOTPEmail(to, otp) {
  const mailOptions = {
    from: `"PeerBridge Security" <${env.smtp?.user}>`,
    to: to,
    subject: "🔐 Your PeerBridge Password Reset Code",
    html: `
      <div style="font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; max-width: 600px; margin: auto; padding: 20px; border: 1px solid #e0e0e0; border-radius: 10px;">
        <div style="text-align: center; margin-bottom: 20px;">
          <h1 style="color: #4f46e5; margin: 0;">PeerBridge</h1>
          <p style="color: #6b7280; font-size: 14px;">Student Wellbeing & Support</p>
        </div>
        
        <div style="background-color: #f9fafb; padding: 20px; border-radius: 8px; border: 1px solid #f3f4f6;">
          <h2 style="color: #111827; margin-top: 0; font-size: 20px; text-align: center;">Your Verification Code</h2>
          <p style="color: #374151; line-height: 1.6; text-align: center;">
            We received a request to reset the password for your PeerBridge account. 
            Use the code below to proceed. This code will expire in <strong>15 minutes</strong>.
          </p>
          
          <div style="text-align: center; margin: 30px 0;">
            <span style="font-size: 36px; font-weight: bold; letter-spacing: 8px; color: #4f46e5; background: #ffffff; padding: 10px 20px; border: 2px dashed #4f46e5; border-radius: 5px;">
              ${otp}
            </span>
          </div>
          
          <p style="color: #ef4444; font-size: 12px; text-align: center;">
            ⚠️ If you did not request this, please ignore this email or contact support if you believe your account is compromised.
          </p>
        </div>
        
        <div style="text-align: center; margin-top: 30px; border-top: 1px solid #e0e0e0; padding-top: 20px;">
          <p style="color: #9ca3af; font-size: 12px; margin: 0;">
            &copy; 2026 PeerBridge University Platform. All Rights Reserved.
          </p>
        </div>
      </div>
    `,
  };

  try {
    await transporter.sendMail(mailOptions);
    logger.info(`OTP Email sent to ${to}`);
    return true;
  } catch (error) {
    logger.error(`Failed to send OTP Email to ${to}`, { error: error.message });
    // In dev, we might log the OTP if SMTP is not configured
    if (process.env.NODE_ENV === 'development') {
      console.log(`[DEV MODE] SMTP not configured. OTP for ${to} is: ${otp}`);
    }
    return false;
  }
}

async function sendDeletionWarningEmail(to, cancelLink) {
  const mailOptions = {
    from: `"PeerBridge Privacy" <${env.smtp?.user}>`,
    to: to,
    subject: "⚠️ Your PeerBridge Account will be deleted in 24 hours",
    html: `
      <div style="font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; max-width: 600px; margin: auto; padding: 20px; border: 1px solid #e0e0e0; border-radius: 10px;">
        <div style="text-align: center; margin-bottom: 20px;">
          <h1 style="color: #ef4444; margin: 0;">PeerBridge Privacy</h1>
        </div>
        
        <div style="background-color: #fef2f2; padding: 20px; border-radius: 8px; border: 1px solid #fee2e2;">
          <h2 style="color: #991b1b; margin-top: 0; font-size: 20px; text-align: center;">Account Deletion Notice</h2>
          <p style="color: #4b5563; line-height: 1.6; text-align: center;">
            This is a final notice that your PeerBridge account and all associated data (messages, mood entries, profile) will be <strong>permanently deleted in 24 hours</strong>.
          </p>
          
          <div style="text-align: center; margin: 30px 0;">
            <a href="${cancelLink}" style="background-color: #4f46e5; color: #ffffff; padding: 12px 24px; border-radius: 6px; text-decoration: none; font-weight: bold; display: inline-block;">
              Cancel Deletion Request
            </a>
          </div>
          
          <p style="color: #6b7280; font-size: 12px; text-align: center;">
            If you do not take action, your data will be unrecoverable after the deletion window closes.
          </p>
        </div>
      </div>
    `,
  };

  try {
    await transporter.sendMail(mailOptions);
    logger.info(`Deletion Warning Email sent to ${to}`);
    return true;
  } catch (error) {
    logger.error(`Failed to send Deletion Warning Email to ${to}`, { error: error.message });
    return false;
  }
}

module.exports = {
  sendOTPEmail,
  sendDeletionWarningEmail,
};
