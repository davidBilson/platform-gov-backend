import mongoose from "mongoose";

const legalDocumentSchema = new mongoose.Schema({
  title: {
    type: String,
    required: true,
    trim: true
  },
  description: {
    type: String,
    required: true,
  },
  documentType: {
    type: String,
    required: true,
    enum: [
        'legal-agreement',
        'terms-of-use',
        'non-circumvention-policy', 
        'consent-to-signature-and-commission',
        'liability-disclaimer',
        'privacy-policy'
    ]
  }
}, {
  timestamps: true
});

const LegalDocument = mongoose.model('LegalDocument', legalDocumentSchema);

export default LegalDocument;