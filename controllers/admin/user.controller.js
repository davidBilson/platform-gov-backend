
import User from '../../models/user.model.js';

export const validateAdmin = async (req, res, next) => {
    try {
      const { adminId } = req.method === 'GET' || req.method === 'PUT' || req.method === 'DELETE' ? req.query || req.body : req.body;
  
      if (!adminId) {
        return res.status(400).json({
          success: false,
          message: 'Admin ID is required'
        });
      }
  
      const admin = await User.findById(adminId);
      
      if (!admin) {
        return res.status(404).json({
          success: false,
          message: 'Admin user not found'
        });
      }
  
      if (admin.role !== 'admin') {
        return res.status(403).json({
          success: false,
          message: 'Access denied. Admin privileges required'
        });
      }
  
      req.admin = admin;
      next();
    } catch (error) {
      return res.status(500).json({
        success: false,
        message: 'Server error during admin validation',
        error: error.message
      });
    }
  };

export const getAllUsers = async (req, res) => {
  try {
    const { page = 1, limit = 10, role, search } = req.query;
    const skip = (page - 1) * limit;

    // Build query object
    let query = {};
    
    // Filter by role if provided
    if (role && ['contractor', 'client', 'admin'].includes(role)) {
      query.role = role;
    }

    // Search functionality (name or email)
    if (search) {
      query.$or = [
        { name: { $regex: search, $options: 'i' } },
        { email: { $regex: search, $options: 'i' } }
      ];
    }

    // Get users with pagination
    const users = await User.find(query)
      .select('-password') // Exclude password field
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(parseInt(limit));

    // Get total count for pagination
    const totalUsers = await User.countDocuments(query);
    const totalPages = Math.ceil(totalUsers / limit);

    res.status(200).json({
      success: true,
      message: 'Users retrieved successfully',
      data: {
        users,
        pagination: {
          currentPage: parseInt(page),
          totalPages,
          totalUsers,
          hasNextPage: page < totalPages,
          hasPrevPage: page > 1
        }
      }
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Error retrieving users',
      error: error.message
    });
  }
};

export const getUserStats = async (req, res) => {
    try {
      const totalUsers = await User.countDocuments();
      const contractors = await User.countDocuments({ role: 'contractor' });
      const clients = await User.countDocuments({ role: 'client' });
      const admins = await User.countDocuments({ role: 'admin' });
      const verifiedEmails = await User.countDocuments({ isEmailVerified: true });
      const verifiedPhones = await User.countDocuments({ isPhoneVerified: true });
  
      // Recent users (last 30 days)
      const thirtyDaysAgo = new Date();
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
      const recentUsers = await User.countDocuments({ 
        createdAt: { $gte: thirtyDaysAgo } 
      });
  
      res.status(200).json({
        success: true,
        message: 'Admin stats retrieved successfully',
        data: {
          totalUsers,
          usersByRole: {
            contractors,
            clients,
            admins
          },
          verification: {
            verifiedEmails,
            verifiedPhones
          },
          recentUsers
        }
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        message: 'Error retrieving admin stats',
        error: error.message
      });
    }
  };

  export const toggleUserPriority = async (req, res) => {
    try {
      const userId = req.params.id;
      const { isHighPriority } = req.body;
  
      const user = await User.findByIdAndUpdate(
        userId,
        { isHighPriority },
        { new: true }
      );
  
      if (!user) {
        return res.status(404).json({
          success: false,
          message: 'User not found'
        });
      }
  
      res.status(200).json({
        success: true,
        message: 'Priority status updated',
        user
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        message: 'Error updating priority status',
        error: error.message
      });
    }
  };

  export const toggleUserSuspend = async (req, res) => {
    try {
      const userId = req.params.id;
      const { isSuspended } = req.body;
  
      const user = await User.findByIdAndUpdate(
        userId,
        { isSuspended },
        { new: true }
      );
  
      if (!user) {
        return res.status(404).json({
          success: false,
          message: 'User not found'
        });
      }
  
      res.status(200).json({
        success: true,
        message: 'Suspend status updated',
        user
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        message: 'Error updating suspend status',
        error: error.message
      });
    }
  };

  export const deleteUser = async (req, res) => {
    try {
      const userId = req.params.id;
  
      // Delete user and associated profile
      const [user, clientProfile, contractorProfile] = await Promise.all([
        User.findByIdAndDelete(userId),
        ClientProfile.findOneAndDelete({ user: userId }),
        ContractorProfile.findOneAndDelete({ user: userId })
      ]);
  
      if (!user) {
        return res.status(404).json({
          success: false,
          message: 'User not found'
        });
      }
  
      res.status(200).json({
        success: true,
        message: 'User deleted successfully'
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        message: 'Error deleting user',
        error: error.message
      });
    }
  };

  export const getUserProfile = async (req, res) => {
    try {
      const userId = req.params.id;
  
      const user = await User.findById(userId).select('-password');
      if (!user) {
        return res.status(404).json({
          success: false,
          message: 'User not found'
        });
      }
  
      let profile = null;
      if (user.role === 'client') {
        profile = await ClientProfile.findOne({ user: userId });
      } else if (user.role === 'contractor') {
        profile = await ContractorProfile.findOne({ user: userId });
      }
  
      res.status(200).json({
        success: true,
        data: { user, profile }
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        message: 'Error fetching user profile',
        error: error.message
      });
    }
  };