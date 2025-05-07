import mongoose from 'mongoose';
import { uploadFile } from '../utils/cloudinary'; // Import the Cloudinary utility
import Hiring from '../models/hiring.model.js';

export const createHiringOffer = async (req, res) => {
  try {
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

    const files = req.files;

    // Validate ObjectId formats
    if (
      !mongoose.Types.ObjectId.isValid(jobId) ||
      !mongoose.Types.ObjectId.isValid(clientId) ||
      !mongoose.Types.ObjectId.isValid(contractorId) ||
      !mongoose.Types.ObjectId.isValid(applicationId)
    ) {
      return res.status(400).json({ error: 'Invalid ID format' });
    }

    // Upload documents to Cloudinary if any
    let uploadedDocuments = [];
    if (files && files.length > 0) {
      // Process each file upload to Cloudinary
      const uploadPromises = files.map(async (file) => {
        // Upload file to Cloudinary
        const uploadResult = await uploadFile(file.path, 'hiring-documents');
        
        // Return structured document info
        return {
          url: uploadResult.secure_url,
          publicId: uploadResult.public_id,
          format: uploadResult.format,
          resourceType: uploadResult.resource_type,
          originalName: file.originalname || 'document',
          size: uploadResult.bytes
        };
      });
      
      // Await all uploads to complete
      uploadedDocuments = await Promise.all(uploadPromises);
    }

    const newHiring = new Hiring({
      jobId,
      clientId,
      contractorId,
      applicationId,
      offerDetails: {
        rate: parseFloat(rate),
        paymentType: 'hourly', // Default, can be modified
        employmentType,
        startDate: new Date(startDate)
      },
      documents: uploadedDocuments,
      clientNotes,
      status: 'offered'
    });

    await newHiring.save();

    res.status(201).json({
      success: true,
      data: newHiring,
      message: 'Hiring offer created successfully'
    });
  } catch (error) {
    console.error('Error creating hiring offer:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to create hiring offer'
    });
  }
};

export const acceptHiringOffer = async (req, res) => {
  try {
    const { hiringId } = req.params;
    const { contractorNotes } = req.body;
    
    // Handle additional document uploads if provided in acceptance
    const files = req.files;
    let contractorDocuments = [];
    
    if (files && files.length > 0) {
      // Process each file upload to Cloudinary
      const uploadPromises = files.map(async (file) => {
        // Upload file to Cloudinary
        const uploadResult = await uploadFile(file.path, 'hiring-documents/contractor');
        
        // Return structured document info
        return {
          url: uploadResult.secure_url,
          publicId: uploadResult.public_id,
          format: uploadResult.format,
          resourceType: uploadResult.resource_type,
          originalName: file.originalname || 'document',
          size: uploadResult.bytes
        };
      });
      
      // Await all uploads to complete
      contractorDocuments = await Promise.all(uploadPromises);
    }

    // Get the current hiring document
    const hiring = await Hiring.findById(hiringId);
    if (!hiring) {
      return res.status(404).json({ error: 'Hiring offer not found' });
    }
    
    // Combine existing documents with new ones
    const allDocuments = [...hiring.documents, ...contractorDocuments];

    const updatedHiring = await Hiring.findByIdAndUpdate(
      hiringId,
      {
        status: 'accepted',
        contractorNotes,
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
  } catch (error) {
    console.error('Error accepting hiring offer:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to accept hiring offer'
    });
  }
};

// Helper function to delete all documents associated with a hiring
export const deleteHiringDocuments = async (hiringId) => {
  try {
    const hiring = await Hiring.findById(hiringId);
    if (!hiring || !hiring.documents || hiring.documents.length === 0) {
      return;
    }
    
    const { deleteFile } = require('../utils/cloudinary.js');
    
    // Delete each document from Cloudinary
    const deletePromises = hiring.documents.map(doc => {
      if (doc.publicId) {
        // Determine the resource type (default to 'image' if not specified)
        const resourceType = doc.resourceType || 'image';
        return deleteFile(doc.publicId, resourceType);
      }
      return Promise.resolve();
    });
    
    await Promise.all(deletePromises);
  } catch (error) {
    console.error('Error deleting hiring documents:', error);
    // Just log the error but don't throw, as this might be called in cleanup operations
  }
};