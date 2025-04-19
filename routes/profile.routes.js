// profile.routes.js
import express from 'express';
import {
    createProfile,
    updateProfile,
    getMyProfile,
    getProfileByUserId,
    deleteProfile,
    searchProfiles,
    getAllSkills,
    getAllExpertise,
    getAllCertifications
} from '../controllers/profile.controller.js';

const router = express.Router();

// Routes
router.post('/create', createProfile);

router.get('/:userId', getProfileByUserId);

router.put('/update/:id', updateProfile);

router.delete('/delete/:id', deleteProfile);

router.get('/me', getMyProfile);

router.get('/search', searchProfiles);

router.get('/skills', getAllSkills);

router.get('/expertise', getAllExpertise);

router.get('/certifications', getAllCertifications);


export default router;