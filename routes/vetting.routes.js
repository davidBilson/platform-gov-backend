import express from 'express';
import {
    addVetter,
    getMyVetters,
    getVettingStatus,
    confirmVetting,
    rejectVetting,
    removeVetter,
    resendVettingEmail,
    getVetterByToken
} from '../controllers/vetting.controller.js';

const router = express.Router();

// Public routes (no authentication required)
router.get('/vetter-by-token/:token', getVetterByToken);
router.post('/confirm/:token', confirmVetting);
router.post('/reject/:token', rejectVetting);

// Protected routes (consultant must be authenticated)
router.post('/add-vetter', addVetter);
router.get('/my-vetters/:consultantId', getMyVetters);
router.get('/status/:consultantId', getVettingStatus);
router.delete('/remove-vetter/:vetterId', removeVetter);
router.post('/resend-email/:vetterId', resendVettingEmail);

export default router;


