import mongoose from 'mongoose';
import { uploadFile } from '../utils/cloudinary.js';
import Hiring from '../models/hiring.model.js';
import path from 'path';
import { equal } from 'assert';

export const createHiringOffer = async (req, res) => {
  try {
    // req.file is now available from the Multer middleware
    const file = req.file;

    // Parse the text fields from form-data
    const {
      jobId,
      clientId,
      contractorId,
      applicationId,
      rate,
      paymentType,
      employmentType,
      startDate,
      clientNotes
    } = req.body;

    // Validate required fields
    if (!jobId || !clientId || !contractorId || !applicationId || !rate || !paymentType || !employmentType || !startDate) {
      return res.status(400).json({ error: 'Missing required fields' });
    }

    // Validate IDs
    if (
      !mongoose.Types.ObjectId.isValid(jobId) ||
      !mongoose.Types.ObjectId.isValid(clientId) ||
      !mongoose.Types.ObjectId.isValid(contractorId) ||
      !mongoose.Types.ObjectId.isValid(applicationId)
    ) {
      return res.status(400).json({ error: 'Invalid ID format' });
    }

    // Process file upload if exists
    let uploadedDocuments = [];
    if (file) {
      try {
        const uploadResult = await uploadFile(
          file.buffer,
          'hiring-documents',
          null,
          file.originalname
        );

        uploadedDocuments.push({
          url: uploadResult.secure_url,
          publicId: uploadResult.public_id,
          format: uploadResult.format || path.extname(file.originalname).slice(1),
          resourceType: uploadResult.resource_type,
          originalName: file.originalname,
          size: uploadResult.bytes || file.size
        });
      } catch (uploadError) {
        console.error('Detailed upload error:', uploadError);
        return res.status(500).json({
          error: 'Failed to upload document',
          details: uploadError.message
        });
      }
    }

    const newHiring = new Hiring({
      jobId,
      clientId,
      contractorId,
      applicationId,
      offerDetails: {
        rate: parseFloat(rate),
        paymentType,
        employmentType,
        startDate: new Date(startDate)
      },
      documents: uploadedDocuments,
      clientNotes: req.body.clientNotes || '',
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
      error: error.message || 'Failed to create hiring offer'
    });
  }
};

export const acceptHiringOffer = async (req, res) => {
  try {
    const id = req.params.id;
    const { contractorId } = req.body;

    if (!mongoose.Types.ObjectId.isValid(id) || !mongoose.Types.ObjectId.isValid(contractorId)) {
      return res.status(400).json({ error: 'Invalid ID format' });
    }

    const updatedHiring = await Hiring.findOneAndUpdate(
      {
        _id: id,
        contractorId
      },
      {
        status: 'accepted',
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
      message: 'Hiring offer accepted'
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

export const getClientHiringOffers = async (req, res) => {
  try {
    const clientId = req.params.id;

    if (!mongoose.Types.ObjectId.isValid(clientId)) {
      return res.status(400).json({ error: 'Invalid client ID format' });
    }

    const hiringOffers = await Hiring.find({ clientId })
      .populate('jobId', 'jobTitle description')
      .populate('contractorId', 'name email profileImage')
      .populate('applicationId', 'coverLetter')
      .sort({ createdAt: -1 }); // Sort by newest first

    if (!hiringOffers || hiringOffers.length === 0) {
      return res.status(404).json({
        success: true,
        data: [],
        message: 'No hiring offers found for this client'
      });
    }

    res.json({
      success: true,
      data: hiringOffers,
      message: 'Client hiring offers retrieved successfully'
    });

  } catch (error) {
    console.error('Error retrieving client hiring offers:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Failed to retrieve client hiring offers'
    });
  }
};

