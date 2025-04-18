import User from '../models/user.model.js';
import bcrypt from 'bcrypt';
import crypto from 'crypto';
// import twilio from '../utils/twilio.js';
import emailService from '../utils/nodemailer.js';


export const signUp = async (req, res, next) => {
  try {
    const { firstName, lastName, email, phoneNumber, password, role } = req.body;

    if (role === 'admin') {
      return res.status(403).json({ message: 'Cannot create admin accounts through this route.' });
    }

    // Check if user with the email already exists
    const existingUser = await User.findOne({ email });
    
    if (existingUser) {
      return res.status(409).json({ message: 'Email already in use' });
    }
    
    // Hash  password
    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(password, salt);
    
    // Generate verification codes (6 digits)
    const generateSixDigitCode = () => Math.floor(100000 + Math.random() * 900000).toString();
    const emailVerificationCode = generateSixDigitCode();
    const phoneVerificationCode = generateSixDigitCode();
    
    // Create new user
    const newUser = await User.create({
      name: `${firstName} ${lastName}`,
      email,
      phoneNumber,
      password: hashedPassword,
      emailVerificationCode,
      phoneVerificationCode,
      role: role || 'contractor' // Use provided role or default to contractor
    });
    
    // Send email verification code
    try {
      await emailService.sendVerificationCode(newUser.email, emailVerificationCode);
      res.status(200).json({
        status: 'success',
        message: 'Verification code sent to your email. Please check your inbox.'
      })
    } catch (emailError) {
      console.error('Error sending email:', emailError);
      return res.status(500).json({ message: 'Failed to send verification code. Please try again.' });
    }
    
    const userData = newUser.toObject();
    delete userData.password;
    delete userData.emailVerificationCode;
    delete userData.phoneVerificationCode;
    
    res.status(201).json({
      status: 'success',
      message: 'User registered successfully. Please verify your email.',
      data: {
        userId: userData._id,
        email: userData.email,
        phoneNumber: userData.phoneNumber
      }
    });
  } catch (error) {
    next(error);
  }
};


export const verifyEmail = async (req, res, next) => {
  try {
    const { userId, code } = req.body;
    
    const user = await User.findById(userId);
    
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }
    
    if (user.emailVerificationCode !== code) {
      return res.status(400).json({ message: 'Invalid verification code' });
    }
    
    // Mark email as verified and clear verification code
    user.isEmailVerified = true;
    user.emailVerificationCode = undefined;
    await user.save();
    
    res.status(200).json({
      status: 'success',
      message: 'Email verified successfully',
      data: {
        userId: user._id,
        email: user.email,
        phoneNumber: user.phoneNumber
      }
    });
  } catch (error) {
    next(error);
  }
};

export const sendPhoneVerificationCode = async (req, res, next) => {
  try {
    const { userId } = req.body;
    
    const user = await User.findById(userId);
    
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }
    
    if (!user.isEmailVerified) {
      return res.status(400).json({ message: 'Email must be verified first' });
    }
    
    // Generate a new phone verification code if needed
    if (!user.phoneVerificationCode) {
      user.phoneVerificationCode = Math.floor(100000 + Math.random() * 900000).toString();
      await user.save();
    }
    
    // Send verification code via Twilio
    try {
      // You would use Twilio or similar service here
      // await twilio.sendSMS(
      //   user.phoneNumber, 
      //   `Your verification code is: ${user.phoneVerificationCode}`
      // );
    } catch (smsError) {
      console.error('Error sending SMS:', smsError);
      return res.status(500).json({ message: 'Failed to send verification code. Please try again.' });
    }
    
    res.status(200).json({
      status: 'success',
      message: 'Verification code sent to your phone number'
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Verify phone controller
 */
export const verifyPhone = async (req, res, next) => {
  try {
    const { userId, code } = req.body;
    
    const user = await User.findById(userId);
    
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }
    
    if (!user.isEmailVerified) {
      return res.status(400).json({ message: 'Email must be verified first' });
    }
    
    if (user.phoneVerificationCode !== code) {
      return res.status(400).json({ message: 'Invalid verification code' });
    }
    
    // Mark phone as verified and clear verification code
    user.isPhoneVerified = true;
    user.phoneVerificationCode = undefined;
    await user.save();
    
    res.status(200).json({
      status: 'success',
      message: 'Phone number verified successfully',
      data: {
        userId: user._id,
        isPhoneVerified: true,
        isEmailVerified: user.isEmailVerified
      }
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Resend email verification code
 */
export const resendEmailVerification = async (req, res, next) => {
  try {
    const { userId } = req.body;
    
    const user = await User.findById(userId);
    
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }
    
    if (user.isEmailVerified) {
      return res.status(400).json({ message: 'Email already verified' });
    }
    
    // Generate a new verification code
    const newCode = Math.floor(100000 + Math.random() * 900000).toString();
    user.emailVerificationCode = newCode;
    await user.save();
    
    // Send email with the new code
    // Placeholder for email sending logic
    try {
      // You would implement the actual email sending here
      console.log(`New email verification code: ${newCode} sent to ${user.email}`);
      // Simulate email sending success
    } catch (emailError) {
      console.error('Error sending email:', emailError);
      return res.status(500).json({ message: 'Failed to send verification code. Please try again.' });
    }
    
    res.status(200).json({
      status: 'success',
      message: 'Verification code resent to your email'
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Resend phone verification code
 */
export const resendPhoneVerification = async (req, res, next) => {
  try {
    const { userId } = req.body;
    
    const user = await User.findById(userId);
    
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }
    
    if (!user.isEmailVerified) {
      return res.status(400).json({ message: 'Email must be verified first' });
    }
    
    if (user.isPhoneVerified) {
      return res.status(400).json({ message: 'Phone already verified' });
    }
    
    // Generate a new verification code
    const newCode = Math.floor(100000 + Math.random() * 900000).toString();
    user.phoneVerificationCode = newCode;
    await user.save();
    
    // Send SMS with the new code
    try {
      // You would use Twilio or similar service here
      // await twilio.sendSMS(
      //   user.phoneNumber, 
      //   `Your verification code is: ${newCode}`
      // );
    } catch (smsError) {
      console.error('Error sending SMS:', smsError);
      return res.status(500).json({ message: 'Failed to send verification code. Please try again.' });
    }
    
    res.status(200).json({
      status: 'success',
      message: 'Verification code resent to your phone number'
    });
  } catch (error) {
    next(error);
  }
};
/**
 * User sign-in controller
 */
export const signIn = async (req, res, next) => {
  try {
    const { email, password } = req.body;
    
    // Find user by email and explicitly select password field
    const user = await User.findOne({ email }).select('+password');
    
    if (!user) {
      const error = new Error('Invalid email or password');
      error.statusCode = 401;
      throw error;
    }
    
    // Compare passwords
    const isPasswordValid = await bcrypt.compare(password, user.password);
    
    if (!isPasswordValid) {
      const error = new Error('Invalid email or password');
      error.statusCode = 401;
      throw error;
    }
    
    // Create a user object without sensitive information
    const userData = user.toObject();
    delete userData.password;
    delete userData.emailVerificationCode;
    delete userData.phoneVerificationCode;
    delete userData.resetToken;
    delete userData.resetTokenExpiry;
    
    res.status(200).json({
      status: 'success',
      message: 'User logged in successfully',
      data: {
        user: userData
      }
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Request password reset controller
 */
export const requestPasswordReset = async (req, res, next) => {
  try {
    const { email } = req.body;
    
    const user = await User.findOne({ email });
    
    if (!user) {
      // Don't reveal if user exists or not for security
      return res.status(200).json({
        status: 'success',
        message: 'If your email is registered, you will receive a password reset link'
      });
    }
    
    // Generate reset token
    const resetToken = crypto.randomBytes(32).toString('hex');
    const resetTokenExpiry = new Date(Date.now() + 3600000); // 1 hour from now
    
    user.resetToken = resetToken;
    user.resetTokenExpiry = resetTokenExpiry;
    await user.save();
    
    // In a real application, you would send an email with the reset token
    
    res.status(200).json({
      status: 'success',
      message: 'If your email is registered, you will receive a password reset link'
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Reset password controller
 */
export const resetPassword = async (req, res, next) => {
  try {
    const { resetToken, newPassword } = req.body;
    
    const user = await User.findOne({
      resetToken,
      resetTokenExpiry: { $gt: Date.now() }
    });
    
    if (!user) {
      const error = new Error('Invalid or expired reset token');
      error.statusCode = 400;
      throw error;
    }
    
    // Hash the new password
    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(newPassword, salt);
    
    user.password = hashedPassword;
    user.resetToken = undefined;
    user.resetTokenExpiry = undefined;
    await user.save();
    
    res.status(200).json({
      status: 'success',
      message: 'Password reset successfully'
    });
  } catch (error) {
    next(error);
  }
};