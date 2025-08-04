import Rating from '../../models/rating.model.js';
import Contract from '../../models/contract.model.js';
import User from '../../models/user.model.js';

const canRate = async (contractId, reviewerId) => {
  const contract = await Contract.findById(contractId);

  if (!contract) {
    return { canRate: false, message: 'Contract not found' };
  }

  if (contract.status !== 'completed') {
    return { canRate: false, message: 'Contract must be completed to rate' };
  }

  const clientIdStr = contract.clientId?.toString();
  const contractorIdStr = contract.contractorId?.toString();
  const reviewerIdStr = reviewerId.toString();

  if (![clientIdStr, contractorIdStr].includes(reviewerIdStr)) {
    return { canRate: false, message: 'User not part of this contract' };
  }

  return { canRate: true };
};

// Create a new rating
export const createRating = async (req, res) => {

  try {
    const { contractId, jobId, reviewee, reviewer, role, rating, comments } = req.body;

    // Validate required fields
    if (!contractId || !jobId || !reviewee || !reviewer || !role || !rating) {
      return res.status(400).json({ message: 'Missing required fields' });
    }

    // Check if user can rate
    const { canRate: userCanRate, message } = await canRate(contractId, reviewer);
    if (!userCanRate) {
      return res.status(403).json({ message });
    }

    // Check if rating already exists for this contract by this reviewer
    const existingRating = await Rating.findOne({ contractId, reviewer });
    if (existingRating) {
      return res.status(400).json({ message: 'You have already rated this contract' });
    }

    // Validate rating value
    if (rating < 1 || rating > 5) {
      return res.status(400).json({ message: 'Rating must be between 1 and 5' });
    }

    // Create new rating
    const newRating = new Rating({
      contractId,
      jobId,
      reviewer,
      reviewee,
      role,
      rating,
      comments
    });

    await newRating.save();

    // Update user's average rating if reviewee is a contractor
    if (role === 'contractor') {
      await updateContractorRating(reviewee);
    }

    res.status(201).json(newRating);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// Get all ratings for a user
export const getUserRatings = async (req, res) => {
  try {
    const userId = req.params.id;
    const { role } = req.query;

    const query = { reviewee: userId };

    if (role) {
      query.role = role;
    }

    // Use simple find() instead of paginate()
    const ratings = await Rating.find(query)
      .populate('reviewer', 'name')
      .populate('jobId', 'jobTitle')
      .populate('contractId', 'status')
      .sort({ createdAt: -1 });

    res.status(200).json(ratings);

  } catch (error) {
    console.error('Error fetching user ratings:', error);
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
};

// Get rating by ID
export const getRatingById = async (req, res) => {
  try {
    const id = req.params.id;

    const rating = await Rating.findById(id)
      .populate('reviewer', 'name')
      .populate('reviewee', 'name')
      .populate('jobId', 'jobTitle')
      .populate('contractId', 'status');

    if (!rating) {
      return res.status(404).json({ message: 'Rating not found' });
    }

    res.status(200).json(rating);

  } catch (error) {
    res.status(500).json({ message: error.message });
  }

};

export const getContractRatings = async (req, res) => {
  try {
    const contractId = req.params.id;

    const ratings = await Rating.find({ contractId: contractId })
      .populate('reviewer', 'name')
      .populate('reviewee', 'name');

    res.status(200).json(ratings);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// Get ratings for a job
export const getJobRatings = async (req, res) => {
  try {
    const jobId = req.params.id;
    const { page = 1, limit = 10 } = req.query;

    const options = {
      page: parseInt(page),
      limit: parseInt(limit),
      sort: { createdAt: -1 },
      populate: [
        { path: 'reviewer', select: 'name' },
        { path: 'reviewee', select: 'name' }
      ]
    };

    const ratings = await Rating.paginate({ jobId }, options);

    res.status(200).json(ratings);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// Helper function to update contractor's average rating
const updateContractorRating = async (contractorId) => {
  const ratings = await Rating.find({ reviewee: contractorId, role: 'contractor' });

  if (ratings.length > 0) {

    const totalRatings = ratings.reduce((sum, rating) => sum + rating.rating, 0);
    const averageRating = totalRatings / ratings.length;

    await User.findByIdAndUpdate(contractorId, {
      averageRating: parseFloat(averageRating.toFixed(2)),
      ratingCount: ratings.length
    });

  }
};