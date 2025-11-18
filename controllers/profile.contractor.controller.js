import mongoose from 'mongoose';
import ContractorProfile from '../models/profile.contractor.model.js';
import User from '../models/user.model.js';
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
    return [field];
  }
};

export const getAllContractorProfiles = async (req, res) => {
  try {

    const profiles = await ContractorProfile.find();

    const enhancedProfiles = [];

    for (const profile of profiles) {
      const user = await User.findById(profile.user).select('name email phoneNumber isSuspended isSubscribed isHighPriority');

      if (user) {
        const enhancedProfile = {
          ...profile.toObject(),
          user: {
            _id: user._id,
            name: user.name,
            email: user.email,
            phoneNumber: user.phoneNumber,
            isSuspended: user.isSuspended,
            isHighPriority: user.isHighPriority,
            isSubscribed: user.isSubscribed ?? false
          }
        };

        enhancedProfiles.push(enhancedProfile);

      } else {
        enhancedProfiles.push(profile.toObject());
      }
    }

    res.status(200).json({
      success: true,
      count: enhancedProfiles.length,
      data: enhancedProfiles
    });
    
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message || 'Internal server error'
    });
  }
};

export const getContractorProfile = async (req, res) => {
  try {

    const userId = req.params.id;

    if (!userId || !isValidObjectId(userId)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid user ID'
      });
    }

    let profile = await ContractorProfile.findOne({ user: userId })
      .populate({
        path: 'user',
        select: 'name isHighPriority isSuspended bankAccounts isSubscribed'
      });

    if (!profile) {
      const objectId = new mongoose.Types.ObjectId(userId.toString());
      profile = await ContractorProfile.findOne({ user: objectId })
        .populate({
          path: 'user',
          select: 'name isHighPriority isSuspended'
        });
    }

    if (!profile) {
      return res.status(404).json({
        success: false,
        message: 'Contractor profile not found'
      });
    }

    const profileWithName = {
      ...profile.toObject(),
      name: profile.user?.name || 'Anonymous'
    };

    res.status(200).json({
      success: true,
      data: profileWithName
    });

  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message || 'Internal server error'
    });
  }
};

export const createContractorProfile = async (req, res) => {
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
    const departments = parseArrayField(req.body.departments); // NEW
    const workHistory = parseArrayField(req.body.workHistory);
    const degrees = parseArrayField(req.body.degrees);

    // Handle profile image
    const profileImage = req.body.profileImage || '';

    // Create profile data
    const profileData = {
      user: objectId,
      bio: req.body.bio || '',
      linkedInUrl: req.body.linkedInUrl || '',
      profileImage,
      clearance: req.body.clearance || '',
      ratePerHour: req.body.ratePerHour || 0,
      secondRate: req.body.secondRate || 0,
      profession: req.body.profession || '',
      primaryPosition: req.body.primaryPosition || '',
      firmAffiliation: req.body.firmAffiliation || '',
      location: req.body.location || { country: '', state: '' },
      skills,
      expertise,
      certifications,
      departments,
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

export const updateContractorProfile = async (req, res) => {
  try {
    const userId = req.params.id;
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
    // const expertise = parseArrayField(req.body.expertise) ?? profile.expertise;
    const certifications = parseArrayField(req.body.certifications) ?? profile.certifications;
    const departments = parseArrayField(req.body.departments) ?? profile.departments; // NEW
    const workHistory = parseArrayField(req.body.workHistory) ?? profile.workHistory;
    const degrees = parseArrayField(req.body.degrees) ?? profile.degrees;

    // Prepare update data
    const updateData = {
      bio: req.body.bio || profile.bio,
      linkedInUrl: req.body.linkedInUrl || profile.linkedInUrl,
      ratePerHour: req.body.ratePerHour || profile.ratePerHour,
      secondRate: req.body.secondRate || profile.secondRate,
      primaryPosition: req.body.primaryPosition || profile.primaryPosition,
      profession: req.body.profession || profile.profession,
      firmAffiliation: req.body.firmAffiliation ?? profile.firmAffiliation,
      clearance: req.body.clearance ?? profile.clearance,
      location: req.body.location ?? profile.location,
      skills,
      // expertise,
      certifications,
      departments, // NEW
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

export const searchProfiles = async (req, res) => {
  try {
    const { skills, expertise, certifications, departments, query, limit = 20, skip = 0 } = req.query; // NEW

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

    // NEW: Add departments search
    if (departments) {
      searchCriteria.departments = { $in: departments.split(',') };
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

export const getAllDepartments = async (req, res) => {
  try {
    const departments = await ContractorProfile.distinct('departments');

    res.status(200).json({
      success: true,
      count: departments.length,
      data: departments
    });
  } catch (error) {
    console.error('Get departments error:', error);
    res.status(500).json({
      success: false,
      message: error.message || 'Internal server error'
    });
  }
};