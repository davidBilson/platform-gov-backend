import LegalDocument from "../models/legalcontent.model.js";


  export const getDocumentByType = async (req, res) => {
    try {
      const { documentType } = req.params;
      if (![
        'terms-of-use', 
        'non-circumvention-policy', 
        'consent-to-signature-and-commission',
        'liability-disclaimer',
        'privacy-policy'
      ].includes(documentType)) {
        return res.status(400).json({
          success: false,
          message: 'Invalid document type'
        });
      }

      const document = await LegalDocument.findOne({ documentType });
      if (!document) {
        return res.status(404).json({
          success: false,
          message: `No ${documentType} document found`
        });
      }

      res.status(200).json({
        success: true,
        data: document
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        message: 'Error fetching document',
        error: error.message
      });
    }
  }

  export const upsertDocument = async (req, res) => {
    try {
      const { title, description, documentType } = req.body;

      if (!title || !description || !documentType) {
        return res.status(400).json({
          success: false,
          message: 'Title, description, and documentType are required'
        });
      }

      if (![
        'terms-of-use', 
        'non-circumvention-policy', 
        'consent-to-signature-and-commission',
        'liability-disclaimer',
        'privacy-policy'
      ].includes(documentType)) {
        return res.status(400).json({
          success: false,
          message: 'Invalid document type.'
        });
      }

      const document = await LegalDocument.findOneAndUpdate(
        { documentType },
        { 
          title: title.trim(),
          description: description.trim(),
          documentType 
        },
        { 
          new: true,
          upsert: true,
          runValidators: true
        }
      );

      const isNewDocument = !document.createdAt || document.createdAt === document.updatedAt;
      res.status(isNewDocument ? 201 : 200).json({
        success: true,
        message: isNewDocument ? 'Document created successfully' : 'Document updated successfully',
        data: document
      });
    } catch (error) {
      if (error.name === 'ValidationError') {
        return res.status(400).json({
          success: false,
          message: 'Validation error',
          errors: Object.values(error.errors).map(e => e.message)
        });
      }

      res.status(500).json({
        success: false,
        message: 'Error creating/updating document',
        error: error.message
      });
    }
  }