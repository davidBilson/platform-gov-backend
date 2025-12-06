import dotenv from 'dotenv';
dotenv.config({ path: './config/.env' });

import cors from 'cors';
import express from 'express';
import path from 'path';
import { fileURLToPath } from 'url';
import routes from './routes/index.js';
import connectDB from './config/database.js';
import { createServer } from 'http';
import { Server } from 'socket.io';
import { setupNotificationWatchers, cleanupWatchers as cleanupNotificationWatchers } from './controllers/notification.controller.js';
import { MessageThread } from './models/messaging.system.model.js';
import { initializeVettingReminderService } from './services/vetting-reminder.service.js';

const app = express();
const PORT = process.env.PORT || 5050;
const MAX_RETRIES = parseInt(process.env.MAX_RETRIES) || 3;
let retryCount = 0;
const RETRY_INTERVAL = parseInt(process.env.RETRY_INTERVAL) || 3000;

// ===== ADDED: Fix for double notification triggers =====
let notificationWatchers = null;
let httpServer = null;
let io = null;
// ===== END ADDITION =====

const allowedOrigins = (process.env.ALLOWED_ORIGINS || '').split(',').map(origin => origin.trim());

app.use(cors({
  origin: (origin, callback) => {
    if (!origin || allowedOrigins.includes(origin)) {
      // if (allowedOrigins.includes(origin)) {
      callback(null, true);
    } else {
      callback(new Error('Not allowed by CORS policy'));
    }
  },
  methods: ["GET", "PUT", "PATCH", "POST", "DELETE", "HEAD"],
  credentials: true,
}));

app.use(express.json());

// Static files
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// Routes
app.use('/api', routes);

app.use((req, res) => {
  res.status(404).json({
    error: 'Route not found',
    path: req.originalUrl
  });
});

// ===== ADDED: Cleanup function for notification watchers =====
const cleanupWatchers = () => {
  try {
    cleanupNotificationWatchers();
    notificationWatchers = null;
  } catch (error) {
    console.error('Error cleaning up notification watchers:', error);
  }
};

const cleanupServer = async () => {
  return new Promise((resolve) => {
    if (httpServer) {
      // Close Socket.IO first
      if (io) {
        io.close(() => {
          console.log('Socket.IO server closed');
        });
        io = null;
      }
      
      httpServer.close(() => {
        console.log('HTTP server closed');
        httpServer = null;
        resolve();
      });
      
      // Force close after 5 seconds
      setTimeout(() => {
        if (io) {
          io.close();
          io = null;
        }
        if (httpServer) {
          httpServer.close();
          httpServer = null;
        }
        resolve();
      }, 5000);
    } else {
      resolve();
    }
  });
};
// ===== END ADDITION =====

const configureSocketIO = (httpServer) => {
  if (io) {
    // Socket.IO already configured, reuse it
    return io;
  }

  io = new Server(httpServer, {
    cors: {
      origin: process.env.FRONTEND_URL,
      methods: ["GET", "POST"],
      credentials: true
    },
    connectionStateRecovery: {
      maxDisconnectionDuration: 2 * 60 * 1000
    }
  });

  io.on('connection', (socket) => {
    // console.log('User connected:', socket.id);
    const userId = socket.handshake.auth.userId;

    socket.on('rejoin-rooms', (rooms) => {
      rooms.forEach(room => {
        socket.join(room);
        // console.log(`User ${userId} rejoined room ${room}`);
      });
    });

    socket.on('error', (error) => {
      console.error('Socket error:', error);
    });

    // Join user's personal room for notifications
    if (userId) {
      socket.join(userId.toString());
      // console.log(`User ${userId} joined their personal notification room`);
    }

    // Room management for chat rooms
    socket.on('join-chat-room', (roomId) => {
      socket.join(roomId);
      // console.log(`User ${userId || socket.id} joined chat room ${roomId}`);
    });

    // Handle marking messages as read
    socket.on('mark-as-read', async ({ threadId, userId }) => {
      try {
        const thread = await MessageThread.findById(threadId);
        if (thread) {
          const otherParticipant = thread.participants.find(
            p => p.toString() !== userId.toString()
          );
          if (otherParticipant) {
            io.to(otherParticipant.toString()).emit('messages-read', {
              threadId,
              userId
            });
          }
        }
      } catch (error) {
        console.error('Error handling mark-as-read:', error);
      }
    });

    // Disconnection handling
    socket.on('disconnect', () => {
      console.log('User disconnected:', userId || socket.id);
    });
  });

  // ===== MODIFIED: Only setup notification watchers if not already done =====
  try {
    if (!notificationWatchers) {
      notificationWatchers = setupNotificationWatchers(io);
    } else {
      console.log('Notification watchers already active');
    }
  } catch (error) {
    console.error('Failed to setup notification watchers:', error);
    // Don't crash the server if notification watchers fail
    // The server can still function without them
  }
  // ===== END MODIFICATION =====

  // Attach io instance to app for use in controllers
  app.set('io', io);
  return io;
};


const startServer = async () => {
  try {
    // Clean up any existing server before starting
    if (httpServer) {
      await cleanupServer();
      // Wait a bit for port to be released
      await new Promise(resolve => setTimeout(resolve, 1000));
    }

    console.log("Connecting to MongoDB...");
    await connectDB();

    // Create HTTP server
    httpServer = createServer(app);

    // Configure Socket.io BEFORE starting server
    configureSocketIO(httpServer);

    // Initialize vetting reminder service (only once)
    if (!process.env.VETTING_SERVICE_INITIALIZED) {
      try {
        initializeVettingReminderService();
        process.env.VETTING_SERVICE_INITIALIZED = 'true';
      } catch (error) {
        console.error('Failed to initialize vetting reminder service:', error);
        // Don't crash the server if vetting service fails to initialize
      }
    }

    // Start HTTP server
    httpServer.listen(PORT, '0.0.0.0', () => {
      console.log(`Server running on port ${PORT}`);
      console.log(`Socket.IO server ready`);
      console.log('Notification watchers initialized');
      retryCount = 0; // Reset retry count on success
    });

    // Error handling
    httpServer.on('error', async (err) => {
      if (err.code === 'EADDRINUSE') {
        console.error(`Port ${PORT} is already in use. ${err.message}`);
        
        // Try to find and kill the process using the port (development only)
        if (process.env.NODE_ENV !== 'production') {
          try {
            const { exec } = await import('child_process');
            const { promisify } = await import('util');
            const execAsync = promisify(exec);
            
            // Find process on port (works on macOS/Linux)
            const { stdout } = await execAsync(`lsof -ti:${PORT}`);
            const pid = stdout.trim();
            if (pid) {
              console.log(`Killing process ${pid} on port ${PORT}...`);
              await execAsync(`kill -9 ${pid}`);
              await new Promise(resolve => setTimeout(resolve, 2000));
            }
          } catch (killError) {
            // Process might not exist or we're on Windows, continue with retry
            console.log('Could not kill existing process, will retry...');
          }
        }
      } else {
        console.error(`Failed to start server: ${err.message}`);
      }

      if (retryCount < MAX_RETRIES) {
        retryCount++;
        console.log(`Retrying to start server (${retryCount}/${MAX_RETRIES}) in ${RETRY_INTERVAL / 1000}s...`);
        await cleanupServer();
        setTimeout(startServer, RETRY_INTERVAL);
      } else {
        console.error('Max retries reached. Server could not start.');
        process.exit(1);
      }
    });

  } catch (error) {
    console.error('Server startup error:', error);
    await cleanupServer();
    if (retryCount < MAX_RETRIES) {
      retryCount++;
      console.log(`Retrying after error (${retryCount}/${MAX_RETRIES}) in ${RETRY_INTERVAL / 1000}s...`);
      setTimeout(startServer, RETRY_INTERVAL);
    } else {
      process.exit(1);
    }
  }
};

// Graceful shutdown handlers
const gracefulShutdown = async (signal) => {
  console.log(`${signal} received, shutting down gracefully...`);
  cleanupWatchers();
  await cleanupServer();
  process.exit(0);
};

// Global error handlers - MUST be set before starting server
process.on('unhandledRejection', (reason, promise) => {
  console.error('Unhandled Rejection at:', promise, 'reason:', reason);
  // Don't exit in production, just log
  if (process.env.NODE_ENV === 'development') {
    console.error('Stack:', reason?.stack);
  }
});

process.on('uncaughtException', (error) => {
  console.error('Uncaught Exception:', error);
  console.error('Stack:', error.stack);
  // For uncaught exceptions, we should exit
  gracefulShutdown('uncaughtException').then(() => {
    process.exit(1);
  });
});

process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
process.on('SIGINT', () => gracefulShutdown('SIGINT'));

// Start the server
startServer();

export default app;