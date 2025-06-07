import Job from '../../models/job.created.model.js';
import JobApplication from '../../models/job.applications.model.js';
import User from '../../models/user.model.js';

export const validateAdmin = async (req, res, next) => {
    try {
      const { adminId } = req.method === 'GET' ? req.query || req.body : req.body;
  
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


// =======================
// JOB MANAGEMENT CONTROLLERS
// =======================

export const getAllJobs = async (req, res) => {
  try {
    const { 
      page = 1, 
      limit = 10, 
      status, 
      paymentType, 
      employmentType,
      jobCategory,
      search,
      sortBy = 'createdAt',
      sortOrder = 'desc'
    } = req.query;
    
    const skip = (page - 1) * limit;

    // Build query object
    let query = {};
    
    // Filter by status if provided
    if (status && ['open', 'active', 'closed', 'completed'].includes(status)) {
      query.status = status;
    }

    // Filter by payment type
    if (paymentType && ['hourly', 'fixed-price', 'retainer'].includes(paymentType)) {
      query.paymentType = paymentType;
    }

    // Filter by employment type
    if (employmentType && ['Full-time', 'Part-time'].includes(employmentType)) {
      query.employmentType = employmentType;
    }

    // Filter by job category
    if (jobCategory) {
      query.jobCategory = { $regex: jobCategory, $options: 'i' };
    }

    // Search functionality (title, description, or location)
    if (search) {
      query.$or = [
        { jobTitle: { $regex: search, $options: 'i' } },
        { description: { $regex: search, $options: 'i' } },
        { location: { $regex: search, $options: 'i' } },
        { clientName: { $regex: search, $options: 'i' } }
      ];
    }

    // Sort configuration
    const sortConfig = {};
    sortConfig[sortBy] = sortOrder === 'asc' ? 1 : -1;

    // Get jobs with pagination and populate user data
    const jobs = await Job.find(query)
      .populate('userId', 'name email role')
      .sort(sortConfig)
      .skip(skip)
      .limit(parseInt(limit));

    // Get total count for pagination
    const totalJobs = await Job.countDocuments(query);
    const totalPages = Math.ceil(totalJobs / limit);

    res.status(200).json({
      success: true,
      message: 'Jobs retrieved successfully',
      data: {
        jobs,
        pagination: {
          currentPage: parseInt(page),
          totalPages,
          totalJobs,
          hasNextPage: page < totalPages,
          hasPrevPage: page > 1
        }
      }
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Error retrieving jobs',
      error: error.message
    });
  }
};

export const getJobStats = async (req, res) => {
  try {
    // Basic job counts
    const totalJobs = await Job.countDocuments();
    const openJobs = await Job.countDocuments({ status: 'open' });
    const activeJobs = await Job.countDocuments({ status: 'active' });
    const closedJobs = await Job.countDocuments({ status: 'closed' });
    const completedJobs = await Job.countDocuments({ status: 'completed' });

    // Payment type distribution
    const hourlyJobs = await Job.countDocuments({ paymentType: 'hourly' });
    const fixedPriceJobs = await Job.countDocuments({ paymentType: 'fixed-price' });
    const retainerJobs = await Job.countDocuments({ paymentType: 'retainer' });

    // Employment type distribution
    const fullTimeJobs = await Job.countDocuments({ employmentType: 'Full-time' });
    const partTimeJobs = await Job.countDocuments({ employmentType: 'Part-time' });

    // Recent jobs (last 30 days)
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
    const recentJobs = await Job.countDocuments({ 
      createdAt: { $gte: thirtyDaysAgo } 
    });

    // Average job price (excluding retainer jobs for fixed-price and hourly)
    const avgPriceResult = await Job.aggregate([
      { $match: { price: { $exists: true, $gt: 0 } } },
      { 
        $group: { 
          _id: null, 
          avgPrice: { $avg: '$price' },
          minPrice: { $min: '$price' },
          maxPrice: { $max: '$price' }
        } 
      }
    ]);

    // Top job categories
    const topCategories = await Job.aggregate([
      { $group: { _id: '$jobCategory', count: { $sum: 1 } } },
      { $sort: { count: -1 } },
      { $limit: 10 }
    ]);

    // Jobs requiring special clearances/certifications
    const jobsWithCertifications = await Job.countDocuments({
      requiredCertifications: { $exists: true, $ne: [] }
    });
    const lobbyistJobs = await Job.countDocuments({ requiresRegisteredLobbyist: true });

    res.status(200).json({
      success: true,
      message: 'Job stats retrieved successfully',
      data: {
        totalJobs,
        jobsByStatus: {
          open: openJobs,
          active: activeJobs,
          closed: closedJobs,
          completed: completedJobs
        },
        jobsByPaymentType: {
          hourly: hourlyJobs,
          fixedPrice: fixedPriceJobs,
          retainer: retainerJobs
        },
        jobsByEmploymentType: {
          fullTime: fullTimeJobs,
          partTime: partTimeJobs
        },
        pricing: avgPriceResult.length > 0 ? {
          average: Math.round(avgPriceResult[0].avgPrice),
          minimum: avgPriceResult[0].minPrice,
          maximum: avgPriceResult[0].maxPrice
        } : null,
        specialRequirements: {
          withCertifications: jobsWithCertifications,
          requiresLobbyist: lobbyistJobs
        },
        topCategories: topCategories.map(cat => ({
          category: cat._id,
          count: cat.count
        })),
        recentJobs
      }
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Error retrieving job stats',
      error: error.message
    });
  }
};

// =======================
// JOB APPLICATION MANAGEMENT CONTROLLERS
// =======================

export const getAllJobApplications = async (req, res) => {
  try {
    const { 
      page = 1, 
      limit = 10, 
      status, 
      jobId,
      freelancerId,
      search,
      sortBy = 'createdAt',
      sortOrder = 'desc'
    } = req.query;
    
    const skip = (page - 1) * limit;

    // Build query object
    let query = {};
    
    // Filter by status if provided
    if (status && ['draft', 'pending', 'viewed', 'active'].includes(status)) {
      query.status = status;
    }

    // Filter by specific job
    if (jobId) {
      query.jobId = jobId;
    }

    // Filter by specific freelancer
    if (freelancerId) {
      query.freelancerId = freelancerId;
    }

    // Sort configuration
    const sortConfig = {};
    sortConfig[sortBy] = sortOrder === 'asc' ? 1 : -1;

    // Get applications with pagination and populate related data
    const applications = await JobApplication.find(query)
      .populate('jobId', 'jobTitle clientName status paymentType price location')
      .populate('freelancerId', 'name email')
      .populate('freelancerProfileId', 'skills hourlyRate')
      .sort(sortConfig)
      .skip(skip)
      .limit(parseInt(limit));

    // If search is provided, filter populated results
    let filteredApplications = applications;
    if (search) {
      filteredApplications = applications.filter(app => 
        app.jobId?.jobTitle?.toLowerCase().includes(search.toLowerCase()) ||
        app.freelancerId?.name?.toLowerCase().includes(search.toLowerCase()) ||
        app.freelancerId?.email?.toLowerCase().includes(search.toLowerCase()) ||
        app.coverLetter?.toLowerCase().includes(search.toLowerCase())
      );
    }

    // Get total count for pagination
    const totalApplications = await JobApplication.countDocuments(query);
    const totalPages = Math.ceil(totalApplications / limit);

    res.status(200).json({
      success: true,
      message: 'Job applications retrieved successfully',
      data: {
        applications: filteredApplications,
        pagination: {
          currentPage: parseInt(page),
          totalPages,
          totalApplications,
          hasNextPage: page < totalPages,
          hasPrevPage: page > 1
        }
      }
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Error retrieving job applications',
      error: error.message
    });
  }
};

export const getJobApplicationStats = async (req, res) => {
  try {
    // Basic application counts
    const totalApplications = await JobApplication.countDocuments();
    const draftApplications = await JobApplication.countDocuments({ status: 'draft' });
    const pendingApplications = await JobApplication.countDocuments({ status: 'pending' });
    const viewedApplications = await JobApplication.countDocuments({ status: 'viewed' });
    const activeApplications = await JobApplication.countDocuments({ status: 'active' });

    // Recent applications (last 30 days)
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
    const recentApplications = await JobApplication.countDocuments({ 
      createdAt: { $gte: thirtyDaysAgo } 
    });

    // Applications with attachments
    const applicationsWithAttachments = await JobApplication.countDocuments({
      'attachments.0': { $exists: true }
    });

    // Applications with proposed milestones
    const applicationsWithMilestones = await JobApplication.countDocuments({
      'proposedMilestones.0': { $exists: true }
    });

    // Applications with interviews scheduled
    const applicationsWithInterviews = await JobApplication.countDocuments({
      'interviews.0': { $exists: true }
    });

    // Average proposed rates
    const avgRateResult = await JobApplication.aggregate([
      { $match: { proposedRate: { $exists: true, $gt: 0 } } },
      { 
        $group: { 
          _id: null, 
          avgRate: { $avg: '$proposedRate' },
          minRate: { $min: '$proposedRate' },
          maxRate: { $max: '$proposedRate' }
        } 
      }
    ]);

    // Top skills mentioned in applications
    const topSkills = await JobApplication.aggregate([
      { $unwind: '$relevantSkills' },
      { $group: { _id: '$relevantSkills', count: { $sum: 1 } } },
      { $sort: { count: -1 } },
      { $limit: 10 }
    ]);

    // Applications by availability
    const availabilityStats = await JobApplication.aggregate([
      { $group: { _id: '$availability', count: { $sum: 1 } } },
      { $sort: { count: -1 } }
    ]);

    // Conversion rate (viewed to active)
    const conversionRate = viewedApplications > 0 ? 
      ((activeApplications / viewedApplications) * 100).toFixed(2) : 0;

    res.status(200).json({
      success: true,
      message: 'Job application stats retrieved successfully',
      data: {
        totalApplications,
        applicationsByStatus: {
          draft: draftApplications,
          pending: pendingApplications,
          viewed: viewedApplications,
          active: activeApplications
        },
        engagement: {
          withAttachments: applicationsWithAttachments,
          withMilestones: applicationsWithMilestones,
          withInterviews: applicationsWithInterviews,
          conversionRate: `${conversionRate}%`
        },
        pricing: avgRateResult.length > 0 ? {
          averageRate: Math.round(avgRateResult[0].avgRate),
          minimumRate: avgRateResult[0].minRate,
          maximumRate: avgRateResult[0].maxRate
        } : null,
        topSkills: topSkills.map(skill => ({
          skill: skill._id,
          count: skill.count
        })),
        availability: availabilityStats.map(avail => ({
          type: avail._id,
          count: avail.count
        })),
        recentApplications
      }
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Error retrieving job application stats',
      error: error.message
    });
  }
};

// =======================
// ADDITIONAL UTILITY CONTROLLERS
// =======================

export const getJobWithApplications = async (req, res) => {
  try {
    const jobId  = req.params.id;
    const { page = 1, limit = 10, applicationStatus } = req.query;
    const skip = (page - 1) * limit;

    // Get the job details
    const job = await Job.findById(jobId).populate('userId', 'name email');
    
    if (!job) {
      return res.status(404).json({
        success: false,
        message: 'Job not found'
      });
    }

    // Build query for applications
    let applicationQuery = { jobId };
    if (applicationStatus && ['draft', 'pending', 'viewed', 'active'].includes(applicationStatus)) {
      applicationQuery.status = applicationStatus;
    }

    // Get applications for this job
    const applications = await JobApplication.find(applicationQuery)
      .populate('freelancerId', 'name email')
      .populate('freelancerProfileId', 'skills hourlyRate')
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(parseInt(limit));

    const totalApplications = await JobApplication.countDocuments(applicationQuery);
    const totalPages = Math.ceil(totalApplications / limit);

    res.status(200).json({
      success: true,
      message: 'Job with applications retrieved successfully',
      data: {
        job,
        applications,
        pagination: {
          currentPage: parseInt(page),
          totalPages,
          totalApplications,
          hasNextPage: page < totalPages,
          hasPrevPage: page > 1
        }
      }
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Error retrieving job with applications',
      error: error.message
    });
  }
};

export const getApplicationsByFreelancer = async (req, res) => {
  try {
    const { freelancerId } = req.params;
    const { page = 1, limit = 10, status } = req.query;
    const skip = (page - 1) * limit;

    // Build query
    let query = { freelancerId };
    if (status && ['draft', 'pending', 'viewed', 'active'].includes(status)) {
      query.status = status;
    }

    // Get applications by freelancer
    const applications = await JobApplication.find(query)
      .populate('jobId', 'jobTitle clientName status paymentType price location')
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(parseInt(limit));

    const totalApplications = await JobApplication.countDocuments(query);
    const totalPages = Math.ceil(totalApplications / limit);

    // Get freelancer info
    const freelancer = await User.findById(freelancerId).select('name email role');

    res.status(200).json({
      success: true,
      message: 'Freelancer applications retrieved successfully',
      data: {
        freelancer,
        applications,
        pagination: {
          currentPage: parseInt(page),
          totalPages,
          totalApplications,
          hasNextPage: page < totalPages,
          hasPrevPage: page > 1
        }
      }
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Error retrieving freelancer applications',
      error: error.message
    });
  }
};