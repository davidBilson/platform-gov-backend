import express from 'express';
import { createContract, getSingleContract, getContractorContracts } from '../controllers/contract/contract.controller.js';

const router = express.Router();

router.post('/create-contract', createContract);

router.post('/get-single-contract', getSingleContract);

router.get('/get-contractor-contracts/:id', getContractorContracts);


export default router;