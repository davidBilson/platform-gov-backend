// profile.routes.js
import express from 'express';
import {
    createProfile,
    updateProfile,
    getProfileByUserId,
    deleteProfile
} from '../controllers/profile.controller.js';
import { upload } from '../middleware/image-upload.js';

const router = express.Router();

// Routes
router.post('/create', createProfile);

router.get('/:id', getProfileByUserId);

router.put('/update/:id', updateProfile);

router.delete('/delete/:id', deleteProfile);

// Image upload route
router.post('/upload-profile-image', upload.single('profileImage'), (req, res) => {
    try {
      if (!req.file) {
        return res.status(400).json({
          success: false,
          message: 'No file uploaded'
        });
      }
      
      // Return the path to the uploaded file
      const imagePath = `/uploads/profiles/${req.file.filename}`;
      
      res.status(200).json({
        success: true,
        data: { imagePath }
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        message: error.message || 'Error uploading file'
      });
    }
  });
  

export default router;