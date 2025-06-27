import express from 'express';
import {
    savePaymentMethod,
    getTransactionHistory,
    getUserPaymentMethods,
    deletePaymentMethod,
    updateDefaultPaymentMethod,
    getPlatformFee,
    saveBankAccount,
    getPayoutMethods,
    createFreelancerAccount,
    getPendingPayouts,
    createOnboardingLink,
    getAccountStatus,
} from '../controllers/payment/payment.controller.js';
import { fundProject, getClientFunds, getContractorFunds, getWithdrawableFunds, releaseFunds, withdrawFunds } from '../controllers/payment/allFunds.controller.js';
import { fetchWithdrawals } from '../controllers/payment/withdrawals.controller.js';

const router = express.Router();

router.get('/get-user-payment-method/:id', getUserPaymentMethods);
router.get('/get-platform-fee', getPlatformFee);
router.get('/get-transaction-history/:id', getTransactionHistory)
router.get('/get-payout-methods/:id', getPayoutMethods);
router.get('/get-pending-payouts/:id', getPendingPayouts);
router.get('/get-account-status/:id', getAccountStatus);
router.get('/get-withdrawable-funds/:id', getWithdrawableFunds);
router.get('/get-contractor-funds/:id', getContractorFunds);
router.get('/get-client-funds/:id', getClientFunds);
router.get('/get-user-withdrawals/:id', fetchWithdrawals); // User's withdrawals

router.post('/save-payment-method', savePaymentMethod);
router.post('/fund-project', fundProject);
router.post('/save-bank-account', saveBankAccount);
router.post('/create-freelancer-account', createFreelancerAccount);
router.post('/release-funds', releaseFunds);
router.post('/create-onboarding-link/:id', createOnboardingLink)
router.post('/withdraw-funds/:id', withdrawFunds);

router.put('/update-payment-method', updateDefaultPaymentMethod);

router.delete('/delete-payment-method', deletePaymentMethod);

export default router;