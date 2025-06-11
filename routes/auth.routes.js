import express from 'express';
import { 
    signUp, 
    signIn,
    getUserSuspendedStatus,
    verifyEmail, 
    sendPhoneVerificationCode,
    verifyPhone,
    resendEmailVerification,
    resendPhoneVerification,
    requestPasswordReset,
    resetPassword,
    verifyResetToken
} from '../controllers/auth.controller.js';

const router = express.Router();

router.post('/sign-up', signUp);

router.post('/sign-in', signIn);

router.get('/check-user-suspended/:id', getUserSuspendedStatus);

router.post('/verify-email', verifyEmail);

router.post('/resend-verification-email', resendEmailVerification);

router.post('/send-phone-verification', sendPhoneVerificationCode);

router.post('/verify-phone', verifyPhone);

router.post('/resend-verification-phone', resendPhoneVerification);

router.post('/request-password-reset', requestPasswordReset);

router.post('/verify-reset-token', verifyResetToken);

router.post('/reset-password', resetPassword);

export default router;