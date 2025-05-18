import express from 'express';
import {
  createRating,
  getUserRatings,
  getRatingById,
  updateRating,
  deleteRating,
  getContractRatings,
  getJobRatings
} from '../controllers/rating.controller.js';

const router = express.Router();

// Create a new rating
router.post('/', createRating);

// Get all ratings for a user
router.get('/user/:userId', getUserRatings);

// Get a specific rating by ID
router.get('/:id', getRatingById);

// Update a rating
router.put('/:id', updateRating);

// Delete a rating
router.delete('/:id', deleteRating);

// Get ratings for a contract
router.get('/contract/:contractId', getContractRatings);

// Get ratings for a job
router.get('/job/:jobId', getJobRatings);

export default router;