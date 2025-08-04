import Subscription from '../../models/subscriptions.model.js';
import AdminSubscriptionSettings from '../../models/admin.subscription.settings.model.js';
import { v4 as uuidv4 } from 'uuid';


export const setSubscriptionPricing = async (req, res) => {
  try {
    const { consultant, client } = req.body;

    // Validate pricing data
    if (!consultant?.monthly || !consultant?.annual || !client?.monthly || !client?.annual) {
      return res.status(400).json({
        success: false,
        message: 'All pricing fields are required',
        required: ['consultant.monthly', 'consultant.annual', 'client.monthly', 'client.annual']
      });
    }

    if (consultant.monthly <= 0 || consultant.annual <= 0 || client.monthly <= 0 || client.annual <= 0) {
      return res.status(400).json({
        success: false,
        message: 'All prices must be greater than 0'
      });
    }

    // Find existing settings or create new one
    let settings = await AdminSubscriptionSettings.findOne();
    
    if (!settings) {
      // Create default settings if none exist
      settings = new AdminSubscriptionSettings({
        subscriptionPricing: { consultant, client },
        gccDiscount: {
          token: uuidv4(),
          percentOff: 10
        },
        adminFeePercent: 5,
        tips: 'Default subscription tips',
        earlyAccessDurationHours: 24
      });
    } else {
      settings.subscriptionPricing = { consultant, client };
    }

    await settings.save();
    
    res.status(200).json({
      success: true,
      message: 'Subscription pricing updated successfully',
      data: settings.subscriptionPricing
    });
  } catch (error) {
    console.error('Error setting subscription pricing:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to set subscription pricing',
      error: error.message
    });
  }
};

/**
 * Generate a new discount token for GCC certification
 * @route POST /admin/subscription/gcc-discount
 * @access Admin only
 */
export const generateGCCDiscountToken = async (req, res) => {
  try {
    const { percentOff = 10 } = req.body;

    if (percentOff < 0 || percentOff > 100) {
      return res.status(400).json({
        success: false,
        message: 'Discount percentage must be between 0 and 100'
      });
    }

    const newToken = uuidv4();
    
    // Find existing settings or create new one
    let settings = await AdminSubscriptionSettings.findOne();
    
    if (!settings) {
      // Create default settings if none exist
      settings = new AdminSubscriptionSettings({
        subscriptionPricing: {
          consultant: { monthly: 29.99, annual: 299.99 },
          client: { monthly: 19.99, annual: 199.99 }
        },
        gccDiscount: {
          token: newToken,
          percentOff
        },
        adminFeePercent: 5,
        tips: 'Default subscription tips',
        earlyAccessDurationHours: 24
      });
    } else {
      settings.gccDiscount = {
        token: newToken,
        percentOff
      };
    }

    await settings.save();
    
    res.status(200).json({
      success: true,
      message: 'GCC discount token generated successfully',
      data: {
        token: newToken,
        percentOff,
        generatedAt: new Date()
      }
    });
  } catch (error) {
    console.error('Error generating GCC discount token:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to generate GCC discount token',
      error: error.message
    });
  }
};


export const setAdminFeePercentage = async (req, res) => {
  try {
    const { feePercent } = req.body;

    if (typeof feePercent !== 'number' || feePercent < 0 || feePercent > 100) {
      return res.status(400).json({
        success: false,
        message: 'Fee percentage must be a number between 0 and 100'
      });
    }

    // Find existing settings or create new one
    let settings = await AdminSubscriptionSettings.findOne();
    
    if (!settings) {
      // Create default settings if none exist
      settings = new AdminSubscriptionSettings({
        subscriptionPricing: {
          consultant: { monthly: 29.99, annual: 299.99 },
          client: { monthly: 19.99, annual: 199.99 }
        },
        gccDiscount: {
          token: uuidv4(),
          percentOff: 10
        },
        adminFeePercent: feePercent,
        tips: 'Default subscription tips',
        earlyAccessDurationHours: 24
      });
    } else {
      settings.adminFeePercent = feePercent;
    }

    await settings.save();
    
    res.status(200).json({
      success: true,
      message: 'Admin fee percentage updated successfully',
      data: {
        adminFeePercent: feePercent,
        updatedAt: new Date()
      }
    });
  } catch (error) {
    console.error('Error setting admin fee percentage:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to set admin fee percentage',
      error: error.message
    });
  }
};


export const setSubscriptionTips = async (req, res) => {
  try {
    const { tips } = req.body;

    if (typeof tips !== 'string' || tips.trim().length === 0) {
      return res.status(400).json({
        success: false,
        message: 'Tips must be a non-empty string'
      });
    }

    // Find existing settings or create new one
    let settings = await AdminSubscriptionSettings.findOne();
    
    if (!settings) {
      // Create default settings if none exist
      settings = new AdminSubscriptionSettings({
        subscriptionPricing: {
          consultant: { monthly: 29.99, annual: 299.99 },
          client: { monthly: 19.99, annual: 199.99 }
        },
        gccDiscount: {
          token: uuidv4(),
          percentOff: 10
        },
        adminFeePercent: 5,
        tips: tips.trim(),
        earlyAccessDurationHours: 24
      });
    } else {
      settings.tips = tips.trim();
    }

    await settings.save();
    
    res.status(200).json({
      success: true,
      message: 'Subscription tips updated successfully',
      data: {
        tips: settings.tips,
        updatedAt: new Date()
      }
    });
  } catch (error) {
    console.error('Error setting subscription tips:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to set subscription tips',
      error: error.message
    });
  }
};


export const setEarlyAccessDuration = async (req, res) => {
  try {
    const { hours } = req.body;

    if (![24, 48].includes(hours)) {
      return res.status(400).json({
        success: false,
        message: 'Early access duration must be either 24 or 48 hours'
      });
    }

    // Find existing settings or create new one
    let settings = await AdminSubscriptionSettings.findOne();
    
    if (!settings) {
      // Create default settings if none exist
      settings = new AdminSubscriptionSettings({
        subscriptionPricing: {
          consultant: { monthly: 29.99, annual: 299.99 },
          client: { monthly: 19.99, annual: 199.99 }
        },
        gccDiscount: {
          token: uuidv4(),
          percentOff: 10
        },
        adminFeePercent: 5,
        tips: 'Default subscription tips',
        earlyAccessDurationHours: hours
      });
    } else {
      settings.earlyAccessDurationHours = hours;
    }

    await settings.save();
    
    res.status(200).json({
      success: true,
      message: 'Early access duration updated successfully',
      data: {
        earlyAccessDurationHours: hours,
        updatedAt: new Date()
      }
    });
  } catch (error) {
    console.error('Error setting early access duration:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to set early access duration',
      error: error.message
    });
  }
};


export const fetchSubscriptionSettings = async (req, res) => {
  try {
    let settings = await AdminSubscriptionSettings.findOne();
    
    if (!settings) {
      // Return default settings structure if none exist
      return res.status(200).json({
        success: true,
        message: 'No subscription settings found. Default values will be used.',
        data: {
          subscriptionPricing: {
            consultant: { monthly: 29.99, annual: 299.99 },
            client: { monthly: 19.99, annual: 199.99 }
          },
          gccDiscount: {
            token: null,
            percentOff: 10
          },
          adminFeePercent: 5,
          tips: 'Default subscription tips',
          earlyAccessDurationHours: 24,
          createdAt: null,
          updatedAt: null
        }
      });
    }

    res.status(200).json({
      success: true,
      message: 'Subscription settings retrieved successfully',
      data: {
        subscriptionPricing: settings.subscriptionPricing,
        gccDiscount: settings.gccDiscount,
        adminFeePercent: settings.adminFeePercent,
        tips: settings.tips,
        earlyAccessDurationHours: settings.earlyAccessDurationHours,
        createdAt: settings.createdAt,
        updatedAt: settings.updatedAt
      }
    });
  } catch (error) {
    console.error('Error fetching subscription settings:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch subscription settings',
      error: error.message
    });
  }
};


export const fetchAllSubscriptions = async (req, res) => {
  try {
    const {
      page = 1,
      limit = 10,
      status,
      userType,
      sortBy = 'createdAt',
      sortOrder = 'desc'
    } = req.query;

    // Build query filter
    const filter = {};
    if (status) filter.status = status;
    if (userType) filter.userType = userType;

    // Build sort object
    const sort = {};
    sort[sortBy] = sortOrder === 'asc' ? 1 : -1;

    // Calculate pagination
    const skip = (parseInt(page) - 1) * parseInt(limit);

    // Execute query with population of user details
    const [subscriptions, totalCount] = await Promise.all([
      Subscription.find(filter)
        .populate({
          path: 'userId',
          select: 'name email firstName lastName fullName',
          options: { strictPopulate: false }
        })
        .sort(sort)
        .skip(skip)
        .limit(parseInt(limit))
        .lean(),
      Subscription.countDocuments(filter)
    ]);

    // Calculate pagination info
    const totalPages = Math.ceil(totalCount / parseInt(limit));
    const hasNextPage = parseInt(page) < totalPages;
    const hasPrevPage = parseInt(page) > 1;

    // Format response data
    const formattedSubscriptions = subscriptions.map(subscription => ({
      _id: subscription._id,
      user: {
        id: subscription.userId?._id,
        name: subscription.userId?.name || 
              subscription.userId?.fullName || 
              `${subscription.userId?.firstName || ''} ${subscription.userId?.lastName || ''}`.trim() || 
              'N/A',
        email: subscription.userId?.email || 'N/A'
      },
      userType: subscription.userType,
      token: subscription.token,
      billingInterval: subscription.billingInterval,
      planName: subscription.planName,
      subscriptionAmount: subscription.subscriptionAmount,
      currency: subscription.currency,
      subscriptionPeriod: subscription.subscriptionPeriod,
      subscriptionPaymentIntent: subscription.subscriptionPaymentIntent,
      status: subscription.status,
      autoRenew: subscription.autoRenew,
      cancelledAt: subscription.cancelledAt,
      cancelReason: subscription.cancelReason,
      createdAt: subscription.createdAt,
      updatedAt: subscription.updatedAt
    }));

    res.status(200).json({
      success: true,
      message: 'Subscriptions retrieved successfully',
      data: {
        subscriptions: formattedSubscriptions,
        pagination: {
          currentPage: parseInt(page),
          totalPages,
          totalCount,
          limit: parseInt(limit),
          hasNextPage,
          hasPrevPage
        },
        summary: {
          totalSubscriptions: totalCount,
          activeSubscriptions: subscriptions.filter(sub => sub.status === 'active').length,
          cancelledSubscriptions: subscriptions.filter(sub => sub.status === 'cancelled').length,
          expiredSubscriptions: subscriptions.filter(sub => sub.status === 'expired').length,
          pendingSubscriptions: subscriptions.filter(sub => sub.status === 'pending').length
        }
      }
    });
  } catch (error) {
    console.error('Error fetching subscriptions:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch subscriptions',
      error: error.message
    });
  }
};

export const getSubscriptionStatistics = async (req, res) => {
  try {
    const [
      totalSubscriptions,
      activeSubscriptions,
      cancelledSubscriptions,
      expiredSubscriptions,
      pendingSubscriptions,
      monthlyRevenue,
      annualRevenue,
      consultantSubscriptions,
      clientSubscriptions
    ] = await Promise.all([
      Subscription.countDocuments(),
      Subscription.countDocuments({ status: 'active' }),
      Subscription.countDocuments({ status: 'cancelled' }),
      Subscription.countDocuments({ status: 'expired' }),
      Subscription.countDocuments({ status: 'pending' }),
      Subscription.aggregate([
        { $match: { status: 'active', billingInterval: 'monthly' } },
        { $group: { _id: null, total: { $sum: '$subscriptionAmount' } } }
      ]),
      Subscription.aggregate([
        { $match: { status: 'active', billingInterval: 'annual' } },
        { $group: { _id: null, total: { $sum: '$subscriptionAmount' } } }
      ]),
      Subscription.countDocuments({ userType: 'contractor' }),
      Subscription.countDocuments({ userType: 'client' })
    ]);

    res.status(200).json({
      success: true,
      message: 'Subscription statistics retrieved successfully',
      data: {
        totalSubscriptions,
        subscriptionsByStatus: {
          active: activeSubscriptions,
          cancelled: cancelledSubscriptions,
          expired: expiredSubscriptions,
          pending: pendingSubscriptions
        },
        subscriptionsByUserType: {
          consultant: consultantSubscriptions,
          client: clientSubscriptions
        }
      }
    });
  } catch (error) {
    console.error('Error getting subscription statistics:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to get subscription statistics',
      error: error.message
    });
  }
};