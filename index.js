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
import { setupNotificationWatchers } from './controllers/notification.controller.js';
import { MessageThread } from './models/messaging.system.model.js';

const app = express();
const PORT = process.env.PORT;
const MAX_RETRIES = parseInt(process.env.MAX_RETRIES) || 3;
let retryCount = 0;
const RETRY_INTERVAL = parseInt(process.env.RETRY_INTERVAL) || 3000;

// ===== ADDED: Fix for double notification triggers =====
let notificationWatchers = null;
// ===== END ADDITION =====

const httpServer = createServer(app);

const io = new Server(httpServer, {
  cors: {
    origin: process.env.FRONTEND_URL,
    methods: ["GET", "POST"],
    credentials: true
  },
  connectionStateRecovery: {
    maxDisconnectionDuration: 2 * 60 * 1000
  }
});

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

// Make io instance available in routes
app.set('io', io);

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
  if (notificationWatchers) {
    console.log('Cleaning up notification watchers...');
    if (typeof notificationWatchers.cleanup === 'function') {
      notificationWatchers.cleanup();
    }
    notificationWatchers = null;
  }
};
// ===== END ADDITION =====

const configureSocketIO = () => {
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
  if (!notificationWatchers) {
    console.log('Setting up notification watchers...');
    notificationWatchers = setupNotificationWatchers(io);
  } else {
    console.log('Notification watchers already initialized, skipping setup');
  }
  // ===== END MODIFICATION =====
  
  // Attach io instance to app for use in controllers
  app.set('io', io);
};


const startServer = async () => {
  try {
    console.log("Connecting to MongoDB...");
    await connectDB();

    // Configure Socket.io BEFORE starting server
    configureSocketIO();

    // Start HTTP server
    httpServer.listen(PORT, '0.0.0.0',() => {
      console.log(`Server running on port ${PORT}`);
      console.log(`Socket.IO server ready`);
      console.log('Notification watchers initialized');
    });

    // Error handling
    httpServer.on('error', (err) => {
      console.error(`Failed to start server: ${err.message}`);
      if (retryCount < MAX_RETRIES) {
        retryCount++;
        console.log(`Retrying to start server (${retryCount}/${MAX_RETRIES}) in ${RETRY_INTERVAL / 1000}s...`);
        setTimeout(startServer, RETRY_INTERVAL);
      } else {
        console.error('Max retries reached. Server could not start.');
        process.exit(1);
      }
    });

    // Graceful shutdown
    process.on('SIGTERM', () => {
      console.log('SIGTERM received, shutting down gracefully');
      cleanupWatchers();
      httpServer.close(() => {
        console.log('Process terminated');
      });
    });

  } catch (error) {
    console.error('Server startup error:', error);
    process.exit(1);
  }
};

// Start the server
startServer();

export default app;