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
 * Determines resource type based on file extension
 * @param {string} filePath - Path to the file
 * @returns {string} - Cloudinary resource type ('image', 'raw', 'video', 'auto')
 */
const getResourceType = (filePath) => {
  const extension = path.extname(filePath).toLowerCase();
  
  // Image formats
  if (['.jpg', '.jpeg', '.png', '.gif', '.bmp', '.webp', '.svg'].includes(extension)) {
    return 'image';
  }
  // Video formats
  else if (['.mp4', '.mov', '.avi', '.webm', '.mkv'].includes(extension)) {
    return 'video';
  }
  // PDF and document formats (handled as 'raw' in Cloudinary)
  else if (['.pdf', '.doc', '.docx', '.xls', '.xlsx', '.ppt', '.pptx', '.txt'].includes(extension)) {
    return 'raw';
  }
  // For any other format, use 'auto' to let Cloudinary determine the type
  else {
    return 'auto';
  }
};

/**
 * Uploads a file to Cloudinary from a local file path
 * @param {string} filePath - Path to the temporary file
 * @param {string} folder - Cloudinary folder to upload to
 * @param {string} [resourceType] - Optional resource type override
 * @returns {Promise<object>} - Upload result with secure_url
 */
export const uploadFile = async (filePath, folder = 'uploads', resourceType = null) => {
  try {
    // Check if file exists before attempting upload
    if (!fs.existsSync(filePath)) {
      throw new Error('File does not exist');
    }

    // Determine resource type if not explicitly provided
    const type = resourceType || getResourceType(filePath);
    
    const uploadResult = await cloudinary.uploader.upload(filePath, {
      folder: folder,
      resource_type: type,
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
 * Legacy function maintained for backward compatibility
 * @param {string} filePath - Path to the temporary image file
 * @param {string} folder - Cloudinary folder to upload to
 * @returns {Promise<object>} - Upload result with secure_url
 */
export const uploadImage = async (filePath, folder = 'profiles') => {
  return uploadFile(filePath, folder, 'image');
};

/**
 * Uploads a PDF document to Cloudinary
 * @param {string} filePath - Path to the temporary PDF file
 * @param {string} folder - Cloudinary folder to upload to
 * @returns {Promise<object>} - Upload result with secure_url
 */
export const uploadPDF = async (filePath, folder = 'documents') => {
  return uploadFile(filePath, folder, 'raw');
};

/**
 * Deletes a file from Cloudinary by public_id
 * @param {string} publicId - Cloudinary public_id of the file
 * @param {string} [resourceType='image'] - Resource type (image, raw, video)
 * @returns {Promise<object>} - Deletion result
 */
export const deleteFile = async (publicId, resourceType = 'image') => {
  try {
    // Check if publicId is provided
    if (!publicId) {
      throw new Error('Public ID is required for deletion');
    }
    
    const result = await cloudinary.uploader.destroy(publicId, { 
      resource_type: resourceType
    });
    
    return result;
  } catch (error) {
    console.error('Cloudinary delete error:', error);
    throw error;
  }
};

/**
 * Legacy function maintained for backward compatibility
 * @param {string} publicId - Cloudinary public_id of the image
 * @returns {Promise<object>} - Deletion result
 */
export const deleteImage = async (publicId) => {
  return deleteFile(publicId, 'image');
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

/**
 * Extracts resource type and file format from a Cloudinary URL
 * @param {string} url - Cloudinary URL
 * @returns {object|null} - Object containing resourceType and format, or null if not found
 */
export const getFileInfoFromUrl = (url) => {
  if (!url || typeof url !== 'string') return null;
  
  try {
    // Extract resource type based on URL pattern
    let resourceType = 'image'; // Default
    
    if (url.includes('/image/')) {
      resourceType = 'image';
    } else if (url.includes('/video/')) {
      resourceType = 'video';
    } else if (url.includes('/raw/')) {
      resourceType = 'raw';
    }
    
    // Extract file format
    const formatMatch = url.match(/\.([a-zA-Z0-9]+)(?:\?|$)/);
    const format = formatMatch ? formatMatch[1] : null;
    
    return {
      resourceType,
      format
    };
  } catch (error) {
    console.error('Error extracting file info:', error);
    return null;
  }
};