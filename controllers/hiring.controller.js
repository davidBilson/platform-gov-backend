import mongoose from 'mongoose';
import multer from 'multer'; // Import multer directly
import { uploadFile } from '../utils/cloudinary.js';
import Hiring from '../models/hiring.model.js';

// Configure multer in memory (no disk storage needed for Cloudinary)
const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 10 * 1024 * 1024, // 10MB limit per file
  },
});

// Create a middleware function for handling multiple files
const handleFileUpload = upload.array('documents'); // 'documents' should match your FormData field name

export const createHiringOffer = async (req, res) => {
  try {
    // First handle the file upload
    handleFileUpload(req, res, async (err) => {
      
      if (err) {
        console.error('File upload error:', err);
        return res.status(400).json({ error: 'File upload failed', details: err.message });
      }
      
      const {
        jobId,
        clientId,
        contractorId,
        applicationId,
        rate,
        employmentType,
        startDate,
        clientNotes
      } = req.body;

      const documents = req.files || [];

      if (
        !mongoose.Types.ObjectId.isValid(jobId) ||
        !mongoose.Types.ObjectId.isValid(clientId) ||
        !mongoose.Types.ObjectId.isValid(contractorId) ||
        !mongoose.Types.ObjectId.isValid(applicationId)
      ) {
        return res.status(400).json({ error: 'Invalid ID format' });
      }

      let uploadedDocuments = [];
      if (documents.length > 0) {
        const uploadPromises = documents.map(async (file) => {
          try {
            const uploadResult = await uploadFile(file.buffer, 'hiring-documents');
            
            return {
              url: uploadResult.secure_url,
              publicId: uploadResult.public_id,
              format: uploadResult.format,
              resourceType: uploadResult.resource_type,
              originalName: file.originalname,
              size: uploadResult.bytes
            };
          } catch (uploadError) {
            console.error('Error uploading file:', uploadError);
            return null;
          }
        });
        
        const results = await Promise.all(uploadPromises);
        uploadedDocuments = results.filter(doc => doc !== null);
      }

      const newHiring = new Hiring({
        jobId,
        clientId,
        contractorId,
        applicationId,
        offerDetails: {
          rate: parseFloat(rate),
          paymentType: 'hourly',
          employmentType,
          startDate: new Date(startDate)
        },
        documents: uploadedDocuments,
        clientNotes: clientNotes || '',
        status: 'offered'
      });

      await newHiring.save();

      res.status(201).json({
        success: true,
        data: newHiring,
        message: 'Hiring offer created successfully'
      });
    });
  } catch (error) {
    console.error('Error creating hiring offer:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Failed to create hiring offer'
    });
  }
};

export const acceptHiringOffer = async (req, res) => {
  try {
    handleFileUpload(req, res, async (err) => {
      if (err) {
        console.error('File upload error:', err);
        return res.status(400).json({ error: 'File upload failed', details: err.message });
      }

      const hiringId = req.params.id;
      const { contractorNotes, contractorId } = req.body;
      
      const documents = req.files || [];
      
      let contractorDocuments = [];
      
      if (documents.length > 0) {
        const uploadPromises = documents.map(async (file) => {
          try {
            const uploadResult = await uploadFile(file.buffer, 'hiring-documents/contractor');
            return {
              url: uploadResult.secure_url,
              publicId: uploadResult.public_id,
              format: uploadResult.format,
              resourceType: uploadResult.resource_type,
              originalName: file.originalname,
              size: uploadResult.bytes
            };
          } catch (uploadError) {
            console.error('Error uploading file:', uploadError);
            return null;
          }
        });
        
        const results = await Promise.all(uploadPromises);
        contractorDocuments = results.filter(doc => doc !== null);
      }

      const hiring = await Hiring.findOne({
        _id: hiringId,
        contractorId // Verify contractor owns this offer
      });
      
      if (!hiring) {
        return res.status(404).json({ error: 'Hiring offer not found or unauthorized' });
      }
      
      const allDocuments = [...hiring.documents, ...contractorDocuments];

      const updatedHiring = await Hiring.findByIdAndUpdate(
        hiringId,
        {
          status: 'accepted',
          contractorNotes: contractorNotes || '',
          documents: allDocuments,
          updatedAt: new Date()
        },
        { new: true }
      );

      if (!updatedHiring) {
        return res.status(404).json({ error: 'Hiring offer not found' });
      }

      res.json({
        success: true,
        data: updatedHiring,
        message: 'Hiring offer accepted'
      });
    });
  } catch (error) {
    console.error('Error accepting hiring offer:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Failed to accept hiring offer'
    });
  }
};
export const getHiringOffer = async (req, res) => {
  try {
    const { jobId, applicationId } = req.body;

    // Validate all required fields exist
    if (!jobId || !applicationId) {
      return res.status(400).json({ 
        error: 'Missing required fields. Please provide jobId, and applicationId' 
      });
    }

    // Validate all IDs
    if (!mongoose.Types.ObjectId.isValid(jobId) || !mongoose.Types.ObjectId.isValid(applicationId)) {
      return res.status(400).json({ error: 'One or more invalid ID formats' });
    }

    // Find the hiring offer
    const hiringOffer = await Hiring.findOne({
      jobId,
      applicationId,
    })
    .populate('jobId', 'title description')
    .populate('clientId', 'firstName lastName email')
    .populate('contractorId', 'firstName lastName email')
    .populate('applicationId', 'coverLetter');

    if (!hiringOffer) {
      return res.status(404).json({ 
        error: 'Hiring offer not found or you are not authorized to view this offer' 
      });
    }

    res.json({
      success: true,
      data: hiringOffer,
      message: 'Hiring offer retrieved successfully'
    });

  } catch (error) {
    console.error('Error retrieving hiring offer:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Failed to retrieve hiring offer'
    });
  }
};

// Helper function remains the same
export const deleteHiringDocuments = async (hiringId) => {
  try {
    const hiring = await Hiring.findById(hiringId);
    if (!hiring || !hiring.documents || hiring.documents.length === 0) {
      return;
    }
    
    const { deleteFile } = require('../utils/cloudinary.js');
    
    const deletePromises = hiring.documents.map(doc => {
      if (doc.publicId) {
        const resourceType = doc.resourceType || 'image';
        return deleteFile(doc.publicId, resourceType);
      }
      return Promise.resolve();
    });
    
    await Promise.all(deletePromises);
  } catch (error) {
    console.error('Error deleting hiring documents:', error);
  }
};

export const contractorSignHiringOffer = async (req, res) => {
  try {
    const { id } = req.params;
    const { contractorId } = req.body; // Get contractorId from request body

    if (!mongoose.Types.ObjectId.isValid(id) || !mongoose.Types.ObjectId.isValid(contractorId)) {
      return res.status(400).json({ error: 'Invalid ID format' });
    }

    const updatedHiring = await Hiring.findOneAndUpdate(
      {
        _id: id,
        contractorId // Ensure the contractor owns this hiring offer
      },
      {
        contractorSigned: true,
        updatedAt: new Date()
      },
      { new: true }
    );

    if (!updatedHiring) {
      return res.status(404).json({ error: 'Hiring offer not found or unauthorized' });
    }

    res.json({
      success: true,
      data: updatedHiring,
      message: 'Contractor signed the hiring offer successfully'
    });

  } catch (error) {
    console.error('Error signing hiring offer:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Failed to sign hiring offer'
    });
  }
};


export const getContractorSignature = async (req, res) => {
  try {
    const { id } = req.params;
    const { contractorId } = req.query; // Get contractorId from query params

    if (!mongoose.Types.ObjectId.isValid(id) || !mongoose.Types.ObjectId.isValid(contractorId)) {
      return res.status(400).json({ error: 'Invalid ID format' });
    }

    const hiring = await Hiring.findOne({
      _id: id,
      contractorId
    });

    if (!hiring) {
      return res.status(404).json({ error: 'Hiring offer not found or unauthorized' });
    }

    res.json({
      success: true,
      data: {
        contractorSigned: hiring.contractorSigned || false
      }
    });

  } catch (error) {
    console.error('Error getting contractor signature:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Failed to get signature status'
    });
  }
};