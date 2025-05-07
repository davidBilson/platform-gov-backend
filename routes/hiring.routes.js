import express from 'express';
import { createHiringOffer, acceptHiringOffer } from '../controllers/hiring.controller.js';

const router = express.Router();

router.post('/sending-hiring-contract', createHiringOffer);

router.put('/:id/accept', acceptHiringOffer);

export default router;