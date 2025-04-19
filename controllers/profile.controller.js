// profile.controller.js
import Profile from '../models/profile.model.js';

/**
 * Create a new profile
 * @route POST /api/profile/create
 * @access Public
 */
export const createProfile = async (req, res) => {
  try {
    const userId = req.body.userId; // Get userId from request body
    
    // Check if profile already exists
    const existingProfile = await Profile.findOne({ user: userId });
    if (existingProfile) {
      return res.status(400).json({
        success: false,
        message: 'Profile already exists for this user. Use update instead.'
      });
    }
    
    // Parse arrays if they come as strings
    const skills = req.body.skills && typeof req.body.skills === 'string' 
      ? JSON.parse(req.body.skills) 
      : req.body.skills || [];
      
    const expertise = req.body.expertise && typeof req.body.expertise === 'string' 
      ? JSON.parse(req.body.expertise) 
      : req.body.expertise || [];
      
    const certifications = req.body.certifications && typeof req.body.certifications === 'string' 
      ? JSON.parse(req.body.certifications) 
      : req.body.certifications || [];
      
    const workHistory = req.body.workHistory && typeof req.body.workHistory === 'string' 
      ? JSON.parse(req.body.workHistory) 
      : req.body.workHistory || [];
      
    const degrees = req.body.degrees && typeof req.body.degrees === 'string' 
      ? JSON.parse(req.body.degrees) 
      : req.body.degrees || [];
    
    // Handle profile image separately (simple base64 or URL string)
    const profileImage = req.body.profileImage || '';
    
    // Create profile data
    const profileData = {
      user: userId,
      firstName: req.body.firstName,
      lastName: req.body.lastName,
      bio: req.body.bio,
      profileImage,
      ratePerHour: req.body.ratePerHour,
      primaryPosition: req.body.primaryPosition,
      skills,
      expertise,
      certifications,
      workHistory,
      degrees
    };
    
    // Create new profile
    const profile = await Profile.create(profileData);
    
    res.status(201).json({
      success: true,
      data: profile,
      message: 'Profile created successfully'
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
};

/**
 * Update existing profile
 * @route PUT /api/profile/update/:id
 * @access Public
 */
export const updateProfile = async (req, res) => {
  try {
    const profileId = req.params.id;
    
    // Check if profile exists
    let profile = await Profile.findById(profileId);
    if (!profile) {
      return res.status(404).json({
        success: false,
        message: 'Profile not found'
      });
    }
    
    // Parse arrays if they come as strings
    const skills = req.body.skills && typeof req.body.skills === 'string' 
      ? JSON.parse(req.body.skills) 
      : req.body.skills || profile.skills;
      
    const expertise = req.body.expertise && typeof req.body.expertise === 'string' 
      ? JSON.parse(req.body.expertise) 
      : req.body.expertise || profile.expertise;
      
    const certifications = req.body.certifications && typeof req.body.certifications === 'string' 
      ? JSON.parse(req.body.certifications) 
      : req.body.certifications || profile.certifications;
      
    const workHistory = req.body.workHistory && typeof req.body.workHistory === 'string' 
      ? JSON.parse(req.body.workHistory) 
      : req.body.workHistory || profile.workHistory;
      
    const degrees = req.body.degrees && typeof req.body.degrees === 'string' 
      ? JSON.parse(req.body.degrees) 
      : req.body.degrees || profile.degrees;
    
    // Prepare update data
    const updateData = {
      firstName: req.body.firstName || profile.firstName,
      lastName: req.body.lastName || profile.lastName,
      bio: req.body.bio || profile.bio,
      ratePerHour: req.body.ratePerHour || profile.ratePerHour,
      primaryPosition: req.body.primaryPosition || profile.primaryPosition,
      skills,
      expertise,
      certifications,
      workHistory,
      degrees,
      updatedAt: Date.now()
    };
    
    // Update profile image if provided
    if (req.body.profileImage) {
      updateData.profileImage = req.body.profileImage;
    }
    
    // Update profile
    profile = await Profile.findByIdAndUpdate(
      profileId, 
      { $set: updateData },
      { new: true, runValidators: true }
    );
    
    res.status(200).json({
      success: true,
      data: profile,
      message: 'Profile updated successfully'
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
};

/**
 * Get current user's profile
 * @route GET /api/profile/me
 * @access Public
 */
export const getMyProfile = async (req, res) => {
  try {
    // Get userId from query parameter
    const userId = req.query.userId;
    
    if (!userId) {
      return res.status(400).json({
        success: false,
        message: 'User ID is required'
      });
    }
    
    const profile = await Profile.findOne({ user: userId });
    
    if (!profile) {
      return res.status(404).json({
        success: false,
        message: 'Profile not found'
      });
    }
    
    res.status(200).json({
      success: true,
      data: profile
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
};

/**
 * Get profile by user ID
 * @route GET /api/profile/:userId
 * @access Public
 */
export const getProfileByUserId = async (req, res) => {
  try {
    const profile = await Profile.findOne({ user: req.params.userId });
    
    if (!profile) {
      return res.status(404).json({
        success: false,
        message: 'Profile not found'
      });
    }
    
    res.status(200).json({
      success: true,
      data: profile
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
};

/**
 * Delete profile
 * @route DELETE /api/profile/delete/:id
 * @access Public
 */
export const deleteProfile = async (req, res) => {
  try {
    const profileId = req.params.id;
    
    const profile = await Profile.findById(profileId);
    if (!profile) {
      return res.status(404).json({
        success: false,
        message: 'Profile not found'
      });
    }
    
    await Profile.findByIdAndDelete(profileId);
    
    res.status(200).json({
      success: true,
      message: 'Profile deleted successfully'
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
};

/**
 * Search profiles by skills, expertise, or certifications
 * @route GET /api/profile/search
 * @access Public
 */
export const searchProfiles = async (req, res) => {
  try {
    const { skills, expertise, certifications, query, limit = 20, skip = 0 } = req.query;
    
    const searchCriteria = {};
    
    // Add search criteria based on query parameters
    if (skills) {
      searchCriteria.skills = { $in: skills.split(',') };
    }
    
    if (expertise) {
      searchCriteria.expertise = { $in: expertise.split(',') };
    }
    
    if (certifications) {
      searchCriteria.certifications = { $in: certifications.split(',') };
    }
    
    // Text search across multiple fields
    if (query) {
      searchCriteria.$or = [
        { firstName: { $regex: query, $options: 'i' } },
        { lastName: { $regex: query, $options: 'i' } },
        { primaryPosition: { $regex: query, $options: 'i' } },
        { bio: { $regex: query, $options: 'i' } }
      ];
    }
    
    // Find profiles matching criteria
    const profiles = await Profile.find(searchCriteria)
      .sort({ createdAt: -1 })
      .limit(parseInt(limit))
      .skip(parseInt(skip));
    
    // Count total matching profiles for pagination
    const total = await Profile.countDocuments(searchCriteria);
    
    res.status(200).json({
      success: true,
      count: profiles.length,
      total,
      data: profiles
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
};

/**
 * Get all available skills
 * @route GET /api/profile/skills
 * @access Public
 */
export const getAllSkills = async (req, res) => {
  try {
    const skills = await Profile.distinct('skills');
    
    res.status(200).json({
      success: true,
      count: skills.length,
      data: skills
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
};

/**
 * Get all available expertise areas
 * @route GET /api/profile/expertise
 * @access Public
 */
export const getAllExpertise = async (req, res) => {
  try {
    const expertise = await Profile.distinct('expertise');
    
    res.status(200).json({
      success: true,
      count: expertise.length,
      data: expertise
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
};

/**
 * Get all available certifications
 * @route GET /api/profile/certifications
 * @access Public
 */
export const getAllCertifications = async (req, res) => {
  try {
    const certifications = await Profile.distinct('certifications');
    
    res.status(200).json({
      success: true,
      count: certifications.length,
      data: certifications
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
};