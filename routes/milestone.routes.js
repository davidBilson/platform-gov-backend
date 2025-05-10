import express from 'express';
import {
    addMilestone,
    getMilestones,
    getMilestone,
    completeMilestone,
    approveMilestone,
    markMilestonePaid,
    disputeMilestone
  } from '../controllers/contract/milestone.controller.js';
  

const router = express.Router();

router.post('/:id/milestones', addMilestone);
router.get('/:id/milestones', getMilestones);
router.put('/:contractId/milestones/:milestoneId/complete', completeMilestone);

  router.get('/:contractId/milestones/:milestoneId', getMilestone);
  router.put('/:contractId/milestones/:milestoneId/approve', approveMilestone);
  router.put('/:contractId/milestones/:milestoneId/mark-paid', markMilestonePaid);
  router.put('/:contractId/milestones/:milestoneId/dispute', disputeMilestone);

export default router;