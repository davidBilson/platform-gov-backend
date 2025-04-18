import express from 'express';
import { 
    signUp, 
    signIn, 
    verifyEmail, 
    sendPhoneVerificationCode,
    requestPasswordReset,
    resetPassword,
    verifyResetToken
} from '../controllers/auth.controller.js';


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

router.post('/resend-verification-email', (req, res) => console.log('hit'));

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
router.post('/sign-in', signIn);

/**
 * @route POST forgot password
 * @desc process user forgot password
 * @access Public
 */
router.post('/request-password-reset', requestPasswordReset);
router.post('/verify-reset-token', verifyResetToken);
router.post('/reset-password', resetPassword);



export default router;