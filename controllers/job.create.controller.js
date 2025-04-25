import mongoose from 'mongoose';
import Job from '../models/job.created.model.js';
import BusinessProfile from '../models/profile.client.model.js';

/**
 * Validate ObjectId
 * @param {string} id - ID to validate
 * @returns {boolean} - Is valid ObjectId
 */
const isValidObjectId = (id) => {
  return mongoose.Types.ObjectId.isValid(id);
};

/**
 * Convert ID to ObjectId if valid
 * @param {string} id - ID to convert
 * @returns {ObjectId|null} - Mongoose ObjectId or null if invalid
 */
const toObjectId = (id) => {
  if (!id || !isValidObjectId(id)) return null;
  return new mongoose.Types.ObjectId(id.toString());
};

/**
 * Parse array field from request
 * @param {string|Array} field - Field to parse
 * @returns {Array} - Parsed array
 */
const parseArrayField = (field) => {
  if (!field) return [];
  if (Array.isArray(field)) return field;
  try {
    return JSON.parse(field);
  } catch (e) {
    return [field]; // Return as single item array if not JSON parseable
  }
};

/**
 * Verify user role based on business profile existence
 * @param {string} userId - User ID to verify
 * @returns {Object} - User role and profile info
 */
const verifyUserRole = async (userId) => {
  if (!userId || !isValidObjectId(userId)) {
    return { hasValidRole: false, role: null, profile: null };
  }
  
  const objectId = new mongoose.Types.ObjectId(userId.toString());
  
  // Check if user has a business profile
  const businessProfile = await BusinessProfile.findOne({ user: objectId });

  if (businessProfile) {
    return { hasValidRole: true, role: 'client', profile: businessProfile,  };
  }
};

/**
 * Get all jobs
 * @route GET /api/jobs
 * @access Public
 */
export const getAllJobs = async (req, res) => {
  try {
    // Add pagination
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;
    const skip = (page - 1) * limit;
    
    // Add filtering options
    const filter = {};
    
    // Filter by status - default to active jobs only
    filter.status = req.query.status || 'active';
    
    // Filter by location if provided
    if (req.query.location) {
      filter.location = new RegExp(req.query.location, 'i');
    }
    
    // Filter by job title if provided
    if (req.query.jobTitle) {
      filter.jobTitle = new RegExp(req.query.jobTitle, 'i');
    }
    
    // Filter by job category if provided
    if (req.query.jobCategory) {
      filter.jobCategory = new RegExp(req.query.jobCategory, 'i');
    }
    
    // Filter by employment type if provided
    if (req.query.employmentType) {
      filter.employmentType = req.query.employmentType;
    }
    
    // Filter by payment type if provided
    if (req.query.paymentType) {
      filter.paymentType = req.query.paymentType;
    }
    
    // Filter by user role if provided
    if (req.query.userRole) {
      filter.userRole = req.query.userRole;
    }
    
    // Filter by required skills if provided
    if (req.query.skills) {
      const skills = req.query.skills.split(',').map(skill => skill.trim());
      filter.requiredSkills = { $in: skills };
    }
    
    // Execute query with filters and pagination
    const jobs = await Job.find(filter)
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit)
      .populate('userId', 'name email profile'); // Populate user info
    
    // Get total count for pagination
    const total = await Job.countDocuments(filter);
    
    res.status(200).json({
      success: true,
      data: jobs,
      pagination: {
        total,
        page,
        limit,
        pages: Math.ceil(total / limit)
      }
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message || 'Internal server error'
    });
  }
};

/**
 * Get job by ID
 * @route GET /api/jobs/:id
 * @access Public
 */
export const getJobById = async (req, res) => {
  try {
    const jobId = req.params.id;
    
    // Validate job ID
    if (!jobId || !isValidObjectId(jobId)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid job ID'
      });
    }
    
    const objectId = new mongoose.Types.ObjectId(jobId.toString());
    
    // Find job and populate user data
    const job = await Job.findById(objectId)
      .populate('userId', 'name email profile');
    
    if (!job) {
      return res.status(404).json({
        success: false,
        message: 'Job not found'
      });
    }
    
    res.status(200).json({
      success: true,
      data: job
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message || 'Internal server error'
    });
  }
};

/**
 * Get jobs by user ID
 * @route GET /api/jobs/user/:id
 * @access Private
 */
export const getJobsByUserId = async (req, res) => {
  try {
    const userId = req.params.id;
    
    // Validate user ID
    if (!userId || !isValidObjectId(userId)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid user ID'
      });
    }
    
    const objectId = new mongoose.Types.ObjectId(userId.toString());
    
    // Add pagination
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;
    const skip = (page - 1) * limit;
    
    // Add status filter if provided
    const filter = { userId: objectId };
    if (req.query.status) {
      filter.status = req.query.status;
    }
    
    // Find jobs for this user
    const jobs = await Job.find(filter)
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit);
    
    // Get total count for pagination
    const total = await Job.countDocuments(filter);
    
    res.status(200).json({
      success: true,
      data: jobs,
      pagination: {
        total,
        page,
        limit,
        pages: Math.ceil(total / limit)
      }
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message || 'Internal server error'
    });
  }
};

/**
 * Create a new job
 * @route POST /api/jobs
 * @access Private
 */
export const createJob = async (req, res) => {
  try {
    const userId = req.body.userId || req.user?.id;
    
    // Check if user exists and determine role
    const { hasValidRole, role, profile } = await verifyUserRole(userId);

    if (!hasValidRole) {
      console.log('Invalid user ID or user does not have permission to create jobs')
      return res.status(403).json({
        success: false,
        message: 'Invalid user ID or user does not have permission to create jobs'
      });
    }
    
    // Parse arrays if they come as strings
    const requiredSkills = parseArrayField(req.body.requiredSkills);
    const requiredCertifications = parseArrayField(req.body.requiredCertifications);
    
    // Parse milestones if provided
    let milestones = [];
    if (req.body.milestones) {
      milestones = parseArrayField(req.body.milestones);
      
      // Ensure each milestone has required fields
      for (let i = 0; i < milestones.length; i++) {
        if (!milestones[i].id) milestones[i].id = i + 1;
        if (!milestones[i].description || !milestones[i].price) {
          console.log(`Milestone at position ${i} is missing required fields (description or price)`);
          return res.status(400).json({
            success: false,
            message: `Milestone at position ${i} is missing required fields (description or price)`
          });
        }
      }
    }
    
    // Create job data object
    const jobData = {
      userId: toObjectId(userId),
      clientName: profile.name,
      clientLogo: profile.logo,
      clientIndustry: profile.industry,
      clientCompanySize: profile.size,
      clientSpecializations: profile.specializations,
      clientLocation: profile.locations,
      clientAccountAge: profile.createdAt,
      userRole: role,
      location: req.body.location,
      jobCategory: req.body.jobCategory,
      jobTitle: req.body.jobTitle,
      description: req.body.description,
      requiredSkills,
      requiredCertifications,
      requiresRegisteredLobbyist: req.body.requiresRegisteredLobbyist === 'true' || req.body.requiresRegisteredLobbyist === true,
      employmentType: req.body.employmentType,
      paymentType: req.body.paymentType,
      price: parseFloat(req.body.price),
      milestones,
      status: req.body.status || 'active'
    };
    
    // Add payment type specific fields
    if (req.body.paymentType === 'retainer') {
      jobData.retainerAmount = parseFloat(req.body.retainerAmount || 0);
      jobData.retainerFrequency = req.body.retainerFrequency || 'Week';
      jobData.retainerDuration = parseInt(req.body.retainerDuration || 1);
    }
    
    // Add start date if provided
    if (req.body.startDate) {
      jobData.startDate = new Date(req.body.startDate);
    }
    
    // Create new job
    const job = await Job.create(jobData);
    
    res.status(201).json({
      success: true,
      data: job,
      message: 'Job created successfully'
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message || 'Internal server error'
    });
  }
};

/**
 * Update job
 * @route PUT /api/jobs/:id
 * @access Private (own jobs only)
 */
export const updateJob = async (req, res) => {
  try {
    const jobId = req.params.id;
    const userId = req.body.userId || req.user?.id;
    
    // Validate job ID
    if (!jobId || !isValidObjectId(jobId)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid job ID'
      });
    }
    
    // Validate user ID
    if (!userId || !isValidObjectId(userId)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid user ID'
      });
    }
    
    const jobObjectId = new mongoose.Types.ObjectId(jobId.toString());
    const userObjectId = new mongoose.Types.ObjectId(userId.toString());
    
    // Find job
    const job = await Job.findById(jobObjectId);
    
    if (!job) {
      return res.status(404).json({
        success: false,
        message: 'Job not found'
      });
    }
    
    // Check if this job belongs to the user
    if (job.userId.toString() !== userObjectId.toString()) {
      return res.status(403).json({
        success: false,
        message: 'You can only update your own jobs'
      });
    }
    
    // Parse arrays if they come as strings
    const requiredSkills = req.body.requiredSkills ? parseArrayField(req.body.requiredSkills) : job.requiredSkills;
    const requiredCertifications = req.body.requiredCertifications ? parseArrayField(req.body.requiredCertifications) : job.requiredCertifications;
    
    // Parse milestones if provided
    let milestones = job.milestones;
    if (req.body.milestones) {
      milestones = parseArrayField(req.body.milestones);
      
      // Ensure each milestone has required fields
      for (let i = 0; i < milestones.length; i++) {
        if (!milestones[i].id) milestones[i].id = i + 1;
        if (!milestones[i].description || !milestones[i].price) {
          return res.status(400).json({
            success: false,
            message: `Milestone at position ${i} is missing required fields (description or price)`
          });
        }
      }
    }
    
    // Prepare update data
    const updateData = {
      location: req.body.location || job.location,
      jobCategory: req.body.jobCategory || job.jobCategory,
      jobTitle: req.body.jobTitle || job.jobTitle,
      description: req.body.description || job.description,
      requiredSkills,
      requiredCertifications,
      employmentType: req.body.employmentType || job.employmentType,
      paymentType: req.body.paymentType || job.paymentType,
      price: req.body.price ? parseFloat(req.body.price) : job.price,
      milestones,
      updatedAt: Date.now()
    };
    
    // Handle boolean fields
    if (req.body.requiresRegisteredLobbyist !== undefined) {
      updateData.requiresRegisteredLobbyist = req.body.requiresRegisteredLobbyist === 'true' || req.body.requiresRegisteredLobbyist === true;
    }
    
    // Update payment type specific fields
    if (req.body.paymentType === 'retainer' || job.paymentType === 'retainer') {
      updateData.retainerAmount = req.body.retainerAmount ? parseFloat(req.body.retainerAmount) : job.retainerAmount;
      updateData.retainerFrequency = req.body.retainerFrequency || job.retainerFrequency;
      updateData.retainerDuration = req.body.retainerDuration ? parseInt(req.body.retainerDuration) : job.retainerDuration;
    }
    
    // Update start date if provided
    if (req.body.startDate) {
      updateData.startDate = new Date(req.body.startDate);
    }
    
    // Update status if provided
    if (req.body.status && ['draft', 'active', 'closed', 'completed'].includes(req.body.status)) {
      updateData.status = req.body.status;
    }
    
    // Update job
    const updatedJob = await Job.findByIdAndUpdate(
      jobObjectId,
      { $set: updateData },
      { new: true, runValidators: true }
    );
    
    res.status(200).json({
      success: true,
      data: updatedJob,
      message: 'Job updated successfully'
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message || 'Internal server error'
    });
  }
};

/**
 * Delete job
 * @route DELETE /api/jobs/:id
 * @access Private (own jobs only)
 */
export const deleteJob = async (req, res) => {
  try {
    const jobId = req.params.id;
    const userId = req.body.userId || req.user?.id;
    
    // Validate job ID
    if (!jobId || !isValidObjectId(jobId)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid job ID'
      });
    }
    
    // Validate user ID
    if (!userId || !isValidObjectId(userId)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid user ID'
      });
    }
    
    const jobObjectId = new mongoose.Types.ObjectId(jobId.toString());
    const userObjectId = new mongoose.Types.ObjectId(userId.toString());
    
    // Find job
    const job = await Job.findById(jobObjectId);
    
    if (!job) {
      return res.status(404).json({
        success: false,
        message: 'Job not found'
      });
    }
    
    // Check if this job belongs to the user
    if (job.userId.toString() !== userObjectId.toString()) {
      return res.status(403).json({
        success: false,
        message: 'You can only delete your own jobs'
      });
    }
    
    // Delete job
    await Job.findByIdAndDelete(jobObjectId);
    
    res.status(200).json({
      success: true,
      message: 'Job deleted successfully'
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message || 'Internal server error'
    });
  }
};

/**
 * Change job status
 * @route PATCH /api/jobs/:id/status
 * @access Private (own jobs only)
 */
export const changeJobStatus = async (req, res) => {
  try {
    const jobId = req.params.id;
    const userId = req.body.userId || req.user?.id;
    const { status } = req.body;
    
    // Validate job ID
    if (!jobId || !isValidObjectId(jobId)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid job ID'
      });
    }
    
    // Validate status
    if (!status || !['draft', 'active', 'closed', 'completed'].includes(status)) {
      return res.status(400).json({
        success: false,
        message: 'Status must be one of: draft, active, closed, completed'
      });
    }
    
    // Validate user ID
    if (!userId || !isValidObjectId(userId)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid user ID'
      });
    }
    
    const jobObjectId = new mongoose.Types.ObjectId(jobId.toString());
    const userObjectId = new mongoose.Types.ObjectId(userId.toString());
    
    // Find job
    const job = await Job.findById(jobObjectId);
    
    if (!job) {
      return res.status(404).json({
        success: false,
        message: 'Job not found'
      });
    }
    
    // Check if this job belongs to the user
    if (job.userId.toString() !== userObjectId.toString()) {
      return res.status(403).json({
        success: false,
        message: 'You can only update your own jobs'
      });
    }
    
    // Update job status
    const updatedJob = await Job.findByIdAndUpdate(
      jobObjectId,
      { 
        $set: { 
          status,
          updatedAt: Date.now()
        }
      },
      { new: true }
    );
    
    res.status(200).json({
      success: true,
      data: updatedJob,
      message: `Job status changed to ${status} successfully`
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message || 'Internal server error'
    });
  }
};

/**
 * Add or update milestone
 * @route POST /api/jobs/:id/milestones
 * @access Private (own jobs only)
 */
export const addOrUpdateMilestone = async (req, res) => {
  try {
    const jobId = req.params.id;
    const userId = req.body.userId || req.user?.id;
    const { id, description, price, dueDate } = req.body;
    
    // Validate job ID
    if (!jobId || !isValidObjectId(jobId)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid job ID'
      });
    }
    
    // Validate user ID
    if (!userId || !isValidObjectId(userId)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid user ID'
      });
    }
    
    // Validate milestone data
    if (!description || price === undefined) {
      return res.status(400).json({
        success: false,
        message: 'Milestone description and price are required'
      });
    }
    
    const jobObjectId = new mongoose.Types.ObjectId(jobId.toString());
    const userObjectId = new mongoose.Types.ObjectId(userId.toString());
    
    // Find job
    const job = await Job.findById(jobObjectId);
    
    if (!job) {
      return res.status(404).json({
        success: false,
        message: 'Job not found'
      });
    }
    
    // Check if this job belongs to the user
    if (job.userId.toString() !== userObjectId.toString()) {
      return res.status(403).json({
        success: false,
        message: 'You can only update your own jobs'
      });
    }
    
    // Check if this is fixed-price job
    if (job.paymentType !== 'fixed-price') {
      return res.status(400).json({
        success: false,
        message: 'Milestones can only be added to fixed-price jobs'
      });
    }
    
    // Create milestone object
    const milestone = {
      id: id || job.milestones.length + 1,
      description,
      price: parseFloat(price),
      dueDate: dueDate ? new Date(dueDate) : null
    };
    
    // Check if milestone with this ID already exists
    const existingIndex = job.milestones.findIndex(m => m.id === milestone.id);
    
    let updatedJob;
    
    if (existingIndex >= 0) {
      // Update existing milestone
      job.milestones[existingIndex] = milestone;
      
      updatedJob = await Job.findByIdAndUpdate(
        jobObjectId,
        { 
          $set: { 
            milestones: job.milestones,
            updatedAt: Date.now()
          }
        },
        { new: true }
      );
    } else {
      // Add new milestone
      updatedJob = await Job.findByIdAndUpdate(
        jobObjectId,
        { 
          $push: { milestones: milestone },
          $set: { updatedAt: Date.now() }
        },
        { new: true }
      );
    }
    
    res.status(200).json({
      success: true,
      data: updatedJob,
      message: existingIndex >= 0 ? 'Milestone updated successfully' : 'Milestone added successfully'
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message || 'Internal server error'
    });
  }
};

/**
 * Remove milestone
 * @route DELETE /api/jobs/:id/milestones/:milestoneId
 * @access Private (own jobs only)
 */
export const removeMilestone = async (req, res) => {
  try {
    const jobId = req.params.id;
    const milestoneId = parseInt(req.params.milestoneId);
    const userId = req.body.userId || req.user?.id;
    
    // Validate job ID
    if (!jobId || !isValidObjectId(jobId)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid job ID'
      });
    }
    
    // Validate milestone ID
    if (isNaN(milestoneId)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid milestone ID'
      });
    }
    
    // Validate user ID
    if (!userId || !isValidObjectId(userId)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid user ID'
      });
    }
    
    const jobObjectId = new mongoose.Types.ObjectId(jobId.toString());
    const userObjectId = new mongoose.Types.ObjectId(userId.toString());
    
    // Find job
    const job = await Job.findById(jobObjectId);
    
    if (!job) {
      return res.status(404).json({
        success: false,
        message: 'Job not found'
      });
    }
    
    // Check if this job belongs to the user
    if (job.userId.toString() !== userObjectId.toString()) {
      return res.status(403).json({
        success: false,
        message: 'You can only update your own jobs'
      });
    }
    
    // Check if milestone exists
    const milestoneIndex = job.milestones.findIndex(m => m.id === milestoneId);
    if (milestoneIndex === -1) {
      return res.status(404).json({
        success: false,
        message: 'Milestone not found'
      });
    }
    
    // Remove milestone
    job.milestones.splice(milestoneIndex, 1);
    
    // Update job
    const updatedJob = await Job.findByIdAndUpdate(
      jobObjectId,
      { 
        $set: { 
          milestones: job.milestones,
          updatedAt: Date.now()
        }
      },
      { new: true }
    );
    
    res.status(200).json({
      success: true,
      data: updatedJob,
      message: 'Milestone removed successfully'
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message || 'Internal server error'
    });
  }
};