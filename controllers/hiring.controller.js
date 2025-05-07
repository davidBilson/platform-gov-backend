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
    // First handle the file upload
    handleFileUpload(req, res, async (err) => {
      if (err) {
        console.error('File upload error:', err);
        return res.status(400).json({ error: 'File upload failed', details: err.message });
      }

      const { hiringId } = req.params;
      const { contractorNotes } = req.body;
      
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

      const hiring = await Hiring.findById(hiringId);
      if (!hiring) {
        return res.status(404).json({ error: 'Hiring offer not found' });
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