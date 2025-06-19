import User from '../../models/user.model.js';
import Contract from '../../models/contract.model.js';
import Transaction from '../../models/transactions.model.js';
import Job from '../../models/job.created.model.js';

export const getDashboardData = async (req, res) => {
  try {
    const now = new Date();
    const oneWeekAgo = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 7);
    const oneMonthAgo = new Date(now.getFullYear(), now.getMonth() - 1, now.getDate());
    
    const [
      userCounts,
      activeContracts,
      jobCounts,
      fundingMetrics,
      payoutMetrics,
      weeklyFees,
      monthlyFees,
      pendingWithdrawals
    ] = await Promise.all([
      // User counts
      User.aggregate([
        { $group: { 
          _id: null,
          totalUsers: { $sum: 1 },
          freelancers: { $sum: { $cond: [{ $eq: ["$role", "contractor"] }, 1, 0] } },
          clients: { $sum: { $cond: [{ $eq: ["$role", "client"] }, 1, 0] } }
        }}
      ]),
      
      // Active contracts
      Contract.countDocuments({ status: 'active' }),
      
      // Job metrics
      Job.aggregate([
        { $group: { 
          _id: null,
          totalJobs: { $sum: 1 },
          fundedJobs: { $sum: { $cond: ["$isFunded", 1, 0] } }
        }}
      ]),
      
      // Project funding metrics (client-side)
      Transaction.aggregate([
        { $match: { 
          type: 'project_funding', 
          status: 'completed' 
        }},
        { $group: {
          _id: null,
          totalAmount: { $sum: "$amount" },
          totalFees: { $sum: "$fee" }
        }}
      ]),
      
      // Payout metrics (freelancer-side)
      Transaction.aggregate([
        { $match: { 
          type: 'payout', 
          status: 'completed' 
        }},
        { $group: {
          _id: null,
          totalAmount: { $sum: "$amount" },
          totalFees: { $sum: "$fee" }
        }}
      ]),
      
      // Weekly fees
      Transaction.aggregate([
        { $match: { 
          status: 'completed',
          createdAt: { $gte: oneWeekAgo } 
        }},
        { $group: { 
          _id: null, 
          totalFees: { $sum: "$fee" } 
        }}
      ]),
      
      // Monthly fees
      Transaction.aggregate([
        { $match: { 
          status: 'completed',
          createdAt: { $gte: oneMonthAgo } 
        }},
        { $group: { 
          _id: null, 
          totalFees: { $sum: "$fee" } 
        }}
      ]),
      
      // Pending withdrawals
      Transaction.aggregate([
        { $match: { 
          type: 'payout', 
          status: 'pending' 
        }},
        { $group: { 
          _id: null, 
          totalNetAmount: { $sum: "$netAmount" } 
        }}
      ])
    ]);

    // Extract results from aggregations
    const { totalUsers, freelancers, clients } = userCounts[0] || { totalUsers: 0, freelancers: 0, clients: 0 };
    const { totalJobs, fundedJobs } = jobCounts[0] || { totalJobs: 0, fundedJobs: 0 };
    const { totalAmount: fundingAmount = 0, totalFees: clientFees = 0 } = fundingMetrics[0] || {};
    const { totalAmount: payoutAmount = 0, totalFees: freelancerFees = 0 } = payoutMetrics[0] || {};
    
    // Calculate financial metrics
    const totalTransactions = fundingAmount + payoutAmount;
    const totalFees = clientFees + freelancerFees;
    const weeklyFeesTotal = weeklyFees[0]?.totalFees || 0;
    const monthlyFeesTotal = monthlyFees[0]?.totalFees || 0;
    const pendingWithdrawalsTotal = pendingWithdrawals[0]?.totalNetAmount || 0;

    res.status(200).json({
      success: true,
      data: {
        overview: {
          totalUsers: totalUsers - 1,
          totalFreelancers: freelancers,
          totalClients: clients,
          activeContracts,
          totalJobs,
          fundedJobs,
          totalTransactions,
          totalFees
        },
        revenue: {
          weeklyFees: weeklyFeesTotal,
          monthlyFees: monthlyFeesTotal,
          clientSideFees: clientFees,
          freelancerSideFees: freelancerFees
        },
        pending: {
          withdrawals: pendingWithdrawalsTotal,
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