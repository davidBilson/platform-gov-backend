import mongoose from 'mongoose';
import Contract from '../../models/contract.model.js';

/**
 * Start a retainer contract as a client
 */
export const startRetainer = async function(req, res) {
  try {
    const contractId = req.params.id;
    const userId = req.body.userId;

    if (!mongoose.Types.ObjectId.isValid(contractId)) {
      return res.status(400).json({ 
        success: false, 
        message: 'Invalid contract ID format' 
      });
    }

    const contract = await Contract.findOne({
      _id: contractId,
      clientId: userId,
      paymentStructure: 'retainer'
    }).populate('jobId');

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
      message: 'Error starting retainer contract',
      error: error.message 
    });
  }
};

/**
 * Submit work summary as a contractor
 */
export const submitWorkSummary = async function(req, res) {
  try {
    const contractId = req.params.id;
    const summaryText = req.body.summaryText;
    const userId = req.body.userId;

    if (!mongoose.Types.ObjectId.isValid(contractId)) {
      return res.status(400).json({ 
        success: false, 
        message: 'Invalid contract ID format' 
      });
    }

    if (!summaryText || summaryText === '') {
      return res.status(400).json({ 
        success: false, 
        message: 'Work summary text is required' 
      });
    }

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
      message: 'Error submitting work summary',
      error: error.message 
    });
  }
};

/**
 * Get retainer details for both client and contractor
 */
export const getRetainerDetails = async function(req, res) {
  try {
    const contractId = req.params.id;
    const userId = req.body.userId;

    if (!mongoose.Types.ObjectId.isValid(contractId)) {
      return res.status(400).json({ 
        success: false, 
        message: 'Invalid contract ID format' 
      });
    }

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
      // Return empty retainer data structure instead of error
      return res.status(200).json({
        success: true,
        data: {
          paymentHistory: []
        },
        message: 'No retainer details found yet'
      });
    }

    // Format the date objects for consistent serialization
    const formattedRetainer = {
      ...contract.retainer.toObject(),
      startDate: contract.retainer.startDate?.toISOString(),
      nextPaymentDate: contract.retainer.nextPaymentDate?.toISOString(),
      lastPaymentDate: contract.retainer.lastPaymentDate?.toISOString(),
      paymentHistory: contract.retainer.paymentHistory?.map(payment => ({
        ...payment.toObject(),
        periodStart: payment.periodStart?.toISOString(),
        periodEnd: payment.periodEnd?.toISOString(),
        paymentDate: payment.paymentDate?.toISOString()
      })),
      workSummaries: contract.retainer.workSummaries?.map(summary => ({
        ...summary.toObject(),
        submittedAt: summary.submittedAt?.toISOString(),
        forPeriod: summary.forPeriod?.toISOString()
      }))
    };

    res.status(200).json({
      success: true,
      data: formattedRetainer,
      message: 'Retainer details retrieved successfully'
    });

  } catch (error) {
    console.error('Error getting retainer details:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Error retrieving retainer details',
      error: error.message 
    });
  }
};

/**
 * Helper function to calculate next payment date based on frequency
 */
function calculateNextPaymentDate(startDate, frequency) {
  if (!startDate || !frequency) {
    throw new Error('Start date and frequency are required');
  }
  
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
    default:
      throw new Error(`Invalid frequency: ${frequency}`);
  }
  
  return nextDate;
}