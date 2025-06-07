// content.controller.js

import { ContentCategory, ContentItem } from '../../models/content.model.js';
import mongoose from 'mongoose';

// Create new category
export const createCategory = async (req, res) => {
  try {
    const { name, label } = req.body;
    
    const newCategory = new ContentCategory({ name, label });
    await newCategory.save();
    
    res.status(201).json({
      success: true,
      message: 'Category created successfully',
      data: newCategory
    });
  } catch (error) {
    if (error.code === 11000) {
      return res.status(400).json({ 
        success: false, 
        message: 'Category name already exists' 
      });
    }
    res.status(500).json({ 
      success: false, 
      message: error.message 
    });
  }
};

// Delete category
export const deleteCategory = async (req, res) => {
  try {
    const id = req.params.id;

    const session = await mongoose.startSession();
    session.startTransaction();
    
    try {
      // Delete all items in category
      await ContentItem.deleteMany({ category: id }).session(session);
      
      // Delete category
      const deletedCategory = await ContentCategory.findByIdAndDelete(id).session(session);
      
      if (!deletedCategory) {
        await session.abortTransaction();
        return res.status(404).json({ 
          success: false, 
          message: 'Category not found' 
        });
      }
      
      await session.commitTransaction();
      res.json({ 
        success: true, 
        message: 'Category and all its items deleted successfully' 
      });
    } catch (error) {
      await session.abortTransaction();
      throw error;
    } finally {
      session.endSession();
    }
  } catch (error) {
    res.status(500).json({ 
      success: false, 
      message: error.message 
    });
  }
};

// Get all categories
export const getAllCategories = async (req, res) => {
  try {
    const categories = await ContentCategory.find().sort({ createdAt: -1 });
    res.json({ 
      success: true, 
      data: categories 
    });
  } catch (error) {
    res.status(500).json({ 
      success: false, 
      message: error.message 
    });
  }
};

// Create new item in category
export const createItem = async (req, res) => {
  try {
    const { categoryId, value } = req.body;
    
    // Check if category exists
    const category = await ContentCategory.findById(categoryId);
    if (!category) {
      return res.status(404).json({ 
        success: false, 
        message: 'Category not found' 
      });
    }
    
    // Create new item
    const newItem = new ContentItem({ category: categoryId, value });
    await newItem.save();
    
    res.status(201).json({
      success: true,
      message: 'Item added successfully',
      data: newItem
    });
  } catch (error) {
    if (error.code === 11000) {
      return res.status(400).json({ 
        success: false, 
        message: 'Item already exists in this category' 
      });
    }
    res.status(500).json({ 
      success: false, 
      message: error.message 
    });
  }
};

// Delete item from category
export const deleteItem = async (req, res) => {
  try {
    const { id } = req.params;
    
    const deletedItem = await ContentItem.findByIdAndDelete(id);
    if (!deletedItem) {
      return res.status(404).json({ 
        success: false, 
        message: 'Item not found' 
      });
    }
    
    res.json({ 
      success: true, 
      message: 'Item deleted successfully' 
    });
  } catch (error) {
    res.status(500).json({ 
      success: false, 
      message: error.message 
    });
  }
};

// Get all items in category
export const getItemsByCategory = async (req, res) => {
  try {
    const categoryId = req.params.id;
    
    const items = await ContentItem.find({ category: categoryId }).sort({ createdAt: -1 });
    res.json({ 
      success: true, 
      data: items 
    });
  } catch (error) {
    res.status(500).json({ 
      success: false, 
      message: error.message 
    });
  }
};

// Get content statistics
export const getContentStats = async (req, res) => {
  try {
    const [totalCategories, totalItems] = await Promise.all([
      ContentCategory.countDocuments(),
      ContentItem.countDocuments()
    ]);
    
    res.json({
      success: true,
      data: {
        totalCategories,
        totalItems
      }
    });
  } catch (error) {
    res.status(500).json({ 
      success: false, 
      message: error.message 
    });
  }
};