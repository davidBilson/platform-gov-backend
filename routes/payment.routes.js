import express from 'express';
import {
    savePaymentMethod,
    getTransactionHistory,
    getUserPaymentMethods,
    fundProject,
    deletePaymentMethod,
    updateDefaultPaymentMethod,
    getPlatformFee,
    saveBankAccount,
    getPayoutMethods,
    createFreelancerAccount,
    releaseFunds,
    getPendingPayouts,
    approvePayout,
    createOnboardingLink,
    getAccountStatus,
    withdrawFunds
} from '../controllers/payment/payment.controller.js';

const router = express.Router();

router.get('/get-user-payment-method/:id', getUserPaymentMethods);
router.get('/get-platform-fee', getPlatformFee);
router.get('/get-transaction-history/:id', getTransactionHistory)
router.get('/get-payout-methods/:id', getPayoutMethods);
router.get('/get-pending-payouts/:id', getPendingPayouts);
router.get('/get-account-status/:id', getAccountStatus);

router.post('/save-payment-method', savePaymentMethod);
router.post('/fund-project', fundProject);
router.post('/save-bank-account', saveBankAccount);
router.post('/create-freelancer-account', createFreelancerAccount);
router.post('/release-funds', releaseFunds);
router.post('/withdraw-funds', withdrawFunds);
router.post('/approve-payout/:id', approvePayout);
router.post('/create-onboarding-link/:id', createOnboardingLink)

router.put('/update-payment-method', updateDefaultPaymentMethod);

router.delete('/delete-payment-method', deletePaymentMethod);

export default router;