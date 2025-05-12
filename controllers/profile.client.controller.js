
import mongoose from 'mongoose';
import ClientProfile from '../models/profile.client.model.js';
import { deleteImage, getPublicIdFromUrl } from '../utils/cloudinary.js';

const isValidObjectId = (id) => {
  return mongoose.Types.ObjectId.isValid(id);
};

const toObjectId = (id) => {
  if (!id || !isValidObjectId(id)) return null;
  return new mongoose.Types.ObjectId(id.toString());
};

const parseArrayField = (field) => {
  if (!field) return [];
  if (Array.isArray(field)) return field;
  try {
    return JSON.parse(field);
  } catch (e) {
    return [field]; // Return as single item array if not JSON parseable
  }
};

export const getAllClientProfiles = async (req, res) => {
  try {
    const profiles = await ClientProfile.find();
    
    res.status(200).json({
      success: true,
      count: profiles.length,
      data: profiles
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message || 'Internal server error'
    });
  }
};

export const getClientProfile = async (req, res) => {
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
    let profile = await ClientProfile.findOne({ user: userId });
    
    // If not found, try with ObjectId
    if (!profile) {
      const objectId = new mongoose.Types.ObjectId(userId.toString());
      profile = await ClientProfile.findOne({ user: objectId });
    }
    
    if (!profile) {
      return res.status(404).json({
        success: false,
        message: 'Client profile not found'
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

export const createClientProfile = async (req, res) => {
  try {
    const userId = req.body.userId;

    if (!userId || !isValidObjectId(userId)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid user ID'
      });
    }
    
    // Convert to ObjectId
    const objectId = new mongoose.Types.ObjectId(userId.toString());
    
    const existingProfile = await ClientProfile.findOne({ user: objectId });
    if (existingProfile) {
      return res.status(400).json({
        success: false,
        message: 'Client profile already exists for this user. Use update instead.'
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
    const profile = await ClientProfile.create(profileData);
    
    res.status(201).json({
      success: true,
      data: profile,
      message: 'Client profile created successfully'
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message || 'Internal server error'
    });
  }
};

/**
 * Update a Client profile
 * @route PUT /api/profile/update-Client-profile/:id
 * @access Private
 */
export const updateClientProfile = async (req, res) => {
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
    let profile = await ClientProfile.findOne({ user: objectId });
    
    // If not found, try with string ID as fallback
    if (!profile) {
      profile = await ClientProfile.findOne({ user: userId });
    }
    
    if (!profile) {
      return res.status(404).json({
        success: false,
        message: 'Client profile not found'
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
    profile = await ClientProfile.findOneAndUpdate(
      { user: objectId }, 
      { $set: updateData },
      { new: true, runValidators: true }
    );
    
    res.status(200).json({
      success: true,
      data: profile,
      message: 'Client profile updated successfully'
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message || 'Internal server error'
    });
  }
};

/**
 * Delete a client profile
 * @route DELETE /api/profile/delete-client-profile/:id
 * @access Private
 */
export const deleteClientProfile = async (req, res) => {
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
    
    const profile = await ClientProfile.findOne({ user: userObjectId });
    if (!profile) {
      return res.status(404).json({
        success: false,
        message: 'Client profile not found'
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
    
    await ClientProfile.findOneAndDelete({ user: userObjectId });
    
    res.status(200).json({
      success: true,
      message: 'Client profile deleted successfully'
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message || 'Internal server error'
    });
  }
};

/**
 * Add a new location to client profile
 * @route POST /api/profile/client-location/:id
 * @access Private
 */
export const addClientLocation = async (req, res) => {
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
    let profile = await ClientProfile.findOne({ user: objectId });
    
    if (!profile) {
      return res.status(404).json({
        success: false,
        message: 'Client profile not found'
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
    profile = await ClientProfile.findOneAndUpdate(
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
 * Remove a location from client profile
 * @route DELETE /api/profile/client-location/:id/:locationIndex
 * @access Private
 */
export const removeClientLocation = async (req, res) => {
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
    let profile = await ClientProfile.findOne({ user: objectId });
    
    if (!profile) {
      return res.status(404).json({
        success: false,
        message: 'Client profile not found'
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
    profile = await ClientProfile.findOneAndUpdate(
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