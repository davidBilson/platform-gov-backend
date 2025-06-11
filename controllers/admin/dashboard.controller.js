import User from '../../models/user.model.js';
import Contract from '../../models/contract.model.js';

export const getDashboardData = async (req, res) => {
  try {
    // User counts
    const totalFreelancers = await User.countDocuments({ role: 'contractor' });
    const totalClients = await User.countDocuments({ role: 'client' });
    
    // Active contracts
    const activeContracts = await Contract.countDocuments({ status: 'active' });
    
    const weeklyFees = 0;
    const monthlyFees = 0;
    const clientSideFees = 0;
    const freelancerSideFees = 0;
    const totalEarnings = 0;
    const pendingWithdrawals = 0;
    
    res.status(200).json({
      success: true,
      data: {
        overview: {
          totalFreelancers,
          totalClients,
          activeContracts,
          totalEarnings
        },
        revenue: {
          weeklyFees,
          monthlyFees,
          clientSideFees,
          freelancerSideFees
        },
        pending: {
          withdrawals: pendingWithdrawals,
          disputes: 0,
          reports: 0
        }
      }
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Failed to fetch dashboard data',
      error: error.message
    });
  }
};