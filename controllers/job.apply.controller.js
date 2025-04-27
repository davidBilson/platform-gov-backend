// jobApplication.controller.js
import JobApplication from '../models/job.applications.model.js';
import Job from '../models/job.created.model.js';
import mongoose from 'mongoose';
import express from 'express';
import multer from 'multer';
import path from 'path';
import fs from 'fs';
import jwt from 'jsonwebtoken';

// Authentication middleware
const authMiddleware = async (req, res, next) => {
  try {
    // Get token from header
    const token = req.header('Authorization')?.replace('Bearer ', '');
    
    if (!token) {
      return res.status(401).json({ success: false, message: 'No authentication token provided' });
    }
    
    // Verify token
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    
    // Find user by id
    const User = mongoose.model('User');
    const user = await User.findById(decoded.id);
    
    if (!user) {
      return res.status(401).json({ success: false, message: 'User not found' });
    }
    
    // Set user in request
    req.user = {
      id: user._id,
      role: user.role
    };
    
    next();
  } catch (error) {
    return res.status(401).json({ success: false, message: 'Invalid authentication token' });
  }
};

// File upload configuration
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const uploadDir = path.join(process.cwd(), 'uploads', 'job-applications');
    
    // Create directory if it doesn't exist
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

const fileFilter = (req, file, cb) => {
  // Accept common document types
  const allowedFileTypes = [
    'application/pdf',
    'application/msword',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'application/vnd.ms-excel',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    'application/vnd.ms-powerpoint',
    'application/vnd.openxmlformats-officedocument.presentationml.presentation',
    'text/plain',
    'image/jpeg',
    'image/png'
  ];
  
  if (allowedFileTypes.includes(file.mimetype)) {
    cb(null, true);
  } else {
    cb(new Error('Invalid file type. Only PDF, Word, Excel, PowerPoint, text files, and images are allowed.'), false);
  }
};

// Set up multer upload
const upload = multer({
  storage,
  fileFilter,
  limits: {
    fileSize: 10 * 1024 * 1024, // 10MB max file size
  }
});

// Process uploaded files
const processUploadedFile = (file) => {
  if (!file) return null;
  
  return {
    filename: file.filename,
    originalName: file.originalname,
    fileSize: file.size,
    fileType: file.mimetype,
    fileUrl: `/uploads/job-applications/${file.filename}`
  };
};


const isValidObjectId = (id) => {
  return mongoose.Types.ObjectId.isValid(id);
};

const toObjectId = (id) => {
  if (!id || !isValidObjectId(id)) return null;
  return new mongoose.Types.ObjectId(id.toString());
};

// Submit job application
export const createJobApplication = async (req, res) => {
  try {
    const { jobId, userId, coverLetter, proposedRate, acknowledgment } = req.body;
    
    // Convert acknowledgment string to boolean if needed
    const certificationAcknowledgment = acknowledgment === 'true' || acknowledgment === true;
    
    // Validate job exists
    const job = await Job.findById(jobId);
    if (!job) {
      return res.status(404).json({ success: false, message: 'Job not found' });
    }

    // Check if job is still active
    if (job.status !== 'active') {
      return res.status(400).json({ success: false, message: 'This job is no longer accepting applications' });
    }

    // Check if user already applied to this job
    const existingApplication = await JobApplication.findOne({ 
      jobId, 
      freelancerId: userId
    });

    if (existingApplication) {
      return res.status(400).json({ 
        success: false, 
        message: 'You have already applied to this job' 
      });
    }

    // Get freelancer profile ID
    const contractorProfile = await mongoose.model('ContractorProfile').findOne({ user: userId });
    if (!contractorProfile) {
      return res.status(400).json({ 
        success: false, 
        message: 'You must complete your freelancer profile before applying to jobs' 
      });
    }

    // Process file upload if it exists
    let attachments = [];
    if (req.file) {
      const fileData = processUploadedFile(req.file);
      if (fileData) {
        attachments.push(fileData);
      }
    }

    // Create new application
    const application = new JobApplication({
      jobId,
      freelancerId: userId,
      freelancerProfileId: contractorProfile._id,
      coverLetter,
      proposedRate: Number(proposedRate),
      certificationAcknowledgment,
      attachments,
      status: 'pending'
    });
    
    await application.save();
    
    return res.status(201).json({
      success: true,
      message: 'Application submitted successfully',
      data: application
    });
  } catch (error) {
    console.error('Error applying to job:', error);
    return res.status(500).json({
      success: false,
      message: 'An error occurred while applying to the job',
      error: error.message
    });
  }
};

// Save job application draft
export const saveJobApplicationDraft = async (req, res) => {
  try {
    const { jobId, userId, coverLetter, proposedRate, acknowledgment } = req.body;
    
    // Convert acknowledgment string to boolean if needed
    const certificationAcknowledgment = acknowledgment === 'true' || acknowledgment === true;
    
    // Validate job exists
    const job = await Job.findById(jobId);
    if (!job) {
      return res.status(404).json({ success: false, message: 'Job not found' });
    }

    // Check if draft already exists
    let draft = await JobApplication.findOne({ 
      jobId, 
      freelancerId: userId,
      status: 'draft'
    });

    // Process file upload if it exists
    let attachments = [];
    if (req.file) {
      const fileData = processUploadedFile(req.file);
      if (fileData) {
        attachments.push(fileData);
      }
    }

    if (draft) {
      // Update existing draft
      draft.coverLetter = coverLetter || draft.coverLetter;
      draft.proposedRate = proposedRate ? Number(proposedRate) : draft.proposedRate;
      draft.certificationAcknowledgment = certificationAcknowledgment || draft.certificationAcknowledgment;
      
      // Add new attachment if exists
      if (attachments.length > 0) {
        draft.attachments.push(...attachments);
      }
      
      await draft.save();
      
      return res.status(200).json({
        success: true,
        message: 'Draft updated successfully',
        data: draft
      });
    } else {
      const contractorProfile = await mongoose.model('ContractorProfile').findOne({ user: userId });
      
      // Create new draft
      draft = new JobApplication({
        jobId,
        freelancerId: userId,
        freelancerProfileId: contractorProfile?._id,
        coverLetter,
        proposedRate: proposedRate ? Number(proposedRate) : undefined,
        certificationAcknowledgment,
        attachments,
        status: 'draft'
      });
      
      await draft.save();
      
      return res.status(201).json({
        success: true,
        message: 'Draft saved successfully',
        data: draft
      });
    }
  } catch (error) {
    console.error('Error saving draft application:', error);
    return res.status(500).json({
      success: false,
      message: 'An error occurred while saving draft application',
      error: error.message
    });
  }
};

export const deleteJobApplicationDraft = async (req, res) => {
  try {
    const jobId = req.params.id;
    const { userId } = req.body;
    
    const draft = await JobApplication.findOne({
      jobId,
      freelancerId: userId,
      status: 'draft'
    });
    
    if (!draft) {
      return res.status(404).json({
        success: false,
        message: 'Draft application not found'
      });
    }
    
    await draft.deleteOne();
    
    return res.status(200).json({
      success: true,
      message: 'Draft application deleted successfully'
    });
  } catch (error) {
    console.error('Error deleting draft application:', error);
    return res.status(500).json({
      success: false,
      message: 'An error occurred while deleting the draft application',
      error: error.message
    });
  }
};

export const getApplicationsByJobId = async (req, res) => {
  try {
    const { jobId } = req.params;
    
    if (!mongoose.Types.ObjectId.isValid(jobId)) {
      return res.status(400).json({ 
        success: false, 
        message: 'Invalid job ID format' 
      });
    }
    
    const job = await Job.findById(jobId);
    if (!job) {
      return res.status(404).json({ 
        success: false, 
        message: 'Job not found' 
      });
    }
    
    if (job.clientId.toString() !== req.user.id.toString()) {
      return res.status(403).json({ 
        success: false, 
        message: 'You are not authorized to view these applications' 
      });
    }
    
    const applications = await JobApplication.find({ 
      jobId, 
      status: { $ne: 'draft' } 
    })
    .populate('freelancerProfileId', 'name profilePicture hourlyRate skills rating location')
    .sort({ createdAt: -1 });
    
    return res.status(200).json({
      success: true,
      count: applications.length,
      data: applications
    });
  } catch (error) {
    console.error('Error fetching job applications:', error);
    return res.status(500).json({
      success: false,
      message: 'An error occurred while fetching job applications',
      error: error.message
    });
  }
};

export const getApplicationsByFreelancerId = async (req, res) => {
  try {
    const userId = req.params.id;
    
    if (!userId || !isValidObjectId(userId)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid user ID'
      });
    }
    
    const applications = await JobApplication.find({ 
      freelancerId: userId 
    })
    .populate('jobId', 'jobTitle description userId clientName clientLogo jobCategory employmentType paymentType retainerAmount retainerFrequency retainerDuration location price status createdAt')
    .sort({ createdAt: -1 });
    
    return res.status(200).json({
      success: true,
      count: applications.length,
      data: applications
    });
  } catch (error) {
    console.error('Error fetching user applications:', error);
    return res.status(500).json({
      success: false,
      message: 'An error occurred while fetching user applications',
      error: error.message
    });
  }
};


const router = express.Router();

router.post(
  '/submit',
  upload.single('attachment'),
  createJobApplication
);

router.get(
  '/applications/job/:id',
  getApplicationsByJobId
);

router.get(
  '/applications/user/:id',
  getApplicationsByFreelancerId
);

router.post(
  '/save-draft',
  upload.single('attachment'),
  saveJobApplicationDraft
);

router.delete(
  '/delete-draft/:id',
  deleteJobApplicationDraft
);

export default router;