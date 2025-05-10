import mongoose from 'mongoose';
import Contract from '../../models/contract.model.js';
import Hiring from '../../models/hiring.model.js';
// import { sendNotification } from '../utils/notificationService.js';

/**
 * @desc    Log hours in timesheet (contractor only)
 * @route   POST /api/contracts/:contractId/timesheets
 * @access  Private (contractor)
 */
export const logTimesheet = async (req, res) => {
  try {
    const { contractId } = req.params;
    const { weekStartDate, weekEndDate, hours, notes } = req.body;
    const userId = req.user._id;

    // Validate contract exists and belongs to this contractor
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

    // Get rate from contract (could also be from hiring record)
    const rate = contract.timesheets.length > 0 
      ? contract.timesheets[0].rate 
      : (await Hiring.findById(contract.hiringId))?.offerDetails?.rate || 0;

    const newTimesheet = {
      weekStartDate: new Date(weekStartDate),
      weekEndDate: new Date(weekEndDate),
      hours: parseFloat(hours),
      rate,
      totalAmount: parseFloat(hours) * rate,
      notes,
      status: 'pending',
      _id: new mongoose.Types.ObjectId()
    };

    contract.timesheets.push(newTimesheet);
    await contract.save();

    // Notify client
    // await sendNotification({
    //   userId: contract.clientId,
    //   title: 'New Timesheet Submitted',
    //   message: `New timesheet for ${weekStartDate} to ${weekEndDate} has been submitted`,
    //   type: 'timesheet',
    //   referenceId: contractId
    // });

    res.status(201).json({
      success: true,
      data: newTimesheet,
      message: 'Timesheet logged successfully'
    });

  } catch (error) {
    console.error('Error logging timesheet:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Server error logging timesheet',
      error: error.message 
    });
  }
};

/**
 * @desc    Approve timesheet (client only)
 * @route   PUT /api/contracts/:contractId/timesheets/:timesheetId/approve
 * @access  Private (client)
 */
export const approveTimesheet = async (req, res) => {
  try {
    const { contractId, timesheetId } = req.params;
    const userId = req.user._id;

    // Validate contract exists and belongs to this client
    const contract = await Contract.findOne({
      _id: contractId,
      clientId: userId,
      paymentStructure: 'timesheet'
    });

    if (!contract) {
      return res.status(404).json({ 
        success: false, 
        message: 'Contract not found or invalid payment structure' 
      });
    }

    // Find and update timesheet
    const timesheet = contract.timesheets.id(timesheetId);
    if (!timesheet) {
      return res.status(404).json({ 
        success: false, 
        message: 'Timesheet not found' 
      });
    }

    if (timesheet.status !== 'pending') {
      return res.status(400).json({ 
        success: false, 
        message: 'Timesheet cannot be approved in its current state' 
      });
    }

    timesheet.status = 'approved';
    timesheet.approvedBy = userId;
    timesheet.approvedAt = new Date();
    await contract.save();

    // Notify contractor
    // await sendNotification({
    //   userId: contract.contractorId,
    //   title: 'Timesheet Approved',
    //   message: `Your timesheet for ${timesheet.weekStartDate} to ${timesheet.weekEndDate} has been approved`,
    //   type: 'timesheet',
    //   referenceId: contractId
    // });

    res.status(200).json({
      success: true,
      data: timesheet,
      message: 'Timesheet approved successfully'
    });

  } catch (error) {
    console.error('Error approving timesheet:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Server error approving timesheet',
      error: error.message 
    });
  }
};