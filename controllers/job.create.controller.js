import mongoose from 'mongoose';
import Job from '../models/job.created.model.js';
import BusinessProfile from '../models/profile.client.model.js';
import JobApplication from '../models/job.applications.model.js';

const isValidObjectId = (id) => {
  return mongoose.Types.ObjectId.isValid(id);
};

const toObjectId = (id) => {
  if (!id || !isValidObjectId(id)) return null;
  return new mongoose.Types.ObjectId(id.toString());
};

const parseArrayField = (field) => {
  if (!field) return [];
  if (Array.isArray(field)) return field;
  try {
    return JSON.parse(field);
  } catch (e) {
    return [field];
  }
};

const verifyUserRole = async (userId) => {
  if (!userId || !isValidObjectId(userId)) {
    return { hasValidRole: false, role: null, profile: null };
  }
  const objectId = new mongoose.Types.ObjectId(userId.toString());
  const businessProfile = await BusinessProfile.findOne({ user: objectId });
  if (businessProfile) {
    return { hasValidRole: true, role: 'client', profile: businessProfile,  };
  }
};

export const getAllJobs = async (req, res) => {
  try {
    const jobs = await Job.find()
      .sort({ createdAt: -1 })
      .populate('userId', 'name email profile'); // Populate user info
    
    res.status(200).json({
      success: true,
      data: jobs,
      count: jobs.length
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message || 'Internal server error'
    });
  }
};

export const getJobById = async (req, res) => {
  try {
    const jobId = req.params.id;
    
    if (!jobId || !isValidObjectId(jobId)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid job ID'
      });
    }
    
    const objectId = new mongoose.Types.ObjectId(jobId.toString());
    
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

export const getJobsByUserId = async (req, res) => {
  try {
    const userId = req.params.id;
    
    if (!userId || !mongoose.Types.ObjectId.isValid(userId)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid user ID'
      });
    }
    
    const objectId = new mongoose.Types.ObjectId(userId.toString());
    
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;
    const skip = (page - 1) * limit;
    
    const filter = { userId: objectId };
    if (req.query.status) {
      filter.status = req.query.status;
    }

    const jobs = await Job.find(filter)
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit);
    
    const total = await Job.countDocuments(filter);
    
    // Get proposal counts for each job
    const jobIds = jobs.map(job => job._id);
    
    // Count proposals for each job
    const proposalCounts = await JobApplication.aggregate([
      { $match: { jobId: { $in: jobIds } } },
      { $group: { _id: "$jobId", count: { $sum: 1 } } }
    ]);
    
    // Create a map of job ID to proposal count
    const proposalCountMap = {};
    proposalCounts.forEach(item => {
      proposalCountMap[item._id.toString()] = item.count;
    });
    
    // Add proposal count to each job
    const jobsWithProposalCounts = jobs.map(job => {
      const jobObj = job.toObject();
      jobObj.proposalsCount = proposalCountMap[job._id.toString()] || 0;
      return jobObj;
    });
    
    res.status(200).json({
      success: true,
      data: jobsWithProposalCounts,
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

export const createJob = async (req, res) => {
  try {
    const userId = req.body.userId;
    console.log(req.body);
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

    const jobData = {
      userId: toObjectId(userId),
      clientName: profile.name,
      clientLogo: profile.logo,
      clientDepartment: profile.department,
      clientClearance: profile.clearance,
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
      status: req.body.status || 'open'
    };
    
    // Add payment type specific fields
    if (req.body.paymentType === 'retainer') {
      jobData.retainerAmount = parseFloat(req.body.retainerAmount || 0);
      jobData.retainerFrequency = req.body.retainerFrequency || '';
      jobData.retainerDuration = parseInt(req.body.retainerDuration || 0);
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
    console.log(error)
    res.status(500).json({
      success: false,
      message: error.message || 'Internal server error'
    });
  }
};

export const updateJobStatus = async (req, res) => {
  try {
    const userId = req.params.id;
    const { jobId, status } = req.body;

    // Validate user ID
    if (!userId || !isValidObjectId(userId)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid user ID'
      });
    }

    // Validate job ID
    if (!jobId || !isValidObjectId(jobId)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid job ID'
      });
    }

    // Validate status
    if (!status || !['open', 'active', 'closed', 'completed'].includes(status)) {
      return res.status(400).json({
        success: false,
        message: 'Status must be one of: open, active, closed, completed'
      });
    }

    const userObjectId = new mongoose.Types.ObjectId(userId.toString());
    const jobObjectId = new mongoose.Types.ObjectId(jobId.toString());

    // Find and update the specific job
    const job = await Job.findOneAndUpdate(
      { 
        _id: jobObjectId,
        userId: userObjectId 
      },
      { 
        $set: { 
          status,
          updatedAt: Date.now()
        }
      },
      { new: true }
    );

    if (!job) {
      return res.status(404).json({
        success: false,
        message: 'Job not found or you do not have permission to update it'
      });
    }

    res.status(200).json({
      success: true,
      message: `Job status updated to ${status} successfully`,
      data: job
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message || 'Internal server error'
    });
  }
};

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
      updatedAt: Date.now()
    };
    
    if (req.body.requiresRegisteredLobbyist !== undefined) {
      updateData.requiresRegisteredLobbyist = req.body.requiresRegisteredLobbyist === 'true' || req.body.requiresRegisteredLobbyist === true;
    }
    
    if (req.body.paymentType === 'retainer' || job.paymentType === 'retainer') {
      updateData.retainerAmount = req.body.retainerAmount ? parseFloat(req.body.retainerAmount) : job.retainerAmount;
      updateData.retainerFrequency = req.body.retainerFrequency || job.retainerFrequency;
      updateData.retainerDuration = req.body.retainerDuration ? parseInt(req.body.retainerDuration) : job.retainerDuration;
    }
    
    if (req.body.startDate) {
      updateData.startDate = new Date(req.body.startDate);
    }
    
    if (req.body.status && ['draft', 'active', 'closed', 'completed'].includes(req.body.status)) {
      updateData.status = req.body.status;
    }
    
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
    
    const job = await Job.findById(jobObjectId);
    
    if (!job) {
      return res.status(404).json({
        success: false,
        message: 'Job not found'
      });
    }
    
    if (job.userId.toString() !== userObjectId.toString()) {
      return res.status(403).json({
        success: false,
        message: 'You can only update your own jobs'
      });
    }
    
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