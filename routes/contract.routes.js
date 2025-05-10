import express from 'express';
import { createContract, getSingleContract } from '../controllers/contract/contract.controller.js';

const router = express.Router();

router.post('/create-contract', createContract);

router.post('/get-single-contract', getSingleContract);


export default router;