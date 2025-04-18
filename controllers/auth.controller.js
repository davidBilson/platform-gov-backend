import User from '../models/user.model.js';
import bcrypt from 'bcrypt';
import crypto from 'crypto';
import twilio from '../utils/twilio.js';
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
    
    // Hash password
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
    
    // Prepare user data for response
    const userData = newUser.toObject();
    delete userData.password;
    delete userData.emailVerificationCode;
    delete userData.phoneVerificationCode;
    
    // Send email verification code
    try {
      await emailService.sendVerificationCode(newUser.email, emailVerificationCode);
      
      // Only send one response after everything is done
      return res.status(201).json({
        status: 'success',
        message: 'User registered successfully. Please verify your email.',
        data: {
          userId: userData._id,
          email: userData.email,
          phoneNumber: userData.phoneNumber
        }
      });
    } catch (emailError) {
      console.error('Error sending email:', emailError);
      // If email fails, the user was created but we couldn't send verification
      // We should still return the user ID so the frontend can handle verification
      return res.status(201).json({ 
        status: 'partial_success',
        message: 'Account created but verification email could not be sent. Please request a new code.',
        data: {
          userId: userData._id,
          email: userData.email,
          phoneNumber: userData.phoneNumber
        }
      });
    }
  } catch (error) {
    console.error('Signup error:', error);
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
      await twilio.sendSMS(
        user.phoneNumber, 
        `Your verification code is: ${user.phoneVerificationCode}`
      );
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
      await emailService.sendVerificationCode(newUser.email, newCode);

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
      await twilio.sendSMS(
        user.phoneNumber, 
        `Your verification code is: ${newCode}`
      );
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
    
    if (!email || !password) {
      return res.status(400).json({
        status: 'error',
        message: 'Email and password are required'
      });
    }
    
    // Find user by email and explicitly select password field
    const user = await User.findOne({ email }).select('+password');
    
    if (!user) {
      return res.status(401).json({
        status: 'error',
        message: 'Invalid email or password'
      });
    }
    
    // Compare passwords
    const isPasswordValid = await bcrypt.compare(password, user.password);
    
    if (!isPasswordValid) {
      return res.status(401).json({
        status: 'error',
        message: 'Invalid email or password'
      });
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
    console.error('Sign-in error:', error);
    next(error);
  }
};

// Updated requestPasswordReset controller
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
    
    // Generate reset token - using a 6-digit code for easier user entry
    const resetToken = Math.floor(100000 + Math.random() * 900000).toString();
    const resetTokenExpiry = new Date(Date.now() + 3600000); // 1 hour from now
    
    user.resetToken = resetToken;
    user.resetTokenExpiry = resetTokenExpiry;
    await user.save();
    
    // Send email with reset token
    try {
      await emailService.sendVerificationCode(user.email, resetToken);
      
      return res.status(200).json({
        success: true,
        status: 'success',
        message: 'Password reset instructions sent to your email'
      });
    } catch (emailError) {
      console.error('Error sending reset email:', emailError);
      return res.status(500).json({
        success: false,
        status: 'error',
        message: 'Failed to send reset email. Please try again.'
      });
    }
  } catch (error) {
    console.error('Request password reset error:', error);
    next(error);
  }
};

// Updated resetPassword controller
export const resetPassword = async (req, res, next) => {
  try {
    const { resetToken, email, newPassword } = req.body;
    
    const user = await User.findOne({
      email,
      resetToken,
      resetTokenExpiry: { $gt: Date.now() }
    });
    
    if (!user) {
      return res.status(400).json({ 
        success: false,
        status: 'error',
        message: 'Invalid or expired reset token' 
      });
    }
    
    // Hash the new password
    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(newPassword, salt);
    
    user.password = hashedPassword;
    user.resetToken = undefined;
    user.resetTokenExpiry = undefined;
    await user.save();
    
    res.status(200).json({
      success: true,
      status: 'success',
      message: 'Password reset successfully'
    });
  } catch (error) {
    console.error('Reset password error:', error);
    next(error);
  }
};

// Verify reset token endpoint to validate reset token before password reset
export const verifyResetToken = async (req, res, next) => {
  try {
    const { email, resetToken } = req.body;
    
    if (!email || !resetToken) {
      return res.status(400).json({ 
        success: false,
        message: 'Email and reset token are required' 
      });
    }
    
    console.log('Verifying token:', { email, resetToken }); // Debugging log
    
    const user = await User.findOne({
      email,
      resetToken,
      resetTokenExpiry: { $gt: Date.now() }
    });
    
    if (!user) {
      console.log('User not found or token expired'); // Debugging log
      return res.status(400).json({ 
        success: false,
        message: 'Invalid or expired reset token' 
      });
    }
    
    console.log('Token verified successfully'); // Debugging log
    
    res.status(200).json({
      success: true,
      message: 'Token verified successfully'
    });
  } catch (error) {
    console.error('Verify reset token error:', error);
    next(error);
  }
};