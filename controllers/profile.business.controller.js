
import mongoose from 'mongoose';
import BusinessProfile from '../models/profile.business.model.js';
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
 * Get business profile by user ID
 * @route GET /api/profile/fetch-business-profile/:id
 * @access Public
 */
export const getBusinessProfile = async (req, res) => {
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
    let profile = await BusinessProfile.findOne({ user: userId });
    
    // If not found, try with ObjectId
    if (!profile) {
      const objectId = new mongoose.Types.ObjectId(userId.toString());
      profile = await BusinessProfile.findOne({ user: objectId });
    }
    
    if (!profile) {
      return res.status(404).json({
        success: false,
        message: 'Business profile not found'
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
 * Create a new business profile
 * @route POST /api/profile/create-business-profile
 * @access Private
 */
export const createBusinessProfile = async (req, res) => {
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
    const existingProfile = await BusinessProfile.findOne({ user: objectId });
    if (existingProfile) {
      return res.status(400).json({
        success: false,
        message: 'Business profile already exists for this user. Use update instead.'
      });
    }
    
    // Parse arrays if they come as strings
    const specializations = parseArrayField(req.body.specializations);
    let locations = parseArrayField(req.body.locations);
    
    // If locations is provided as individual fields rather than an array
    if (!req.body.locations && req.body.country) {
      locations = [{
        country: req.body.country || '',
        address1: req.body.address1 || '',
        address2: req.body.address2 || '',
        city: req.body.city || '',
        state: req.body.state || '',
        zipCode: req.body.zipCode || ''
      }];
    }
    
    // Handle logo image
    const logo = req.body.logo || '';
    
    // Create profile data
    const profileData = {
      user: objectId,
      name: req.body.name || '',
      overview: req.body.overview || '',
      logo,
      industry: req.body.industry || '',
      size: req.body.size || '',
      specializations,
      locations
    };
    
    // Create new profile
    const profile = await BusinessProfile.create(profileData);
    
    res.status(201).json({
      success: true,
      data: profile,
      message: 'Business profile created successfully'
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message || 'Internal server error'
    });
  }
};

/**
 * Update a business profile
 * @route PUT /api/profile/update-business-profile/:id
 * @access Private
 */
export const updateBusinessProfile = async (req, res) => {
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
    let profile = await BusinessProfile.findOne({ user: objectId });
    
    // If not found, try with string ID as fallback
    if (!profile) {
      profile = await BusinessProfile.findOne({ user: userId });
    }
    
    if (!profile) {
      return res.status(404).json({
        success: false,
        message: 'Business profile not found'
      });
    }
    
    // Parse arrays if they come as strings
    const specializations = req.body.specializations ? parseArrayField(req.body.specializations) : profile.specializations;
    
    // Handle locations array or individual location updates
    let locations = profile.locations;
    
    if (req.body.locations) {
      locations = parseArrayField(req.body.locations);
    } else if (req.body.country || req.body.address1 || req.body.city) {
      // If individual location fields are provided (for editing the first location)
      if (locations.length > 0) {
        // Update existing first location
        locations[0] = {
          ...locations[0],
          country: req.body.country || locations[0].country,
          address1: req.body.address1 || locations[0].address1,
          address2: req.body.address2 || locations[0].address2,
          city: req.body.city || locations[0].city,
          state: req.body.state || locations[0].state,
          zipCode: req.body.zipCode || locations[0].zipCode
        };
      } else {
        // Create new location if none exists
        locations = [{
          country: req.body.country || '',
          address1: req.body.address1 || '',
          address2: req.body.address2 || '',
          city: req.body.city || '',
          state: req.body.state || '',
          zipCode: req.body.zipCode || ''
        }];
      }
    }
    
    // Prepare update data
    const updateData = {
      name: req.body.name || profile.name,
      overview: req.body.overview || profile.overview,
      industry: req.body.industry || profile.industry,
      size: req.body.size || profile.size,
      specializations,
      locations,
      updatedAt: Date.now()
    };
    
    // Handle logo image replacement
    if (req.body.logo && profile.logo && req.body.logo !== profile.logo) {
      try {
        // Delete the old image from Cloudinary if it's a Cloudinary URL
        if (profile.logo.includes('cloudinary.com')) {
          const publicId = getPublicIdFromUrl(profile.logo);
          if (publicId) {
            await deleteImage(publicId).catch(err => {
              console.error('Error deleting old logo from Cloudinary:', err);
              // Continue even if delete fails
            });
          }
        }
      } catch (deleteErr) {
        console.error('Error handling old logo image:', deleteErr);
        // Continue with update even if delete fails
      }
    }
    
    // Update logo if provided
    if (req.body.logo) {
      updateData.logo = req.body.logo;
    }
    
    // Update profile
    profile = await BusinessProfile.findOneAndUpdate(
      { user: objectId }, 
      { $set: updateData },
      { new: true, runValidators: true }
    );
    
    res.status(200).json({
      success: true,
      data: profile,
      message: 'Business profile updated successfully'
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message || 'Internal server error'
    });
  }
};

/**
 * Delete a business profile
 * @route DELETE /api/profile/delete-business-profile/:id
 * @access Private
 */
export const deleteBusinessProfile = async (req, res) => {
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
    
    const profile = await BusinessProfile.findOne({ user: userObjectId });
    if (!profile) {
      return res.status(404).json({
        success: false,
        message: 'Business profile not found'
      });
    }
    
    // If profile has a logo on Cloudinary, delete it
    if (profile.logo && profile.logo.includes('cloudinary.com')) {
      try {
        const publicId = getPublicIdFromUrl(profile.logo);
        if (publicId) {
          await deleteImage(publicId).catch(err => {
            console.error('Error deleting logo from Cloudinary:', err);
            // Continue even if delete fails
          });
        }
      } catch (error) {
        console.error('Error handling logo deletion:', error);
        // Continue with deletion even if image delete fails
      }
    }
    
    await BusinessProfile.findOneAndDelete({ user: userObjectId });
    
    res.status(200).json({
      success: true,
      message: 'Business profile deleted successfully'
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message || 'Internal server error'
    });
  }
};

/**
 * Add a new location to business profile
 * @route POST /api/profile/business-location/:id
 * @access Private
 */
export const addBusinessLocation = async (req, res) => {
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
    let profile = await BusinessProfile.findOne({ user: objectId });
    
    if (!profile) {
      return res.status(404).json({
        success: false,
        message: 'Business profile not found'
      });
    }
    
    // Create new location
    const newLocation = {
      country: req.body.country || '',
      address1: req.body.address1 || '',
      address2: req.body.address2 || '',
      city: req.body.city || '',
      state: req.body.state || '',
      zipCode: req.body.zipCode || ''
    };
    
    // Add location to profile
    profile = await BusinessProfile.findOneAndUpdate(
      { user: objectId },
      { $push: { locations: newLocation } },
      { new: true }
    );
    
    res.status(200).json({
      success: true,
      data: profile,
      message: 'Location added successfully'
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message || 'Internal server error'
    });
  }
};

/**
 * Remove a location from business profile
 * @route DELETE /api/profile/business-location/:id/:locationIndex
 * @access Private
 */
export const removeBusinessLocation = async (req, res) => {
  try {
    const userId = req.params.id;
    const locationIndex = parseInt(req.params.locationIndex);
    
    // Validate userId
    if (!userId || !isValidObjectId(userId)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid user ID'
      });
    }
    
    // Validate location index
    if (isNaN(locationIndex) || locationIndex < 0) {
      return res.status(400).json({
        success: false,
        message: 'Invalid location index'
      });
    }
    
    // Convert to ObjectId
    const objectId = new mongoose.Types.ObjectId(userId.toString());
    
    // Check if profile exists
    let profile = await BusinessProfile.findOne({ user: objectId });
    
    if (!profile) {
      return res.status(404).json({
        success: false,
        message: 'Business profile not found'
      });
    }
    
    // Check if location exists
    if (!profile.locations || profile.locations.length <= locationIndex) {
      return res.status(404).json({
        success: false,
        message: 'Location not found'
      });
    }
    
    // Remove location
    profile.locations.splice(locationIndex, 1);
    
    // Update profile
    profile = await BusinessProfile.findOneAndUpdate(
      { user: objectId },
      { $set: { locations: profile.locations } },
      { new: true }
    );
    
    res.status(200).json({
      success: true,
      data: profile,
      message: 'Location removed successfully'
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message || 'Internal server error'
    });
  }
};