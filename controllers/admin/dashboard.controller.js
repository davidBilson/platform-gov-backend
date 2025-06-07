import User from '../../models/user.model.js';
import Contract from '../../models/contract.model.js';

export const getDashboardData = async (req, res) => {
  try {
    // User counts
    const totalFreelancers = await User.countDocuments({ role: 'contractor' });
    const totalClients = await User.countDocuments({ role: 'client' });
    
    // Active contracts
    const activeContracts = await Contract.countDocuments({ status: 'active' });
    
    // Placeholder values - implement with your transaction logic
    const weeklyFees = 2850.75;
    const monthlyFees = 11420.30;
    const clientSideFees = 6820.15;
    const freelancerSideFees = 4600.15;
    const totalEarnings = 400000;
    const pendingWithdrawals = 23;
    
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
          disputes: 3,
          reports: 1
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