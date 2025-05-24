import express from 'express';
import {
  createRating,
  getUserRatings,
  getRatingById,
  getContractRatings,
  getJobRatings
} from '../controllers/rating/rating.controller.js';

const router = express.Router();

// Create a new rating
router.post('/create-new-rating', createRating);

// Get all ratings for a user
router.get('/get-all-rating/user/:id', getUserRatings);

// Get a specific rating by ID
router.get('/get-rating/:id', getRatingById);

// Get ratings for a contract
router.get('/get-contract-rating/contract/:id', getContractRatings);

// Get ratings for a job
router.get('/get-job-rating/job/:id', getJobRatings);

export default router;