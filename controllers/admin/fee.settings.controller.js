import PlatformFees from '../../models/platform.fees.model.js';

export const getFeeSettings = async (req, res) => {
  try {
    const settings = await PlatformFees.getSettings();
    res.status(200).json({
      success: true,
      data: settings
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Failed to fetch fee settings',
      error: error.message
    });
  }
};

export const updateFeeSettings = async (req, res) => {
  try {
    const { freelancerServiceFee, clientServiceFee, minimumWithdrawal, payoutDelay } = req.body;
    console.log('hit updateFeeSettings');    
    if (freelancerServiceFee < 0 || freelancerServiceFee > 50) {
      return res.status(400).json({
        success: false,
        message: 'Freelancer fee must be between 0-50%'
      });
    }
    
    if (clientServiceFee < 0 || clientServiceFee > 50) {
      return res.status(400).json({
        success: false,
        message: 'Client fee must be between 0-50%'
      });
    }
    
    const settings = await PlatformFees.findOneAndUpdate(
      {},
      { freelancerServiceFee, clientServiceFee, minimumWithdrawal, payoutDelay },
      { new: true, upsert: true }
    );
    
    res.status(200).json({
      success: true,
      message: 'Fee settings updated successfully',
      data: settings
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Failed to update fee settings',
      error: error.message
    });
  }
};