// content.model.js

import mongoose from 'mongoose';

const categorySchema = new mongoose.Schema({
  name: {
    type: String,
    required: true,
    unique: true,
    trim: true
  },
  label: {
    type: String,
    required: true,
    trim: true
  },
  createdAt: {
    type: Date,
    default: Date.now
  }
});

const itemSchema = new mongoose.Schema({
  category: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'ContentCategory',
    required: true
  },
  value: {
    type: String,
    required: true,
    trim: true
  },
  createdAt: {
    type: Date,
    default: Date.now
  }
});

// Prevent duplicate items in same category
itemSchema.index({ category: 1, value: 1 }, { unique: true });

export const ContentCategory = mongoose.model('ContentCategory', categorySchema);
export const ContentItem = mongoose.model('ContentItem', itemSchema);