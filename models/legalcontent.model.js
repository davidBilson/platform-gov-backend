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
    trim: true
  },
  documentType: {
    type: String,
    required: true,
    enum: [
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