// src/utils/email.js
import nodemailer from 'nodemailer';
import dotenv from 'dotenv';

dotenv.config({ path: './config/.env' });

const transporter = nodemailer.createTransport({
  host: process.env.EMAIL_HOST,
  port: parseInt(process.env.EMAIL_PORT),
  secure: process.env.EMAIL_SECURE === 'true',
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASS,
  },
});

const emailService = {
  sendEmail: async ({ to, subject, text }) => {
    const mailOptions = {
      to,
      subject,
      html: text,
    };

    try {
      const info = await transporter.sendMail(mailOptions);
      console.log('Email sent: ' + info.response);
      return info;
    } catch (error) {
      console.error('Error:', error);
      throw new Error(`Failed to send email: ${error.message}`);
    }
  },

  sendVerificationCode: async (to, code) => {
    const subject = 'Email Verification Code';
    const text = `Your authentication code is ${code}. This code will expire in 10 minutes.`;

    return emailService.sendEmail({ to, subject, text });
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
  }
};

export default emailService;