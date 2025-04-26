// profile.routes.js
import express from 'express';

import {
    createContractorProfile,
    updateContractorProfile,
    getContractorProfile,
    deleteContractorProfile,
    getAllContractorProfiles
} from '../controllers/profile.contractor.controller.js';

import {
    createClientProfile,
    updateClientProfile,
    getClientProfile,
    deleteClientProfile,
    getAllClientProfiles
} from '../controllers/profile.client.controller.js';

import { upload } from '../middleware/multer-image-upload.js';
import { uploadImage } from '../utils/cloudinary.js';

const router = express.Router();

// CLIENT ROUTES
router.post('/create-client-profile', createClientProfile);
router.get('/fetch-all-clients', getAllClientProfiles);
router.get('/fetch-client-profile/:id', getClientProfile);
router.put('/update-client-profile/:id', updateClientProfile);
router.delete('/delete-client-profile/:id', deleteClientProfile);

// CONTRACTOR ROUTES
router.post('/create-contractor-profile', createContractorProfile);
router.get('/fetch-all-contractors', getAllContractorProfiles);
router.get('/fetch-contractor-profile/:id', getContractorProfile);
router.put('/update-contractor-profile/:id', updateContractorProfile);
router.delete('/delete-contractor-profile/:id', deleteContractorProfile);

// IMAGE UPLOAD ROUTE
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