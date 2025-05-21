import Contract from '../../models/contract.model.js';
import Hiring from '../../models/hiring.model.js';
import ClientProfile from '../../models/profile.client.model.js';

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
    const { jobId, clientId, contractorId } = req.body;

    if (!jobId || !clientId || !contractorId) {
      return res.status(400).json({
        success: false,
        message: 'Missing required fields: jobId, clientId, or contractorId'
      });
    }

    const contract = await Contract.findOne({
      jobId,
      clientId,
      contractorId
    })
    .populate('jobId', 'title')
    .populate('clientId', 'name email profileImage')
    .populate('contractorId', 'name email profileImage');

    if (!contract) {
      return res.status(404).json({ 
        success: false, 
        message: 'Contract not found with the provided IDs' 
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

export const getContractorContracts = async (req, res) => {
  try {
    const contractorId = req.params.id;

    console.log('Hit!', contractorId);

    if (!contractorId) {
      return res.status(400).json({
        success: false,
        message: 'Contractor ID is required'
      });
    }

    // First get all contracts for this contractor
    const contracts = await Contract.find({ contractorId })
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
      .sort({ createdAt: -1 });

    if (!contracts || contracts.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'No contracts found for this contractor'
      });
    }

    // Get a list of all unique client IDs to fetch their profiles
    const clientIds = [...new Set(contracts.map(contract => contract.clientId?._id).filter(Boolean))];
    
    // Fetch all client profiles in a single query
    const clientProfiles = await ClientProfile.find({ user: { $in: clientIds } });
    
    // Create a map for quick lookup
    const profileMap = clientProfiles.reduce((map, profile) => {
      map[profile.user.toString()] = profile;
      return map;
    }, {});

    // Enrich the contracts with profile data
    const enrichedContracts = contracts.map(contract => {
      const contractObj = contract.toObject();
      
      if (contractObj.clientId && profileMap[contractObj.clientId._id.toString()]) {
        contractObj.clientId.profile = profileMap[contractObj.clientId._id.toString()];
      }
      
      return contractObj;
    });

    // Organize contracts by status for frontend
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