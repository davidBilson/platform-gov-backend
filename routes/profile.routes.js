// profile.routes.js
import express from 'express';
import {
    createProfile,
    updateProfile,
    getProfileByUserId,
    deleteProfile
} from '../controllers/profile.controller.js';
import { upload } from '../middleware/multer-image-upload.js';

import { uploadImage } from '../utils/cloudinary.js';

const router = express.Router();

// Routes
router.post('/create', createProfile);

router.get('/:id', getProfileByUserId);

router.put('/update/:id', updateProfile);

router.delete('/delete/:id', deleteProfile);

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