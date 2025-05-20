import mongoose from 'mongoose';
import Contract from '../../models/contract.model.js';

// Add to your existing retainer controller
export const startRetainer = async function(req, res) {
  try {
    const contractId = req.params.id;
    const userId = req.user._id;

    const contract = await Contract.findOne({
      _id: contractId,
      clientId: userId,
      paymentStructure: 'retainer'
    });

    if (!contract) {
      return res.status(404).json({ 
        success: false, 
        message: 'Contract not found or unauthorized' 
      });
    }

    if (contract.retainer && contract.retainer.startDate) {
      return res.status(400).json({ 
        success: false, 
        message: 'Retainer already started' 
      });
    }

    // Initialize retainer if not exists
    if (!contract.retainer) {
      contract.retainer = {
        recurringAmount: contract.jobId.retainerAmount,
        frequency: contract.jobId.retainerFrequency,
        paymentHistory: []
      };
    }

    contract.retainer.startDate = new Date();
    contract.retainer.nextPaymentDate = calculateNextPaymentDate(
      new Date(),
      contract.retainer.frequency
    );

    await contract.save();

    res.status(200).json({
      success: true,
      data: contract.retainer,
      message: 'Retainer contract started successfully'
    });

  } catch (error) {
    console.error('Error starting retainer:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Server error starting retainer',
      error: error.message 
    });
  }
};

export const submitWorkSummary = async function(req, res) {
  try {
    const contractId = req.params.id;
    const summaryText = req.body.summaryText;
    const userId = req.user._id;

    const contract = await Contract.findOne({
      _id: contractId,
      contractorId: userId,
      paymentStructure: 'retainer'
    });

    if (!contract) {
      return res.status(404).json({ 
        success: false, 
        message: 'Contract not found or unauthorized' 
      });
    }

    if (!contract.retainer || !contract.retainer.startDate) {
      return res.status(400).json({ 
        success: false, 
        message: 'Retainer not started yet' 
      });
    }

    // Create new work summary
    const summary = {
      text: summaryText,
      submittedAt: new Date(),
      forPeriod: contract.retainer.nextPaymentDate,
      _id: new mongoose.Types.ObjectId()
    };

    if (!contract.retainer.workSummaries) {
      contract.retainer.workSummaries = [];
    }

    contract.retainer.workSummaries.push(summary);
    await contract.save();

    res.status(201).json({
      success: true,
      data: summary,
      message: 'Work summary submitted successfully'
    });

  } catch (error) {
    console.error('Error submitting work summary:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Server error submitting work summary',
      error: error.message 
    });
  }
};

export const getRetainerDetails = async function(req, res) {
  try {
    const contractId = req.params.id;
    const userId = req.user._id;

    const contract = await Contract.findOne({
      _id: contractId,
      $or: [{ clientId: userId }, { contractorId: userId }],
      paymentStructure: 'retainer'
    });

    if (!contract) {
      return res.status(404).json({ 
        success: false, 
        message: 'Contract not found or unauthorized' 
      });
    }

    if (!contract.retainer) {
      return res.status(404).json({ 
        success: false, 
        message: 'Retainer details not found' 
      });
    }

    res.status(200).json({
      success: true,
      data: contract.retainer,
      message: 'Retainer details retrieved successfully'
    });

  } catch (error) {
    console.error('Error getting retainer details:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Server error getting retainer details',
      error: error.message 
    });
  }
};

// Helper function
function calculateNextPaymentDate(startDate, frequency) {
  const nextDate = new Date(startDate);
  switch (frequency) {
    case 'weekly':
      nextDate.setDate(nextDate.getDate() + 7);
      break;
    case 'bi-weekly':
      nextDate.setDate(nextDate.getDate() + 14);
      break;
    case 'monthly':
      nextDate.setMonth(nextDate.getMonth() + 1);
      break;
  }
  return nextDate;
}