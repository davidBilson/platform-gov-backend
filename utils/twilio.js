// utils/twilio.js
import twilio from 'twilio';
import dotenv from 'dotenv';

// Load environment variables
dotenv.config();

// Initialize Twilio client with credentials from environment variables
const client = twilio(
  process.env.TWILIO_ACCOUNT_SID,
  process.env.TWILIO_AUTH_TOKEN
);

/**
 * Send SMS message using Twilio
 * @param {string} phoneNumber - Recipient phone number (must include country code)
 * @param {string} message - Message to send
 * @returns {Promise} - Twilio message object
 */
const sendSMS = async (phoneNumber, message) => {
  try {
    // Normalize phone number: remove all non-digit characters except +
    let cleanedPhone = phoneNumber.replace(/[^\d+]/g, '');
    
    // Ensure phone number has proper format with country code
    let formattedPhone = cleanedPhone;
    if (!cleanedPhone.startsWith('+')) {
      formattedPhone = `+${cleanedPhone}`;
    }

    // Send the SMS via Twilio
    const result = await client.messages.create({
      body: message,
      from: process.env.TWILIO_PHONE_NUMBER, // Your Twilio phone number
      to: formattedPhone
    });

    return result;
  } catch (error) {
    console.error(`Failed to send SMS to ${phoneNumber}:`, error.message);
    throw error;
  }
};

export default {
  sendSMS
};