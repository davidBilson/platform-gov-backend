import mongoose from 'mongoose';
import ContractorProfile from '../models/profile.contractor.model.js';
import { deleteImage, getPublicIdFromUrl } from '../utils/cloudinary.js';

/**
 * Validate ObjectId
 * @param {string} id - ID to validate
 * @returns {boolean} - Is valid ObjectId
 */
const isValidObjectId = (id) => {
  return mongoose.Types.ObjectId.isValid(id);
};

/**
 * Convert ID to ObjectId if valid
 * @param {string} id - ID to convert
 * @returns {ObjectId|null} - Mongoose ObjectId or null if invalid
 */
const toObjectId = (id) => {
  if (!id || !isValidObjectId(id)) return null;
  return new mongoose.Types.ObjectId(id.toString());
};

/**
 * Parse array field from request
 * @param {string|Array} field - Field to parse
 * @returns {Array} - Parsed array
 */
const parseArrayField = (field) => {
  if (!field) return [];
  if (Array.isArray(field)) return field;
  try {
    return JSON.parse(field);
  } catch (e) {
    return [field]; // Return as single item array if not JSON parseable
  }
};

/**
 * Get profile by user ID
 * @route GET /api/profile/:userId
 * @access Public
 */
export const getContractorProfile = async (req, res) => {
  try {
    const userId = req.params.id;
    
    // First check if the ID is valid
    if (!userId || !isValidObjectId(userId)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid user ID'
      });
    }
    
    // Try string match first (in case the model expects string IDs)
    let profile = await ContractorProfile.findOne({ user: userId });
    
    // If not found, try with ObjectId
    if (!profile) {
      const objectId = new mongoose.Types.ObjectId(userId.toString());
      profile = await ContractorProfile.findOne({ user: objectId });
    }
    
    if (!profile) {
      return res.status(404).json({
        success: false,
        message: 'Contractor profile not found'
      });
    }
    
    res.status(200).json({
      success: true,
      data: profile
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message || 'Internal server error'
    });
  }
};

/**
 * Create a new profile
 * @route POST /api/profile
 * @access Private
 */
export const createContractorProfile = async (req, res) => {
  try {
    const userId = req.body.userId;

    // Validate userId
    if (!userId || !isValidObjectId(userId)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid user ID'
      });
    }
    
    // Convert to ObjectId
    const objectId = new mongoose.Types.ObjectId(userId.toString());
    
    // Check if profile already exists
    const existingProfile = await ContractorProfile.findOne({ user: objectId });
    if (existingProfile) {
      return res.status(400).json({
        success: false,
        message: 'Contractor profile already exists for this user.'
      });
    }
    
    // Parse arrays if they come as strings
    const skills = parseArrayField(req.body.skills);
    const expertise = parseArrayField(req.body.expertise);
    const certifications = parseArrayField(req.body.certifications);
    const workHistory = parseArrayField(req.body.workHistory);
    const degrees = parseArrayField(req.body.degrees);
    
    // Handle profile image
    const profileImage = req.body.profileImage || '';
    
    // Create profile data
    const profileData = {
      user: objectId,
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
    const profile = await ContractorProfile.create(profileData);
    
    res.status(201).json({
      success: true,
      data: profile,
      message: 'Contractor profile created successfully'
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message || 'Internal server error'
    });
  }
};

/**
 * Update a profile
 * @route PUT /api/profile/:id
 * @access Private
 */
export const updateContractorProfile = async (req, res) => {
  try {
    const userId = req.params.id;
    
    // Validate userId
    if (!userId || !isValidObjectId(userId)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid user ID'
      });
    }
    
    // Convert to ObjectId
    const objectId = new mongoose.Types.ObjectId(userId.toString());
    
    // Check if profile exists
    let profile = await ContractorProfile.findOne({ user: objectId });
    
    // If not found, try with string ID as fallback
    if (!profile) {
      profile = await ContractorProfile.findOne({ user: userId });
    }
    
    if (!profile) {
      return res.status(404).json({
        success: false,
        message: 'Contractor profile not found'
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
    
    // Handle profile image replacement
    if (req.body.profileImage && profile.profileImage && 
        req.body.profileImage !== profile.profileImage) {
      try {
        // Delete the old image from Cloudinary if it's a Cloudinary URL
        if (profile.profileImage.includes('cloudinary.com')) {
          const publicId = getPublicIdFromUrl(profile.profileImage);
          if (publicId) {
            await deleteImage(publicId).catch(err => {
              console.error('Error deleting old image from Cloudinary:', err);
              // Continue even if delete fails
            });
          }
        }
      } catch (deleteErr) {
        console.error('Error handling old profile image:', deleteErr);
        // Continue with update even if delete fails
      }
    }
    
    // Update profile image if provided
    if (req.body.profileImage) {
      updateData.profileImage = req.body.profileImage;
    }
    
    // Update profile
    profile = await ContractorProfile.findOneAndUpdate(
      { user: objectId }, 
      { $set: updateData },
      { new: true, runValidators: true }
    );
    
    res.status(200).json({
      success: true,
      data: profile,
      message: 'Contractor profile updated successfully'
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message || 'Internal server error'
    });
  }
};

/**
 * Delete a profile
 * @route DELETE /api/profile/:id
 * @access Private
 */
export const deleteContractorProfile = async (req, res) => {
  try {
    const userId = req.params.id;
    
    // Convert userId to ObjectId
    const userObjectId = toObjectId(userId);
    
    // Validate userId
    if (!userObjectId) {
      return res.status(400).json({
        success: false,
        message: 'Invalid user ID'
      });
    }
    
    const profile = await ContractorProfile.findOne({ user: userObjectId });
    if (!profile) {
      return res.status(404).json({
        success: false,
        message: 'Contractor profile not found'
      });
    }
    
    // If profile has an image on Cloudinary, delete it
    if (profile.profileImage && profile.profileImage.includes('cloudinary.com')) {
      try {
        const publicId = getPublicIdFromUrl(profile.profileImage);
        if (publicId) {
          await deleteImage(publicId).catch(err => {
            console.error('Error deleting profile image from Cloudinary:', err);
            // Continue even if delete fails
          });
        }
      } catch (error) {
        console.error('Error handling profile image deletion:', error);
        // Continue with deletion even if image delete fails
      }
    }
    
    await ContractorProfile.findOneAndDelete({ user: userObjectId });
    
    res.status(200).json({
      success: true,
      message: 'Contractor profile deleted successfully'
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message || 'Internal server error'
    });
  }
};

/**
 * Get current user's profile (included for compatibility with frontend)
 * Note: This is essentially the same as getContractorProfile but uses query parameter
 * @route GET /api/profile/me
 * @access Public
 */
export const getMyProfile = async (req, res) => {
  try {
    // Get userId from query parameter
    const userId = req.query.userId;
    
    // Convert userId to ObjectId
    const userObjectId = toObjectId(userId);
    
    if (!userObjectId) {
      return res.status(400).json({
        success: false,
        message: 'Invalid user ID'
      });
    }
    
    const profile = await ContractorProfile.findOne({ user: userObjectId });
    
    if (!profile) {
      return res.status(404).json({
        success: false,
        message: 'Contractor profile not found'
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
    const profiles = await ContractorProfile.find(searchCriteria)
      .sort({ createdAt: -1 })
      .limit(parseInt(limit))
      .skip(parseInt(skip));
    
    // Count total matching profiles for pagination
    const total = await ContractorProfile.countDocuments(searchCriteria);
    
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
    const skills = await ContractorProfile.distinct('skills');
    
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
    const expertise = await ContractorProfile.distinct('expertise');
    
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