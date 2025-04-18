// middleware/errorHandlers.js

// Error handling for invalid routes
export const notFoundHandler = (req, res) => {
    res.status(404).json({
      success: false,
      message: 'API endpoint not found'
    });
  };
  
  // Error handling middleware
  export const errorHandler = (err, req, res) => {
    console.error(err.stack);
    res.status(500).json({
      success: false,
      message: 'Server error',
      error: process.env.NODE_ENV === 'production' ? 'Internal server error' : err.message
    });
  };