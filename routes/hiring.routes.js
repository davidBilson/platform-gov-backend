import express from 'express';
import { createHiringOffer, acceptHiringOffer } from '../controllers/hiring.controller';

const router = express.Router();

router.post('/', createHiringOffer);

router.put('/:id/accept', acceptHiringOffer);

export default router;