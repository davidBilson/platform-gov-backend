import mongoose from 'mongoose';
import Contract from '../../models/contract.model.js';
import { uploadImage } from '../../utils/cloudinary.js';
import fs from 'fs';

// Start a work session
export const startWorkSession = async (req, res) => {
  try {
    const { contractId } = req.params;
    const { userId } = req.body;

    const contract = await Contract.findOne({
      _id: contractId,
      contractorId: userId,
      paymentStructure: 'timesheet'
    });

    if (!contract) {
      return res.status(404).json({ 
        success: false, 
        message: 'Contract not found or invalid payment structure' 
      });
    }

    const activeSession = contract.timesheets.find(s => s.status === 'active');
    if (activeSession) {
      return res.status(400).json({ 
        success: false, 
        message: 'You already have an active work session' 
      });
    }

    const newSession = {
      startTime: new Date(),
      status: 'active',
      _id: new mongoose.Types.ObjectId()
    };

    contract.timesheets.push(newSession);
    await contract.save();

    res.status(201).json({
      success: true,
      data: newSession,
      message: 'Work session started'
    });

  } catch (error) {
    console.error('Error starting work session:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Server error starting work session',
      error: error.message 
    });
  }
};

export const stopWorkSession = async (req, res) => {
  try {
    const { contractId, sessionId } = req.params;
    const { notes, userId } = req.body;
    const files = req.files; // Assuming multiple files are uploaded

    const contract = await Contract.findOne({
      _id: contractId,
      contractorId: userId,
      paymentStructure: 'timesheet'
    });

    if (!contract) {
      return res.status(404).json({ 
        success: false, 
        message: 'Contract not found or invalid payment structure' 
      });
    }

    const session = contract.timesheets.id(sessionId);
    if (!session) {
      return res.status(404).json({ 
        success: false, 
        message: 'Work session not found' 
      });
    }

    if (session.status !== 'active') {
      return res.status(400).json({ 
        success: false, 
        message: 'Session is not active' 
      });
    }

    // Upload screenshots to Cloudinary
    const screenshotUploads = [];
    if (files && files.length > 0) {
      for (const file of files) {
        try {
          const result = await uploadImage(file.path, 'timesheets');
          screenshotUploads.push({
            imagePath: result.secure_url,
            publicId: result.public_id
          });
          // Clean up temp file
          fs.unlinkSync(file.path);
        } catch (uploadError) {
          console.error('Error uploading screenshot:', uploadError);
          // Clean up temp file if upload failed
          if (fs.existsSync(file.path)) {
            fs.unlinkSync(file.path);
          }
        }
      }
    }

    const endTime = new Date();
    const startTime = new Date(session.startTime);
    const duration = Math.floor((endTime.getTime() - startTime.getTime()) / 1000);

    session.endTime = endTime;
    session.duration = duration;
    session.notes = notes;
    session.screenshots = screenshotUploads;
    session.status = 'pending';
    await contract.save();

    res.status(200).json({
      success: true,
      data: session,
      message: 'Work session stopped and logged'
    });

  } catch (error) {
    console.error('Error stopping work session:', error);
    
    // Clean up any remaining temp files
    if (req.files && req.files.length > 0) {
      req.files.forEach(file => {
        if (fs.existsSync(file.path)) {
          fs.unlinkSync(file.path);
        }
      });
    }
    
    res.status(500).json({ 
      success: false, 
      message: 'Server error stopping work session',
      error: error.message 
    });
  }
};
// Get timesheet logs
export const getTimesheetLogs = async (req, res) => {
  try {
    const { contractId } = req.params;

    const contract = await Contract.findOne({
      _id: contractId,
      paymentStructure: 'timesheet'
    });

    if (!contract) {
      return res.status(404).json({ 
        success: false, 
        message: 'Contract not found or invalid payment structure' 
      });
    }

    res.status(200).json({
      success: true,
      data: contract.timesheets,
      message: 'Timesheet logs retrieved'
    });

  } catch (error) {
    console.error('Error fetching timesheet logs:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Server error fetching timesheet logs',
      error: error.message 
    });
  }
};

// Approve timesheet entry
export const approveTimesheetEntry = async (req, res) => {
  try {
    const { contractId, logId } = req.params;
    const userId = req.user._id;

    const contract = await Contract.findOne({
      _id: contractId,
      clientId: userId,
      paymentStructure: 'timesheet'
    });

    if (!contract) {
      return res.status(404).json({ 
        success: false, 
        message: 'Contract not found or unauthorized' 
      });
    }

    const log = contract.timesheets.id(logId);
    if (!log) {
      return res.status(404).json({ 
        success: false, 
        message: 'Timesheet entry not found' 
      });
    }

    if (log.status !== 'pending') {
      return res.status(400).json({ 
        success: false, 
        message: 'Only pending entries can be approved' 
      });
    }

    log.status = 'approved';
    log.approvedBy = userId;
    log.approvedAt = new Date();
    await contract.save();

    res.status(200).json({
      success: true,
      data: log,
      message: 'Timesheet entry approved'
    });

  } catch (error) {
    console.error('Error approving timesheet entry:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Server error approving timesheet entry',
      error: error.message 
    });
  }
};

// Dispute timesheet entry
export const disputeTimesheetEntry = async (req, res) => {
  try {
    const { contractId, logId } = req.params;
    const { reason } = req.body;
    const userId = req.user._id;

    const contract = await Contract.findOne({
      _id: contractId,
      clientId: userId,
      paymentStructure: 'timesheet'
    });

    if (!contract) {
      return res.status(404).json({ 
        success: false, 
        message: 'Contract not found or unauthorized' 
      });
    }

    const log = contract.timesheets.id(logId);
    if (!log) {
      return res.status(404).json({ 
        success: false, 
        message: 'Timesheet entry not found' 
      });
    }

    if (log.status !== 'pending') {
      return res.status(400).json({ 
        success: false, 
        message: 'Only pending entries can be disputed' 
      });
    }

    log.status = 'disputed';
    log.disputeReason = reason;
    log.disputedBy = userId;
    log.disputedAt = new Date();
    await contract.save();

    res.status(200).json({
      success: true,
      data: log,
      message: 'Timesheet entry disputed'
    });

  } catch (error) {
    console.error('Error disputing timesheet entry:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Server error disputing timesheet entry',
      error: error.message 
    });
  }
};