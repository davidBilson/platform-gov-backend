import mongoose from 'mongoose';
import Contract from '../../models/contract.model.js';
import { uploadImage } from '../../utils/cloudinary.js';
import fs from 'fs';
import path from 'path';
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
export const stopWorkSession = async (req, res) => {
  try {
    console.log('====== STOP WORK SESSION START ======');
    const { contractId, sessionId } = req.params;
    console.log('Params:', { contractId, sessionId });

    // FIXED: Access userId directly from body
    const { notes, userId } = req.body;
    console.log('Body:', { notes, userId });

    // Enhanced file logging
    if (!req.files || req.files.length === 0) {
      console.log('No files received in request');
    } else {
      console.log(`Received ${req.files.length} files`);
      req.files.forEach(file => {
        console.log(`File: ${file.originalname}, Size: ${file.size}, Path: ${file.path}`);
      });
    }

    const files = req.files || [];

    const contract = await Contract.findOne({
      _id: contractId,
      contractorId: userId,
      paymentStructure: 'timesheet'
    });

    if (!contract) {
      console.log('Contract not found');
      return res.status(404).json({
        success: false,
        message: 'Contract not found or invalid payment structure'
      });
    }

    const session = contract.timesheets.id(sessionId);
    if (!session) {
      console.log('Session not found');
      return res.status(404).json({
        success: false,
        message: 'Work session not found'
      });
    }

    if (session.status !== 'active') {
      console.log('Session not active');
      return res.status(400).json({
        success: false,
        message: 'Session is not active'
      });
    }

    // FIXED: Upload screenshots to Cloudinary with enhanced error handling
    const screenshotUploads = [];
    if (files && files.length > 0) {
      console.log(`Processing ${files.length} screenshots`);

      for (const file of files) {
        try {
          console.log(`Processing file: ${file.path}`);

          // Verify file exists and is valid before attempting to upload
          if (!fs.existsSync(file.path)) {
            console.error(`File does not exist: ${file.path}`);
            continue;
          }

          // Verify file size
          const stats = fs.statSync(file.path);
          if (stats.size > 5 * 1024 * 1024) {
            console.error(`File too large: ${file.path} (${stats.size} bytes)`);
            fs.unlinkSync(file.path);
            continue;
          }

          // Verify file type by extension
          const fileExt = path.extname(file.originalname).toLowerCase();
          if (!['.jpg', '.jpeg', '.png', '.gif'].includes(fileExt)) {
            console.error(`Invalid file type: ${fileExt}`);
            fs.unlinkSync(file.path);
            continue;
          }

          console.log('Uploading to Cloudinary...');
          // FIXED: Using the correct uploadImage function from cloudinary utils
          const result = await uploadImage(file.path, 'timesheets');
          console.log('Upload successful:', result.secure_url);

          screenshotUploads.push({
            imagePath: result.secure_url,
            publicId: result.public_id,
            uploadedAt: new Date()
          });

          // Clean up temp file
          try {
            fs.unlinkSync(file.path);
            console.log('Temp file deleted successfully');
          } catch (cleanupError) {
            console.error('Error cleaning up temp file:', cleanupError);
            // Attempt to delete again after a short delay
            await new Promise(resolve => setTimeout(resolve, 500));
            if (fs.existsSync(file.path)) {
              fs.unlinkSync(file.path);
            }
          }
        } catch (uploadError) {
          console.error('Error uploading screenshot:', uploadError);

          // Clean up temp file if upload failed
          try {
            if (fs.existsSync(file.path)) {
              fs.unlinkSync(file.path);
              console.log('Temp file deleted after upload failure');
            }
          } catch (cleanupError) {
            console.error('Error cleaning up temp file after failed upload:', cleanupError);
          }
        }
      }
    }

    console.log('Updating session in database');
    const endTime = new Date();
    const startTime = new Date(session.startTime);
    const duration = Math.floor((endTime.getTime() - startTime.getTime()) / 1000);

    session.endTime = endTime;
    session.duration = duration;
    session.notes = notes;
    session.screenshots = screenshotUploads;
    session.status = 'pending';

    // Add additional metadata
    session.updatedAt = new Date();
    // session.screenshotCount = screenshotUploads.length;

    await contract.save();
    console.log('Session updated successfully with', screenshotUploads.length, 'screenshots');

    console.log('====== STOP WORK SESSION END ======');
    res.status(200).json({
      success: true,
      data: session,
      message: 'Work session stopped and logged',
      screenshotCount: screenshotUploads.length
    });

  } catch (error) {
    console.error('====== ERROR IN STOP WORK SESSION ======');
    console.error(error);

    // Enhanced cleanup of any remaining temp files
    if (req.files && Array.isArray(req.files)) {
      console.log('Cleaning up temporary files after error');
      for (const file of req.files) {
        try {
          if (fs.existsSync(file.path)) {
            fs.unlinkSync(file.path);
            console.log(`Deleted: ${file.path}`);
          }
        } catch (cleanupError) {
          console.error('Error during cleanup in error handler:', cleanupError);
        }
      }
    }

    res.status(500).json({
      success: false,
      message: 'Server error stopping work session',
      error: error.message,
      receivedFiles: req.files ? req.files.length : 0
    });
  }
};

export const approveTimesheetEntry = async (req, res) => {
  try {
    const { contractId, logId } = req.params;
    const userId = req.body.userId || req.query.userId;

    if (!userId) {
      return res.status(400).json({
        success: false,
        message: 'User ID is required'
      });
    }

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

export const disputeTimesheetEntry = async (req, res) => {
  try {
    const { contractId, logId } = req.params;
    const { reason, userId } = req.body;

    if (!userId) {
      return res.status(400).json({
        success: false,
        message: 'User ID is required'
      });
    }

    if (!reason) {
      return res.status(400).json({
        success: false,
        message: 'Dispute reason is required'
      });
    }

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

export const setMaxHours = async (req, res) => {
  try {
    const contractId = req.params.id;
    const { hours } = req.body;

    if (!hours || isNaN(hours)) {
      return res.status(400).json({
        success: false,
        message: 'Valid hours value is required'
      });
    }

    const parsedHours = parseFloat(hours);
    if (parsedHours <= 0) {
      return res.status(400).json({
        success: false,
        message: 'Hours must be a positive number'
      });
    }

    const contract = await Contract.findOne({
      _id: contractId,
      status: 'active'
    });

    if (!contract) {
      return res.status(404).json({
        success: false,
        message: 'Contract not found or unauthorized'
      });
    }

    contract.maxHours = parsedHours;
    await contract.save();

    res.status(200).json({
      success: true,
      data: {
        maxHours: contract.maxHours,
        contractId: contract._id
      },
      message: 'Maximum hours set successfully'
    });

  } catch (error) {
    console.error('Error setting max hours:', error);
    res.status(500).json({
      success: false,
      message: 'Server error setting max hours',
      error: error.message
    });
  }
};

export const logHoursManually = async (req, res) => {
  try {
    const contractId = req.params.id;
    const { hours, description, userId } = req.body;
    const files = req.files || [];

    console.log('Manual hours logging:', { contractId, hours, description, userId, fileCount: files.length });

    if (!hours || !userId) {
      return res.status(400).json({
        success: false,
        message: 'Hours and user ID are required'
      });
    }

    const parsedHours = parseFloat(hours);
    if (isNaN(parsedHours) || parsedHours <= 0) {
      return res.status(400).json({
        success: false,
        message: 'Hours must be a valid positive number'
      });
    }

    // Convert hours to seconds (this is what we expect based on frontend)
    const durationInSeconds = Math.round(parsedHours * 3600);

    const contract = await Contract.findOne({
      _id: contractId,
      contractorId: userId,
      paymentStructure: 'timesheet',
      status: 'active'
    });

    if (!contract) {
      return res.status(404).json({
        success: false,
        message: 'Contract not found or invalid'
      });
    }

    if (contract.maxHours) {
      const totalExistingSeconds = contract.timesheets.reduce((total, session) => {
        return total + (session.duration || 0);
      }, 0);

      const totalExistingHours = totalExistingSeconds / 3600;
      const newTotalHours = totalExistingHours + parsedHours;

      console.log('Max hours check:', {
        maxHours: contract.maxHours,
        existingHours: totalExistingHours,
        newHours: parsedHours,
        newTotal: newTotalHours
      });

      if (newTotalHours > contract.maxHours) {
        return res.status(400).json({
          success: false,
          message: `Logging these hours would exceed the maximum allowed hours. Current: ${totalExistingHours.toFixed(2)}h, Adding: ${parsedHours}h, Max: ${contract.maxHours}h`
        });
      }
    }

    // Upload screenshots
    const screenshotUploads = [];
    for (const file of files) {
      try {
        console.log(`Processing screenshot: ${file.originalname}`);

        // Verify file exists and is valid
        if (!fs.existsSync(file.path)) {
          console.error(`File does not exist: ${file.path}`);
          continue;
        }

        // Verify file size (5MB limit)
        const stats = fs.statSync(file.path);
        if (stats.size > 5 * 1024 * 1024) {
          console.error(`File too large: ${file.path} (${stats.size} bytes)`);
          fs.unlinkSync(file.path);
          continue;
        }

        // Verify file type
        const fileExt = path.extname(file.originalname).toLowerCase();
        if (!['.jpg', '.jpeg', '.png', '.gif'].includes(fileExt)) {
          console.error(`Invalid file type: ${fileExt}`);
          fs.unlinkSync(file.path);
          continue;
        }

        const result = await uploadImage(file.path, 'timesheets');
        console.log('Screenshot uploaded successfully:', result.secure_url);

        screenshotUploads.push({
          imagePath: result.secure_url,
          publicId: result.public_id,
          uploadedAt: new Date()
        });

        // Clean up temp file
        fs.unlinkSync(file.path);
      } catch (uploadError) {
        console.error('Error uploading screenshot:', uploadError);
        if (fs.existsSync(file.path)) {
          fs.unlinkSync(file.path);
        }
      }
    }

    // Create manual log entry - FIXED: Proper time calculation
    const now = new Date();
    const startTime = new Date(now.getTime() - (durationInSeconds * 1000));

    const manualLog = {
      startTime: startTime,
      endTime: now,
      duration: durationInSeconds, // Store duration in seconds
      notes: description || '',
      screenshots: screenshotUploads,
      status: 'pending',
      isManual: true,
      createdAt: now,
      _id: new mongoose.Types.ObjectId()
    };

    console.log('Creating manual log:', {
      startTime: manualLog.startTime,
      endTime: manualLog.endTime,
      duration: manualLog.duration,
      screenshotCount: screenshotUploads.length
    });

    contract.timesheets.push(manualLog);
    await contract.save();

    console.log('Manual hours logged successfully');

    res.status(201).json({
      success: true,
      data: manualLog,
      message: 'Hours logged manually',
      screenshotCount: screenshotUploads.length
    });

  } catch (error) {
    console.error('Error logging hours manually:', error);

    // Clean up any remaining temp files
    if (req.files && Array.isArray(req.files)) {
      for (const file of req.files) {
        try {
          if (fs.existsSync(file.path)) {
            fs.unlinkSync(file.path);
          }
        } catch (cleanupError) {
          console.error('Error cleaning up temp file:', cleanupError);
        }
      }
    }

    res.status(500).json({
      success: false,
      message: 'Server error logging hours manually',
      error: error.message
    });
  }
};