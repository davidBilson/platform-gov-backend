import express from 'express';
import { createContract, getSingleContract, getContracts, endContract, startContract, confirmPaymentAmount, initPayAmount, editContractPrice } from '../controllers/contract/contract.controller.js';

const router = express.Router();

router.post('/create-contract', createContract);
router.post('/get-single-contract', getSingleContract);

router.put('/start-contract/:id', startContract);
router.put('/edit-contract-job-price/:id', editContractPrice);
router.put('/init-pay-amount/:id', initPayAmount)
router.put('/confirm-payment-amount/:id', confirmPaymentAmount);

router.put('/:contractId/end', endContract);

router.get('/get-contracts/:id', getContracts);

export default router;