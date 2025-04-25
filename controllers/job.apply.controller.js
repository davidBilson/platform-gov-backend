// jobApplication.controller.js
import JobApplication from '../models/job.applications.model.js';
import Job from '../models/job.created.model.js';
import mongoose from 'mongoose';
import express from 'express';
import multer from 'multer';
import path from 'path';
import fs from 'fs';
import jwt from 'jsonwebtoken';

// Authentication middleware - implemented directly in this file
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

// File upload configuration - implemented directly in this file
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

// File filter to restrict file types
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
const processUploadedFiles = (files) => {
  if (!files || files.length === 0) return [];
  
  return files.map(file => ({
    filename: file.filename,
    originalName: file.originalname,
    fileSize: file.size,
    fileType: file.mimetype,
    fileUrl: `/uploads/job-applications/${file.filename}`
  }));
};

// Submit or save draft application
export const createOrUpdateJobApplication = async (req, res) => {
  try {
    const { jobId } = req.params;
    const freelancerId = req.user.id;
    const {
      coverLetter,
      proposedRate,
      certificationAcknowledgment,
      saveAsDraft = false
    } = req.body;

    // Validate job exists
    const job = await Job.findById(jobId);
    if (!job) {
      return res.status(404).json({ success: false, message: 'Job not found' });
    }

    // Check if job is still active
    if (job.status !== 'active' && !saveAsDraft) {
      return res.status(400).json({ success: false, message: 'This job is no longer accepting applications' });
    }

    // Check if user is a freelancer
    if (req.user.role !== 'freelancer') {
      return res.status(403).json({ success: false, message: 'Only freelancers can apply to jobs' });
    }

    // Check if freelancer already applied to this job
    let application = await JobApplication.findOne({ 
      jobId, 
      freelancerId
    });

    // Process file uploads if they exist
    let attachments = [];
    if (req.files && req.files.length > 0) {
      attachments = processUploadedFiles(req.files);
    }

    const status = saveAsDraft ? 'draft' : 'pending';

    if (application) {
      // Update existing application
      
      // If transitioning from draft to submitted, validate required fields
      if (application.status === 'draft' && status === 'pending') {
        if (!coverLetter) {
          return res.status(400).json({ success: false, message: 'Cover letter is required' });
        }
        if (!proposedRate) {
          return res.status(400).json({ success: false, message: 'Proposed rate is required' });
        }
        if (!certificationAcknowledgment) {
          return res.status(400).json({ 
            success: false, 
            message: 'You must acknowledge that you have the required certifications and security clearances' 
          });
        }
      }
      
      // Keep existing attachments and add new ones if any
      const updatedAttachments = [...application.attachments];
      if (attachments.length > 0) {
        updatedAttachments.push(...attachments);
      }

      application.coverLetter = coverLetter || application.coverLetter;
      application.proposedRate = proposedRate || application.proposedRate;
      application.certificationAcknowledgment = certificationAcknowledgment ?? application.certificationAcknowledgment;
      application.attachments = updatedAttachments;
      application.status = status;
      
      await application.save();
      
      return res.status(200).json({
        success: true,
        message: saveAsDraft ? 'Application draft updated' : 'Application updated and submitted',
        data: application
      });
    } else {
      // Create new application
      
      // If not a draft, validate required fields
      if (!saveAsDraft) {
        if (!coverLetter) {
          return res.status(400).json({ success: false, message: 'Cover letter is required' });
        }
        if (!proposedRate) {
          return res.status(400).json({ success: false, message: 'Proposed rate is required' });
        }
        if (!certificationAcknowledgment) {
          return res.status(400).json({ 
            success: false, 
            message: 'You must acknowledge that you have the required certifications and security clearances' 
          });
        }
      }
      
      // Get freelancer profile ID
      const freelancerProfile = await mongoose.model('FreelancerProfile').findOne({ user: freelancerId });
      if (!freelancerProfile && !saveAsDraft) {
        return res.status(400).json({ 
          success: false, 
          message: 'You must complete your freelancer profile before applying to jobs' 
        });
      }

      application = new JobApplication({
        jobId,
        freelancerId,
        freelancerProfileId: freelancerProfile?._id,
        coverLetter,
        proposedRate,
        certificationAcknowledgment,
        attachments,
        status
      });
      
      await application.save();
      
      return res.status(201).json({
        success: true,
        message: saveAsDraft ? 'Application draft saved' : 'Application submitted successfully',
        data: application
      });
    }
  } catch (error) {
    console.error('Error applying to job:', error);
    return res.status(500).json({
      success: false,
      message: 'An error occurred while applying to the job',
      error: error.message
    });
  }
};

// Delete draft application
export const deleteDraftApplication = async (req, res) => {
  try {
    const { jobId } = req.params;
    const freelancerId = req.user.id;
    
    const application = await JobApplication.findOne({
      jobId,
      freelancerId,
      status: 'draft'
    });
    
    if (!application) {
      return res.status(404).json({
        success: false,
        message: 'Draft application not found'
      });
    }
    
    await application.deleteOne();
    
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

// Set up router
const router = express.Router();

// Apply to job or save draft with file upload
router.post(
  '/jobs/:jobId/apply',
  authMiddleware,
  upload.array('attachments', 5), // Max 5 files
  createOrUpdateJobApplication
);

// Delete draft application
router.delete(
  '/jobs/:jobId/draft',
  authMiddleware,
  deleteDraftApplication
);

export default router;