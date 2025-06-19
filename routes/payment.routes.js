import express from 'express';
import { 
    // completed
    savePaymentMethod, 
    getTransactionHistory, 
    getUserPaymentMethods, 
    fundProject, 
    deletePaymentMethod, 
    setDefaultPaymentMethod,
    getPlatformFee
} from '../controllers/payment/payment.controller.js';

const router = express.Router();
// completed
router.post('/save-payment-method', savePaymentMethod);
router.get('/get-user-payment-method/:id', getUserPaymentMethods);
router.put('/update-payment-method', setDefaultPaymentMethod);
router.get('/get-transaction-history/:id', getTransactionHistory)
router.delete('/delete-payment-method', deletePaymentMethod);
router.post('/fund-project', fundProject);

router.get('/get-platform-fee', getPlatformFee);

export default router;