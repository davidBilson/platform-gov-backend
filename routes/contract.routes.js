import express from 'express';
import { createContract, getSingleContract, getContracts, endContract } from '../controllers/contract/contract.controller.js';

const router = express.Router();

router.post('/create-contract', createContract);

router.post('/get-single-contract', getSingleContract);

router.get('/get-contracts/:id', getContracts);

router.put('/:contractId/end', endContract);

export default router;