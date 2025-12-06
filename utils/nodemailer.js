import nodemailer from 'nodemailer';
import dotenv from 'dotenv';
import {
  verificationCodeEmail,
  vettingRequestEmail,
  vettingActivationNotificationEmail
} from './htmlEmails.js';

dotenv.config({ path: './config/.env' });

const transporter = nodemailer.createTransport({
  host: process.env.EMAIL_HOST,
  port: parseInt(process.env.EMAIL_PORT),
  secure: process.env.EMAIL_SECURE === 'true',
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASS,
  },
  // Connection timeout settings for Render compatibility
  connectionTimeout: 60000, // 60 seconds (default is 2000ms)
  greetingTimeout: 30000,   // 30 seconds (default is 5000ms)
  socketTimeout: 60000,     // 60 seconds (default is unlimited)
  // Connection pool settings for better performance
  pool: true,
  maxConnections: 5,
  maxMessages: 100,
  // Debug option (set to true in development if needed)
  debug: process.env.NODE_ENV === 'development',
  logger: process.env.NODE_ENV === 'development'
});

const emailService = {
  sendEmail: async ({ to, subject, text, from }) => {
    const mailOptions = {
      from: from || process.env.EMAIL_FROM || process.env.EMAIL_USER,
      to,
      subject,
      html: text,
    };

    try {
      const info = await transporter.sendMail(mailOptions);
      return info;
    } catch (error) {
      console.error('Error:', error);
      throw new Error(`Failed to send email: ${error.message}`);
    }
  },

  sendVerificationCode: async (to, code) => {
    const subject = 'Email Verification Code';
    const html = verificationCodeEmail(code);

    return emailService.sendEmail({ to, subject, text: html });
  },

  verifyConnection: async () => {
    try {
      await transporter.verify();
      console.log('Email service is ready to send messages');
      return true;
    } catch (error) {
      console.error('Email service error:', error);
      return false;
    }
  },

  /**
   * Send vetting request email to a vetter
   */
  sendVettingRequestEmail: async (vetterEmail, consultantName, profileUrl, confirmationUrl, rejectionUrl, isReminder = false) => {
    const subject = isReminder
      ? `Reminder: Please Confirm ${consultantName}'s GovLink Global Profile`
      : `Please Confirm ${consultantName}'s GovLink Global Profile`;

    const html = vettingRequestEmail(consultantName, profileUrl, confirmationUrl, rejectionUrl, isReminder);

    return emailService.sendEmail({ to: vetterEmail, subject, text: html });
  },

  /**
   * Send vetting activation notification to consultant
   */
  sendVettingActivationNotification: async (consultantEmail, consultantName, vettingCount) => {
    const subject = 'Your GovLink Global Profile is Now Active!';
    const html = vettingActivationNotificationEmail(consultantName, vettingCount, process.env.FRONTEND_URL);

    return emailService.sendEmail({ to: consultantEmail, subject, text: html });
  },

  /**
   * Send vetting reminder email (same as request but marked as reminder)
   */
  sendVettingReminderEmail: async (vetterEmail, consultantName, profileUrl, confirmationUrl, rejectionUrl) => {
    return emailService.sendVettingRequestEmail(vetterEmail, consultantName, profileUrl, confirmationUrl, rejectionUrl, true);
  }
};

export default emailService;