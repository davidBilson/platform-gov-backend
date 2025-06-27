import mongoose from 'mongoose';
import Withdrawal from '../../models/withdrawal.model.js';

export const fetchWithdrawals = async (req, res) => {
  try {
    const userId = req.params.id;
    const { page = 1, limit = 20, status } = req.query;
    
    // Validate user ID
    if (!mongoose.Types.ObjectId.isValid(userId)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid user ID'
      });
    }

    // Build query
    const query = { userId };
    if (status) query.status = status;

    const options = {
      page: parseInt(page),
      limit: parseInt(limit),
      sort: { createdAt: -1 },
      lean: true
    };

    // Execute paginated query
    const withdrawals = await Withdrawal.paginate(query, options);

    res.status(200).json({
      success: true,
      totalWithdrawals: withdrawals.totalDocs,
      totalPages: withdrawals.totalPages,
      currentPage: withdrawals.page,
      withdrawals: withdrawals.docs
    });
  } catch (error) {
    console.error('Error fetching withdrawals:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch withdrawals',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};

export const fetchAllWithdrawals = async (req, res) => {
    try {
      const { 
        page = 1, 
        limit = 40, 
        status, 
        userId, 
        minAmount, 
        maxAmount,
        startDate,
        endDate
      } = req.query;
      
      // Build query
      const query = {};
      
      if (status) query.status = status;
      if (userId) query.userId = userId;
      
      // Amount range filter
      if (minAmount || maxAmount) {
        query.amount = {};
        if (minAmount) query.amount.$gte = parseFloat(minAmount);
        if (maxAmount) query.amount.$lte = parseFloat(maxAmount);
      }
      
      // Date range filter
      if (startDate || endDate) {
        query.createdAt = {};
        if (startDate) query.createdAt.$gte = new Date(startDate);
        if (endDate) query.createdAt.$lte = new Date(endDate);
      }
  
      const options = {
        page: parseInt(page),
        limit: parseInt(limit),
        sort: { createdAt: -1 },
        populate: {
          path: 'userId',
          select: 'name email role'
        },
        lean: true
      };
  
      // Execute paginated query
      const withdrawals = await Withdrawal.paginate(query, options);
  
      // Format response
      const formattedWithdrawals = withdrawals.docs.map(w => ({
        ...w,
        user: w.userId ? {
          _id: w.userId._id,
          name: w.userId.name,
          email: w.userId.email,
          role: w.userId.role
        } : null,
        userId: undefined
      }));
  
      res.status(200).json({
        success: true,
        totalWithdrawals: withdrawals.totalDocs,
        totalPages: withdrawals.totalPages,
        currentPage: withdrawals.page,
        withdrawals: formattedWithdrawals
      });
    } catch (error) {
      console.error('Error fetching all withdrawals:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to fetch withdrawals',
        error: process.env.NODE_ENV === 'development' ? error.message : undefined
      });
    }
  };