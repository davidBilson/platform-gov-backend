import express from 'express';
import multer from 'multer';
import {
  createHiringOffer,
  acceptHiringOffer,
  getHiringOffer,
  contractorSignHiringOffer,
  getContractorSignature,
  getClientHiringOffers
} from '../controllers/hiring.controller.js';

const router = express.Router();

// Configure multer for file uploads
const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 10 * 1024 * 1024, // 10MB
    files: 1 // Only allow 1 file
  },
  fileFilter: (req, file, cb) => {
    const allowedTypes = [
      'application/pdf',
      'application/msword',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      'image/jpeg',
      'image/png'
    ];
    if (allowedTypes.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error('Invalid file type. Only PDF, DOC, DOCX, JPG, PNG are allowed'));
    }
  }
});

// Error handling middleware for file uploads
const handleFileUploadError = (err, req, res, next) => {
  if (err instanceof multer.MulterError) {
    return res.status(400).json({
      error: 'File upload error',
      details: err.message,
      code: err.code
    });
  } else if (err) {
    return res.status(400).json({
      error: 'File validation error',
      details: err.message
    });
  }
  next();
};

// Routes with file upload middleware
router.post('/send-hiring-offer', 
  upload.single('documents'), // Changed to single file upload
  handleFileUploadError,
  createHiringOffer
);

router.put('/accept-hiring-offer/:id', acceptHiringOffer);

// Routes without file uploads
router.post('/get-hiring-offer', getHiringOffer);
router.get('/get-contractor-offer-signature/:id', getContractorSignature);
router.put('/contractor-sign-hiring-offer/:id', contractorSignHiringOffer);
router.get('/get-client-hiring-offers/:id', getClientHiringOffers);

export default router;