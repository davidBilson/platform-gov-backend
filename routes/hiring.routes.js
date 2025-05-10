import express from 'express';
import { createHiringOffer, acceptHiringOffer, getHiringOffer, contractorSignHiringOffer, getContractorSignature, getClientHiringOffers } from '../controllers/hiring.controller.js';

const router = express.Router();

router.post('/send-hiring-offer', createHiringOffer);

router.post('/get-hiring-offer', getHiringOffer);

router.get('/get-contractor-offer-signature/:id', getContractorSignature);

router.put('/contractor-sign-hiring-offer/:id', contractorSignHiringOffer);

router.put('/accept-hiring-offer/:id', acceptHiringOffer);

router.get('/get-client-hiring-offers/:id', getClientHiringOffers);

export default router;