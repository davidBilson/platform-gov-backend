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

const router = express.Router();

// Public routes
router.get('/get-all', getAllJobs);

router.get('/get-single/:id', getJobById);

router.get('/get-jobs-by-user-id/user/:id', getJobsByUserId);

router.post('/create', createJob);

router.put('/update/:id', updateJob);

router.delete('/delete/:id', deleteJob);

router.patch('/change-job-status/:id/status', changeJobStatus);

router.post('/add-or-update-milestone/:id/milestones', addOrUpdateMilestone);

router.delete('/remove-milestone/:id/milestones/:milestoneId', removeMilestone);

export default router;