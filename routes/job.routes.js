import express from 'express';
import {
  getAllJobs,
  getJobById,
  getJobsByUserId,
  createJob,
  updateJob,
  deleteJob,
  changeJobStatus,
  addOrUpdateMilestone,
  removeMilestone
} from '../controllers/job.create.controller.js';

import {
  createJobApplication,
  saveJobApplicationDraft,
  deleteJobApplicationDraft,
  getApplicationsByFreelancerId,
  getApplicationsByJobId
} from '../controllers/job.apply.controller.js';

import multer from 'multer';
import path from 'path';
import fs from 'fs';

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const uploadDir = path.join(process.cwd(), 'uploads', 'job-applications');
    
    if (!fs.existsSync(uploadDir)) {
      fs.mkdirSync(uploadDir, { recursive: true });
    }
    
    cb(null, uploadDir);
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    const ext = path.extname(file.originalname);
    cb(null, file.fieldname + '-' + uniqueSuffix + ext);
  }
});

const upload = multer({ storage });

const router = express.Router();

router.get('/get-all', getAllJobs);
router.get('/get-single/:id', getJobById);
router.get('/get-jobs-by-user-id/user/:id', getJobsByUserId); //fetch jobs created by client
router.post('/create', createJob);
router.put('/update/:id', updateJob);
router.delete('/delete/:id', deleteJob);
router.patch('/change-job-status/:id/status', changeJobStatus);
router.post('/add-or-update-milestone/:id/milestones', addOrUpdateMilestone);
router.delete('/remove-milestone/:id/milestones/:milestoneId', removeMilestone);

router.post('/applications/submit', upload.single('attachment'), createJobApplication);
router.post('/applications/save-draft', upload.single('attachment'), saveJobApplicationDraft);
router.delete('/applications/delete-draft/:id', deleteJobApplicationDraft);

// get applications received from different contractors for a particular job here you get applications by jobId
router.get('/applications/job/:id', getApplicationsByJobId);

// Get applications sent by a single user (contractor) [HIGHPRIORITY]
router.get('/applications/contractor/:id', getApplicationsByFreelancerId);
router.post('/applications/save-draft', upload.single('attachment'), saveJobApplicationDraft);
router.delete('/applications/delete-draft/:id', deleteJobApplicationDraft);

export default router;