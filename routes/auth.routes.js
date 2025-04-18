import express from 'express';
import { signUp, verifyEmail, sendPhoneVerificationCode } from '../controllers/auth.controller.js';


const router = express.Router();

/**
 * @route POST /api/auth/sign-up
 * @desc Register a new user
 * @access Public
 */
router.post('/sign-up', signUp);

/**
 * @route POST /api/auth/verify-email
 * @desc Verify user's email in the process of signing up
 * @access Public
 */
router.post('/verify-email', verifyEmail);

/**
 * @route POST /api/auth/verify-phone
 * @desc Verify user's phone number in the process of signing up
 * @access Public
 */
router.post('/verify-phone', sendPhoneVerificationCode);

/**
 * @route POST /api/auth/sign-in
 * @desc Sign in an existing user
 * @access Public
 */
router.post('/sign-in', (req, res) => {
    console.log('Sign in route hit');
});

/**
 * @route POST /api/auth/forgot-password
 * @desc process user forgot password
 * @access Public
 */
router.post('/forgot-password', (req, res) => {
    console.log('forgot password route hit');
});

/**
 * @route POST /api/auth/reset-password
 * @desc Allow user to reset their password
 * @access Public
 */
router.post('/reset-password', (req, res) => {
    console.log('reset password route hit');
});

export default router;