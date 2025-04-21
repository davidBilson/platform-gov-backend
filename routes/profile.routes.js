// profile.routes.js
import express from 'express';
import {
    createFreelancerProfile,
    updateFreelancerProfile,
    getFreelancerProfile,
    deleteFreelancerProfile
} from '../controllers/profile.freelancer.controller.js';

import {
    createBusinessProfile,
    updateBusinessProfile,
    getBusinessProfile,
    deleteBusinessProfile
} from '../controllers/profile.business.controller.js';

import { upload } from '../middleware/multer-image-upload.js';

import { uploadImage } from '../utils/cloudinary.js';

const router = express.Router();

// Routes

router.post('/create-business-profile', createBusinessProfile);

router.get('/fetch-business-profile/:id', getBusinessProfile);

router.put('/update-business-profile/:id', updateBusinessProfile);

router.delete('/delete-business-profile/:id', deleteBusinessProfile);


router.post('/create-freelancer-profile', createFreelancerProfile);

router.get('/fetch-freelancer-profile/:id', getFreelancerProfile);

router.put('/update-freelancer-profile/:id', updateFreelancerProfile);

router.delete('/delete-freelancer-profile/:id', deleteFreelancerProfile);

// Image upload route


router.post('/upload-profile-image', upload.single('profileImage'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({
        success: false,
        message: 'No file uploaded'
      });
    }
    
    // Upload the temp file to Cloudinary
    const result = await uploadImage(req.file.path, 'profiles');
    
    // Return the secure URL and public_id from Cloudinary
    res.status(200).json({
      success: true,
      data: {
        imagePath: result.secure_url,
        publicId: result.public_id
      }
    });
  } catch (error) {
    console.error('Image upload error:', error);
    
    // Clean up temp file if it exists and upload failed
    if (req.file && req.file.path) {
      try {
        fs.unlinkSync(req.file.path);
      } catch (err) {
        console.error('Error removing temporary file:', err);
      }
    }
    
    res.status(500).json({
      success: false,
      message: error.message || 'Error uploading file'
    });
  }
});

export default router;