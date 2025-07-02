import ClientProfile from '../../models/profile.client.model.js';
import Hiring from '../../models/hiring.model.js';

import Job from '../../models/job.created.model.js';
import Contract from '../../models/contract.model.js';


export const initPayAmount = async (req, res) => {
  try {
    const contractId = req.params.id;
    const { amount, clientId } = req.body;

    // Validate required fields
    if (!amount || !clientId) {
      return res.status(400).json({
        success: false,
        message: 'Amount and clientId are required'
      });
    }

    // Find and update contract
    const contract = await Contract.findById(contractId);
    if (!contract) {
      return res.status(404).json({
        success: false,
        message: 'Contract not found'
      });
    }

    // Verify client ownership
    if (contract.clientId.toString() !== clientId) {
      return res.status(403).json({
        success: false,
        message: 'Unauthorized: Not the contract client'
      });
    }

    // Update time-based payment amount
    contract.timeBasedPayment.amount = amount;
    await contract.save();

    res.status(200).json({
      success: true,
      message: 'Payment amount initialized successfully',
      data: {
        contractId: contract._id,
        timeBasedPayment: contract.timeBasedPayment
      }
    });

  } catch (error) {
    console.error('Error initializing payment amount:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error',
      error: error.message
    });
  }
};

// CLIENT - Edit contract/job price
export const editContractPrice = async (req, res) => {
  try {
    const jobId = req.params.id;
    const { userId, price } = req.body;

    // Validate required fields
    if (!userId || price === undefined) {
      return res.status(400).json({
        success: false,
        message: 'UserId and price are required'
      });
    }

    // Find the job
    const job = await Job.findById(jobId);
    if (!job) {
      return res.status(404).json({
        success: false,
        message: 'Job not found'
      });
    }

    // Verify user is the job owner
    if (job.userId.toString() !== userId) {
      return res.status(403).json({
        success: false,
        message: 'Unauthorized: Not the job owner'
      });
    }

    // Check payment type and update accordingly
    if (job.paymentType === 'fixed-price') {
      return res.status(400).json({
        success: false,
        message: 'Cannot edit price for fixed-price jobs'
      });
    }

    if (job.paymentType === 'hourly') {
      job.price = price;
    } else if (job.paymentType === 'retainer') {
      job.retainerAmount = price;
    } else {
      return res.status(400).json({
        success: false,
        message: 'Invalid payment type'
      });
    }

    await job.save();

    res.status(200).json({
      success: true,
      message: 'Contract price updated successfully',
      data: {
        jobId: job._id,
        paymentType: job.paymentType,
        price: job.paymentType === 'hourly' ? job.price : job.retainerAmount
      }
    });

  } catch (error) {
    console.error('Error editing contract price:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error',
      error: error.message
    });
  }
};

// CLIENT - Start contract
export const startContract = async (req, res) => {
  try {
    const contractId = req.params.id;
    const { clientId } = req.query;

    // Validate required fields
    if (!clientId) {
      return res.status(400).json({
        success: false,
        message: 'ClientId is required'
      });
    }

    // Find contract
    const contract = await Contract.findById(contractId);
    if (!contract) {
      return res.status(404).json({
        success: false,
        message: 'Contract not found'
      });
    }

    // Verify client ownership
    if (contract.clientId.toString() !== clientId) {
      return res.status(403).json({
        success: false,
        message: 'Unauthorized: Not the contract client'
      });
    }

    // Check if contract is already started
    if (contract.isStarted) {
      return res.status(400).json({
        success: false,
        message: 'Contract is already started'
      });
    }

    // Start the contract
    contract.isStarted = true;
    contract.status = 'active';
    await contract.save();

    res.status(200).json({
      success: true,
      message: 'Contract started successfully',
      data: {
        contractId: contract._id,
        isStarted: contract.isStarted,
        status: contract.status
      }
    });

  } catch (error) {
    console.error('Error starting contract:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error',
      error: error.message
    });
  }
};

// CONTRACTOR - Confirm payment amount
export const confirmPaymentAmount = async (req, res) => {
  try {
    const contractId = req.params.id;
    const { contractorId } = req.body;

    // Validate required fields
    if (!contractorId) {
      return res.status(400).json({
        success: false,
        message: 'ContractorId is required'
      });
    }

    // Find contract
    const contract = await Contract.findById(contractId);
    if (!contract) {
      return res.status(404).json({
        success: false,
        message: 'Contract not found'
      });
    }

    // Verify contractor ownership
    if (contract.contractorId.toString() !== contractorId) {
      return res.status(403).json({
        success: false,
        message: 'Unauthorized: Not the contract contractor'
      });
    }

    // Check if payment amount is already confirmed
    if (contract.isPaymentAmountConfirmed) {
      return res.status(400).json({
        success: false,
        message: 'Payment amount is already confirmed'
      });
    }

    // Confirm payment amount
    contract.isPaymentAmountConfirmed = true;
    await contract.save();

    res.status(200).json({
      success: true,
      message: 'Payment amount confirmed successfully',
      data: {
        contractId: contract._id,
        isPaymentAmountConfirmed: contract.isPaymentAmountConfirmed
      }
    });

  } catch (error) {
    console.error('Error confirming payment amount:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error',
      error: error.message
    });
  }
};

export const createContract = async (req, res) => {
  try {
    const { hiringId, clientId, contractorId } = req.body;

    if (!hiringId || !clientId || !contractorId) {
      return res.status(400).json({
        success: false,
        message: 'Missing required fields: hiringId, clientId, or contractorId'
      });
    }

    const hiring = await Hiring.findOne({
      _id: hiringId,
      status: 'accepted',
      clientId: clientId,
      contractorId: contractorId
    });

    if (!hiring) {
      return res.status(404).json({ 
        success: false, 
        message: 'Valid hiring record not found or IDs do not match' 
      });
    }

    let paymentStructure;
    switch (hiring.offerDetails.paymentType) {
      case 'fixed-price':
        paymentStructure = 'milestone';
        break;
      case 'hourly':
        paymentStructure = 'timesheet';
        break;
      case 'retainer':
        paymentStructure = 'retainer';
        break;
      default:
        paymentStructure = 'milestone';
    }

    const contract = new Contract({
      hiringId,
      jobId: hiring.jobId,
      contractorId,
      clientId,
      startDate: hiring.offerDetails.startDate,
      endDate: hiring.offerDetails.estimatedEndDate,
      paymentStructure,
      status: 'active'
    });

    if (paymentStructure === 'milestone' && hiring.offerDetails.milestones?.length > 0) {
      contract.milestones = hiring.offerDetails.milestones.map((m, index) => ({
        name: `Milestone ${index + 1}`,
        description: m.description,
        dueDate: m.dueDate,
        amount: m.price,
        status: 'pending',
        _id: new mongoose.Types.ObjectId()
      }));
    }

    if (paymentStructure === 'retainer') {
      contract.retainer = {
        recurringAmount: hiring.offerDetails.rate,
        frequency: 'monthly',
        nextPaymentDate: new Date(hiring.offerDetails.startDate),
        paymentHistory: []
      };
    }

    await contract.save();

    res.status(201).json({
      success: true,
      data: contract,
      message: 'Contract created successfully'
    });

  } catch (error) {
    console.error('Error creating contract:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Server error creating contract',
      error: error.message 
    });
  }
};

export const getSingleContract = async (req, res) => {
  try {

    const { jobId, clientId, contractorId, mutualContractId } = req.body;

    const hasMutualId = mutualContractId;
    const hasRequiredIds = jobId && clientId && contractorId;

    if (!hasMutualId && !hasRequiredIds) {
      return res.status(400).json({
        success: false,
        message: 'Missing required fields: either mutualContractId or (jobId, clientId, and contractorId)'
      });
    }

    let contract;

    if (mutualContractId) {
      contract = await Contract.findOne({
        _id: mutualContractId
      })
      .populate('jobId', 'jobTitle')
      .populate('clientId', 'name email profileImage')
      .populate('contractorId', 'name email profileImage bankAccounts isHighPriority');
    } else {
      contract = await Contract.findOne({
        jobId,
        clientId,
        contractorId
      })
      .populate('jobId', 'jobTitle')
      .populate('clientId', 'name email profileImage')
      .populate('contractorId', 'name email profileImage bankAccounts isHighPriority');
    }

    if (!contract) {
      return res.status(404).json({ 
        success: false, 
        message: 'Contract not found with the provided parameters' 
      });
    }

    res.status(200).json({
      success: true,
      data: contract
    });

  } catch (error) {
    console.error('Error fetching contract:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Server error fetching contract',
      error: error.message 
    });
  }
};

export const getContracts = async (req, res) => {
  try {
    const userId = req.params.id;

    if (!userId) {
      return res.status(400).json({
        success: false,
        message: 'User ID is required'
      });
    }

    const contracts = await Contract.find({ 
      $or: [{ clientId: userId }, { contractorId: userId }]
     })
      .populate({
        path: 'hiringId',
        select: 'applicationId'
      })
      .populate({
        path: 'jobId',
        select: 'jobTitle description location employmentType paymentType retainerAmount retainerFrequency price clientName clientLogo'
      })
      .populate({
        path: 'clientId',
        select: 'name email'
      })
      .populate({
        path: 'contractorId',
        select: 'name email'
      })
      .sort({ createdAt: -1 });

    if (!contracts || contracts.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'No contracts found for this contractor'
      });
    }

    const clientIds = [...new Set(contracts.map(contract => contract.clientId?._id).filter(Boolean))];
    
    const clientProfiles = await ClientProfile.find({ user: { $in: clientIds } });
    
    const profileMap = clientProfiles.reduce((map, profile) => {
      map[profile.user.toString()] = profile;
      return map;
    }, {});

    const enrichedContracts = contracts.map(contract => {
      const contractObj = contract.toObject();
      
      if (contractObj.clientId && profileMap[contractObj.clientId._id.toString()]) {
        contractObj.clientId.profile = profileMap[contractObj.clientId._id.toString()];
      }
      
      return contractObj;
    });

    const organizedContracts = {
      active: enrichedContracts.filter(c => c.status === 'active'),
      inactive: enrichedContracts.filter(c => c.status === 'paused' || c.status === 'disputed'),
      completed: enrichedContracts.filter(c => c.status === 'completed' || c.status === 'cancelled')
    };

    res.status(200).json({
      success: true,
      data: organizedContracts
    });

  } catch (error) {
    console.error('Error fetching contractor contracts:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Server error fetching contracts',
      error: error.message 
    });
  }
};

const calculateTotalEarnings = async (contract) => {
  let totalEarnings = 0;

  // Get the job details for rate information
  const job = await Job.findById(contract.jobId);
  if (!job) {
    throw new Error('Associated job not found');
  }

  switch (contract.paymentStructure) {
    case 'milestone':
      // Sum up all completed milestones
      const completedMilestones = contract.milestones?.filter(
        milestone => milestone.status === 'completed' || milestone.status === 'approved' || milestone.status === 'paid'
      ) || [];
      
      totalEarnings = completedMilestones.reduce((sum, milestone) => {
        return sum + (milestone.amount || 0);
      }, 0);
      break;

    case 'timesheet':
      // Calculate total hours worked multiplied by hourly rate
      const approvedTimesheets = contract.timesheets?.filter(
        timesheet => timesheet.status === 'approved' || timesheet.status === 'paid'
      ) || [];
      
      totalEarnings = approvedTimesheets.reduce((sum, timesheet) => {
        const hours = timesheet.duration || 0; // duration should be in hours
        const rate = timesheet.rate || job.price || 0; // use timesheet rate or job price
        return sum + (hours * rate);
      }, 0);
      break;

    case 'retainer':
      // Sum up all completed retainer payments
      const completedPayments = contract.retainer?.paymentHistory?.filter(
        payment => payment.status === 'completed'
      ) || [];
      
      totalEarnings = completedPayments.reduce((sum, payment) => {
        return sum + (payment.amount || 0);
      }, 0);
      break;

    default:
      totalEarnings = 0;
      break;
  }

  return totalEarnings;
};

export const endContract = async (req, res) => {
  try {
    const { contractId } = req.params;
    const userId = req.body.userId;

    if (!contractId || !userId) {
      return res.status(400).json({
        success: false,
        message: 'Contract ID and User ID are required'
      });
    }

    const contract = await Contract.findOne({
      _id: contractId,
      $or: [{ clientId: userId }, { contractorId: userId }]
    }).populate('jobId');

    if (!contract) {
      return res.status(404).json({
        success: false,
        message: 'Contract not found or unauthorized'
      });
    }
    
    if (contract.status === 'completed') {
      return res.status(200).json({
        success: false,
        message: 'Contract already completed!'
      });
    }

    if (contract.status !== 'active') {
      return res.status(400).json({
        success: false,
        message: 'Only active contracts can be ended'
      });
    }

    // Validate earnings amount
    const overAllEarnings = await calculateTotalEarnings(contract);
    
    if (overAllEarnings < 0) {
      return res.status(400).json({ 
        success: false, 
        message: "Contract earnings cannot be negative" 
      });
    }

    // Update contract with calculated earnings
    contract.totalEarnings = overAllEarnings;
    contract.status = 'completed';
    contract.endDate = new Date();
    await contract.save();

    res.status(200).json({
      success: true,
      data: contract,
      message: 'Contract ended successfully',
      totalEarnings: overAllEarnings
    });

  } catch (error) {
    console.error('Error ending contract:', error);
    res.status(500).json({
      success: false,
      message: 'Server error ending contract',
      error: error.message
    });
  }
};