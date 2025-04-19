// profile.controller.js
import mongoose from 'mongoose';
import Profile from '../models/profile.model.js';

/**
 * Validate ObjectId
 * @param {string} id - ID to validate
 * @returns {boolean} - Is valid ObjectId
 */
const isValidObjectId = (id) => {
  return mongoose.Types.ObjectId.isValid(id);
};

/**
 * Create a new profile
 * @route POST /api/profile/create
 * @access Public
 */
export const createProfile = async (req, res) => {
  try {
    console.log("create profile hit!")
    const userId = req.body.userId;

    // Validate userId
    if (!userId || !isValidObjectId(userId)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid user ID'
      });
    }
    
    // Check if profile already exists
    const existingProfile = await Profile.findOne({ user: userId });
    if (existingProfile) {
      return res.status(400).json({
        success: false,
        message: 'Profile already exists for this user. Use update instead.'
      });
    }
    
    // Parse arrays if they come as strings
    const skills = parseArrayField(req.body.skills);
    const expertise = parseArrayField(req.body.expertise);
    const certifications = parseArrayField(req.body.certifications);
    const workHistory = parseArrayField(req.body.workHistory);
    const degrees = parseArrayField(req.body.degrees);
    
    // Handle profile image (simple string)
    const profileImage = req.body.profileImage || '';
    
    // Create profile data
    const profileData = {
      user: userId,
      bio: req.body.bio || '',
      profileImage,
      ratePerHour: req.body.ratePerHour || 0,
      primaryPosition: req.body.primaryPosition || '',
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
    console.error('Create profile error:', error);
    res.status(500).json({
      success: false,
      message: error.message || 'Internal server error'
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
    const userId = req.params.id;
    
    // Validate profileId
    if (!userId || !isValidObjectId(userId)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid user ID'
      });
    }
    
    // Check if profile exists
    let profile = await Profile.findOne({user: userId});
    if (!profile) {
      return res.status(404).json({
        success: false,
        message: 'Profile not found'
      });
    }
    
    // Parse arrays if they come as strings
    const skills = parseArrayField(req.body.skills) ?? profile.skills;
    const expertise = parseArrayField(req.body.expertise) ?? profile.expertise;
    const certifications = parseArrayField(req.body.certifications) ?? profile.certifications;
    const workHistory = parseArrayField(req.body.workHistory) ?? profile.workHistory;
    const degrees = parseArrayField(req.body.degrees) ?? profile.degrees;
    
    // Prepare update data
    const updateData = {
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
    profile = await Profile.findOneAndUpdate(
    { user: userId }, 
      { $set: updateData },
      { new: true, runValidators: true }
    );
    
    res.status(200).json({
      success: true,
      data: profile,
      message: 'Profile updated successfully'
    });
  } catch (error) {
    console.error('Update profile error:', error);
    res.status(500).json({
      success: false,
      message: error.message || 'Internal server error'
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
    const userId = req.params.userId;
    
    // Validate userId
    if (!userId || !isValidObjectId(userId)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid user ID'
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
    console.error('Get profile error:', error);
    res.status(500).json({
      success: false,
      message: error.message || 'Internal server error'
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
    
    const userId = req.params.id;
    
    // Validate profileId
    if (!userId || !isValidObjectId(userId)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid user ID'
      });
    }
    
    const profile = await Profile.findOne({user: userId});
    if (!profile) {
      return res.status(404).json({
        success: false,
        message: 'Profile not found'
      });
    }
    
    await Profile.findOneAndDelete({user: userId});
    
    res.status(200).json({
      success: true,
      message: 'Profile deleted successfully'
    });
  } catch (error) {
    console.error('Delete profile error:', error);
    res.status(500).json({
      success: false,
      message: error.message || 'Internal server error'
    });
  }
};

/**
 * Helper function to parse array fields that may come as strings
 * @param {string|array} field - Field to parse
 * @returns {array} - Parsed array or empty array
 */
const parseArrayField = (field) => {
  if (!field) return [];
  
  if (typeof field === 'string') {
    try {
      return JSON.parse(field);
    } catch (e) {
      console.error('Error parsing field:', e);
      return [];
    }
  }
  
  return field;
};

/**
 * Get current user's profile (included for compatibility with frontend)
 * Note: This is essentially the same as getProfileByUserId but uses query parameter
 * @route GET /api/profile/me
 * @access Public
 */
export const getMyProfile = async (req, res) => {
  try {
    // Get userId from query parameter
    const userId = req.query.userId;
    
    if (!userId || !isValidObjectId(userId)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid user ID'
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
    console.error('Get profile error:', error);
    res.status(500).json({
      success: false,
      message: error.message || 'Internal server error'
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
    console.error('Search profiles error:', error);
    res.status(500).json({
      success: false,
      message: error.message || 'Internal server error'
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
    console.error('Get skills error:', error);
    res.status(500).json({
      success: false,
      message: error.message || 'Internal server error'
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
    console.error('Get expertise error:', error);
    res.status(500).json({
      success: false,
      message: error.message || 'Internal server error'
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
    console.error('Get certifications error:', error);
    res.status(500).json({
      success: false,
      message: error.message || 'Internal server error'
    });
  }
};