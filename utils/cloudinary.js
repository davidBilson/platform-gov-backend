// Load environment variables
import { v2 as cloudinary } from 'cloudinary';
import fs from 'fs';
import path from 'path';
import dotenv from 'dotenv';

dotenv.config();

// Configure Cloudinary with your credentials
cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET
});

/**
 * Uploads an image to Cloudinary from a local file path
 * @param {string} filePath - Path to the temporary file
 * @param {string} folder - Cloudinary folder to upload to
 * @returns {Promise<object>} - Upload result with secure_url
 */
export const uploadImage = async (filePath, folder = 'profiles') => {
  try {
    // Check if file exists before attempting upload
    if (!fs.existsSync(filePath)) {
      throw new Error('File does not exist');
    }

    const uploadResult = await cloudinary.uploader.upload(filePath, {
      folder: folder,
      resource_type: 'image',
      use_filename: true,
      unique_filename: true,
      overwrite: false,
      timeout: 60000, // 60 seconds timeout
    });

    // Clean up the temporary file after successful upload
    try {
      fs.unlinkSync(filePath);
    } catch (err) {
      console.error('Error removing temporary file:', err);
      // Continue execution even if temp file deletion fails
    }

    return uploadResult;
  } catch (error) {
    console.error('Cloudinary upload error:', error);
    throw error;
  }
};

/**
 * Deletes an image from Cloudinary by public_id
 * @param {string} publicId - Cloudinary public_id of the image
 * @returns {Promise<object>} - Deletion result
 */
export const deleteImage = async (publicId) => {
  try {
    // Check if publicId is provided
    if (!publicId) {
      throw new Error('Public ID is required for deletion');
    }

    const result = await cloudinary.uploader.destroy(publicId);
    return result;
  } catch (error) {
    console.error('Cloudinary delete error:', error);
    throw error;
  }
};

/**
 * Extracts public_id from a Cloudinary URL
 * @param {string} url - Cloudinary URL
 * @returns {string|null} - public_id or null if not found
 */
export const getPublicIdFromUrl = (url) => {
  if (!url || typeof url !== 'string') return null;
  
  try {
    // Match pattern for Cloudinary URLs
    const regex = /\/v\d+\/(.+?)(?:\.\w+)?$/;
    const match = url.match(regex);
    
    if (match && match[1]) {
      return match[1];
    }
    return null;
  } catch (error) {
    console.error('Error extracting public_id:', error);
    return null;
  }
};