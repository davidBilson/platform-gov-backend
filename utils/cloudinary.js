// Load environment variables
import { v2 as cloudinary } from 'cloudinary';
import fs from 'fs';
import path from 'path';
import dotenv from 'dotenv';
import stream from 'stream'; // Add this import
dotenv.config();

cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET
});

const getResourceType = (filePath) => {
  const extension = path.extname(filePath).toLowerCase();
  
  if (['.jpg', '.jpeg', '.png', '.gif', '.bmp', '.webp', '.svg'].includes(extension)) {
    return 'image';
  }
  else if (['.mp4', '.mov', '.avi', '.webm', '.mkv'].includes(extension)) {
    return 'video';
  }
  else if (['.pdf', '.doc', '.docx', '.xls', '.xlsx', '.ppt', '.pptx', '.txt'].includes(extension)) {
    return 'raw';
  }
  else {
    return 'auto';
  }
};

export const uploadFile = async (fileBuffer, folder = 'uploads', resourceType = null, originalName = 'document') => {
  try {
    // Determine resource type based on file extension
    const getResourceTypeFromName = (filename) => {
      if (!filename) return 'auto';
      const ext = filename.split('.').pop().toLowerCase();
      if (['jpg', 'jpeg', 'png', 'gif', 'webp'].includes(ext)) return 'image';
      if (['mp4', 'mov', 'avi'].includes(ext)) return 'video';
      if (['pdf', 'doc', 'docx', 'xls', 'txt'].includes(ext)) return 'raw';
      return 'auto';
    };

    const type = resourceType || getResourceTypeFromName(originalName);

    return new Promise((resolve, reject) => {
      const uploadStream = cloudinary.uploader.upload_stream(
        {
          folder,
          resource_type: type,
          use_filename: true,
          unique_filename: true,
          overwrite: false
        },
        (error, result) => {
          if (error) {
            console.error('Cloudinary upload error:', error);
            reject(error);
          } else {
            resolve(result);
          }
        }
      );

      // Create a readable stream from buffer
      const bufferStream = new stream.PassThrough();
      bufferStream.end(fileBuffer);
      bufferStream.pipe(uploadStream);
    });
  } catch (error) {
    console.error('Error in uploadFile:', error);
    throw error;
  }
};

// export const uploadImage = async (filePath, folder = 'profiles') => {
//   return uploadFile(filePath, folder, 'image');
// };

// Fix for uploadImage function in utils/cloudinary.js
export const uploadImage = async (filePath, folder = 'profiles') => {
  try {
    // Check if filePath exists and is valid
    if (!filePath || typeof filePath !== 'string') {
      throw new Error(`Invalid file path: ${filePath}`);
    }
    
    // If file doesn't exist, throw error
    if (!fs.existsSync(filePath)) {
      throw new Error(`File does not exist: ${filePath}`);
    }
    
    const resourceType = 'image';
    
    // Upload file to Cloudinary
    const result = await cloudinary.uploader.upload(filePath, {
      folder,
      resource_type: resourceType,
      use_filename: true,
      unique_filename: true,
      overwrite: false
    });
    
    console.log(`Successfully uploaded ${filePath} to Cloudinary`, {
      public_id: result.public_id,
      url: result.secure_url
    });
    
    return result;
  } catch (error) {
    console.error(`Error uploading image to Cloudinary: ${error.message}`, error);
    throw error;
  }
};


export const uploadPDF = async (filePath, folder = 'documents') => {
  return uploadFile(filePath, folder, 'raw');
};


export const deleteFile = async (publicId, resourceType = 'image') => {
  try {
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

export const deleteImage = async (publicId) => {
  return deleteFile(publicId, 'image');
};

export const getPublicIdFromUrl = (url) => {
  if (!url || typeof url !== 'string') return null;
  
  try {
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