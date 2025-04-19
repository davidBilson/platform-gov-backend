// profile.routes.js
import express from 'express';
import {
    createProfile,
    updateProfile,
    getProfileByUserId,
    deleteProfile
} from '../controllers/profile.controller.js';

const router = express.Router();

// Routes
router.post('/create', createProfile);

router.get('/:id', getProfileByUserId);

router.put('/update/:id', updateProfile);

router.delete('/delete/:id', deleteProfile);

export default router;