import express from 'express';
import {
  trackJobStatus,
  trackHiringStatus,
  trackJobApplicationStatus,
  updateJobApplicationStatus
} from '../controllers/status.controller.js';

const router = express.Router();

router.get('/track-job-status/:id', trackJobStatus);

router.get('/track-hiring-status', trackHiringStatus);

router.get('/track-job-application-status', trackJobApplicationStatus);

router.put('/update-job-application-status', updateJobApplicationStatus);


// // LATER THINGS
// router.get('/track-contract-status')
// router.get('/update-contract-status')

export default router;