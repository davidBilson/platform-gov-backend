import ClientProfile from '../../models/profile.client.model.js';
import Contract from '../../models/contract.model.js';
import Hiring from '../../models/hiring.model.js';

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
      .populate('jobId', 'title')
      .populate('clientId', 'name email profileImage')
      .populate('contractorId', 'name email profileImage');
    } else {
      contract = await Contract.findOne({
        jobId,
        clientId,
        contractorId
      })
      .populate('jobId', 'title')
      .populate('clientId', 'name email profileImage')
      .populate('contractorId', 'name email profileImage');
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

export const endContract = async (req, res) => {
  try {

    const { contractId } = req.params;
    const userId = req.body.userId;

    if (!contractId || !userId){
      TodayInstance.error('Incomplete credentials')
      return;
    }

    const contract = await Contract.findOne({
      _id: contractId,
      $or: [{ clientId: userId }, { contractorId: userId }]
    });

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

    contract.status = 'completed';
    contract.endDate = new Date();
    await contract.save();

    res.status(200).json({
      success: true,
      data: contract,
      message: 'Contract ended successfully'
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