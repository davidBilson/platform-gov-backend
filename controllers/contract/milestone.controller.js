import mongoose from 'mongoose';
import Contract from '../../models/contract.model.js';

export const addMilestone = async (req, res) => {
  try {
    const contractId = req.params.id;
    const { name, description, dueDate, amount, userId } = req.body;

    if (!userId) {
      return res.status(400).json({ 
        success: false, 
        message: 'User ID is required' 
      });
    }

    const contract = await Contract.findOne({
      _id: contractId,
      clientId: userId,
      paymentStructure: 'milestone'
    });

    if (!contract) {
      return res.status(404).json({ 
        success: false, 
        message: 'Contract not found or invalid payment structure' 
      });
    }

    const newMilestone = {
      name,
      description,
      dueDate: new Date(dueDate),
      amount,
      status: 'pending',
      _id: new mongoose.Types.ObjectId()
    };

    contract.milestones.push(newMilestone);
    await contract.save();

    res.status(201).json({
      success: true,
      data: newMilestone,
      message: 'Milestone added successfully'
    });

  } catch (error) {
    console.error('Error adding milestone:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Server error adding milestone',
      error: error.message 
    });
  }
};

export const getMilestones = async (req, res) => {
  try {
    const contractId = req.params.id;

    const contract = await Contract.findOne({
      _id: contractId,
      paymentStructure: 'milestone'
    });

    if (!contract) {
      return res.status(404).json({ 
        success: false, 
        message: 'Contract not found or unauthorized' 
      });
    }

    res.status(200).json({
      success: true,
      data: contract.milestones,
      message: 'Milestones retrieved successfully'
    });

  } catch (error) {
    console.error('Error fetching milestones:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Server error fetching milestones',
      error: error.message 
    });
  }
};





export const completeMilestone = async (req, res) => {
  try {
    const { contractId, milestoneId } = req.params;

    const contract = await Contract.findOne({
      _id: contractId,

      paymentStructure: 'milestone'
    });

    if (!contract) {
      return res.status(404).json({ 
        success: false, 
        message: 'Contract not found or invalid payment structure' 
      });
    }

    const milestone = contract.milestones.id(milestoneId);
    if (!milestone) {
      return res.status(404).json({ 
        success: false, 
        message: 'Milestone not found' 
      });
    }

    if (milestone.status !== 'pending') {
      return res.status(400).json({ 
        success: false, 
        message: 'Milestone cannot be marked as completed in its current state' 
      });
    }

    milestone.status = 'completed';
    milestone.completionDate = new Date();
    await contract.save();

    res.status(200).json({
      success: true,
      data: milestone,
      message: 'Milestone marked as completed'
    });

  } catch (error) {
    console.error('Error completing milestone:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Server error completing milestone',
      error: error.message 
    });
  }
};


export const approveMilestone = async (req, res) => {
  try {
    const { contractId, milestoneId } = req.params;


    const contract = await Contract.findOne({
      _id: contractId,
      paymentStructure: 'milestone'
    });

    if (!contract) {
      return res.status(404).json({ 
        success: false, 
        message: 'Contract not found or invalid payment structure' 
      });
    }

    // Find and update milestone
    const milestone = contract.milestones.id(milestoneId);
    if (!milestone) {
      return res.status(404).json({ 
        success: false, 
        message: 'Milestone not found' 
      });
    }

    if (milestone.status !== 'completed') {
      return res.status(400).json({ 
        success: false, 
        message: 'Only completed milestones can be approved' 
      });
    }

    milestone.status = 'approved';
    milestone.clientApproved = true;
    await contract.save();

    // // Notify contractor
    // await sendNotification({
    //   userId: contract.contractorId,
    //   title: 'Milestone Approved',
    //   message: `Your milestone "${milestone.name}" has been approved`,
    //   type: 'milestone',
    //   referenceId: contractId
    // });

    // Here you would typically trigger payment processing
    // await processMilestonePayment(contract, milestone);

    res.status(200).json({
      success: true,
      data: milestone,
      message: 'Milestone approved successfully'
    });

  } catch (error) {
    console.error('Error approving milestone:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Server error approving milestone',
      error: error.message 
    });
  }
};

/**
 * @desc    Mark milestone as paid (system or admin)
 * @route   PUT /api/contracts/:contractId/milestones/:milestoneId/mark-paid
 * @access  Private (admin/system)
 */
export const markMilestonePaid = async (req, res) => {
  try {
    const { contractId, milestoneId } = req.params;

    const contract = await Contract.findById(contractId);
    if (!contract || contract.paymentStructure !== 'milestone') {
      return res.status(404).json({ 
        success: false, 
        message: 'Contract not found or invalid payment structure' 
      });
    }

    const milestone = contract.milestones.id(milestoneId);
    if (!milestone) {
      return res.status(404).json({ 
        success: false, 
        message: 'Milestone not found' 
      });
    }

    if (milestone.status !== 'approved') {
      return res.status(400).json({ 
        success: false, 
        message: 'Only approved milestones can be marked as paid' 
      });
    }

    milestone.status = 'paid';
    milestone.paymentDate = new Date();
    await contract.save();

    // Notify both parties
    // await sendNotification({
    //   userId: contract.contractorId,
    //   title: 'Milestone Paid',
    //   message: `Payment for milestone "${milestone.name}" has been processed`,
    //   type: 'payment',
    //   referenceId: contractId
    // });

    // await sendNotification({
    //   userId: contract.clientId,
    //   title: 'Payment Processed',
    //   message: `Payment for milestone "${milestone.name}" has been completed`,
    //   type: 'payment',
    //   referenceId: contractId
    // });

    res.status(200).json({
      success: true,
      data: milestone,
      message: 'Milestone marked as paid'
    });

  } catch (error) {
    console.error('Error marking milestone as paid:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Server error marking milestone as paid',
      error: error.message 
    });
  }
};

/**
 * @desc    Dispute a milestone
 * @route   PUT /api/contracts/:contractId/milestones/:milestoneId/dispute
 * @access  Private (client or contractor)
 */
export const disputeMilestone = async (req, res) => {
  try {
    const { contractId, milestoneId } = req.params;
    const { reason } = req.body;
    const userId = req.user._id;

    // Validate contract exists and user is a party to it
    const contract = await Contract.findOne({
      _id: contractId,
      $or: [{ clientId: userId }, { contractorId: userId }],
      paymentStructure: 'milestone'
    });

    if (!contract) {
      return res.status(404).json({ 
        success: false, 
        message: 'Contract not found or unauthorized' 
      });
    }

    const milestone = contract.milestones.id(milestoneId);
    if (!milestone) {
      return res.status(404).json({ 
        success: false, 
        message: 'Milestone not found' 
      });
    }

    if (milestone.status === 'disputed') {
      return res.status(400).json({ 
        success: false, 
        message: 'Milestone is already disputed' 
      });
    }

    milestone.status = 'disputed';
    milestone.disputeReason = reason;
    milestone.disputeRaisedBy = userId;
    await contract.save();

    // Notify the other party
    // const notifyUserId = userId.equals(contract.clientId) 
    //   ? contract.contractorId 
    //   : contract.clientId;

    // await sendNotification({
    //   userId: notifyUserId,
    //   title: 'Milestone Disputed',
    //   message: `Milestone "${milestone.name}" has been disputed`,
    //   type: 'dispute',
    //   referenceId: contractId
    // });

    res.status(200).json({
      success: true,
      data: milestone,
      message: 'Milestone disputed successfully'
    });

  } catch (error) {
    console.error('Error disputing milestone:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Server error disputing milestone',
      error: error.message 
    });
  }
};



/**
 * @desc    Get a single milestone (client or contractor)
 * @route   GET /api/contracts/:contractId/milestones/:milestoneId
 * @access  Private (client or contractor)
 */
export const getMilestone = async (req, res) => {
  try {
    const { contractId, milestoneId } = req.params;
    const userId = req.user._id;

    // Validate contract exists and user is a party to it
    const contract = await Contract.findOne({
      _id: contractId,
      $or: [{ clientId: userId }, { contractorId: userId }],
      paymentStructure: 'milestone'
    });

    if (!contract) {
      return res.status(404).json({ 
        success: false, 
        message: 'Contract not found or unauthorized' 
      });
    }

    const milestone = contract.milestones.id(milestoneId);
    if (!milestone) {
      return res.status(404).json({ 
        success: false, 
        message: 'Milestone not found' 
      });
    }

    res.status(200).json({
      success: true,
      data: milestone,
      message: 'Milestone retrieved successfully'
    });

  } catch (error) {
    console.error('Error fetching milestone:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Server error fetching milestone',
      error: error.message 
    });
  }
};