import cors from 'cors';
import express from 'express';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import routes from './routes/index.js';
import connectDB from './config/database.js';
import { createServer } from 'http';
import { Server } from 'socket.io';

// Environment configuration
dotenv.config({ path: './config/.env' });

const app = express();
const PORT = process.env.PORT;
const MAX_RETRIES = parseInt(process.env.MAX_RETRIES) || 3;
let retryCount = 0;
const RETRY_INTERVAL = parseInt(process.env.RETRY_INTERVAL) || 3000; // 3 seconds

// Create HTTP server
const httpServer = createServer(app);

// Initialize Socket.io with simplified configuration
const io = new Server(httpServer, {
  cors: {
    origin: process.env.FRONTEND_URL,
    methods: ["GET", "POST"],
    credentials: true
  },
  connectionStateRecovery: {
    maxDisconnectionDuration: 2 * 60 * 1000 // 2 minutes
  }
});

// Configure allowed origins
const allowedOrigins = (process.env.ALLOWED_ORIGINS || '').split(',').map(origin => origin.trim());

// Middlewares
app.use(cors({
  origin: (origin, callback) => {
    if (!origin || allowedOrigins.includes(origin)) {
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

// Socket.io connection handler - Simplified for real-time only
const configureSocketIO = () => {
  io.on('connection', (socket) => {
    console.log('User connected:', socket.id);

    // Error handling
    socket.on('error', (error) => {
      console.error('Socket error:', error);
    });
    
    // Room management for chat rooms based on jobId and proposalId
    socket.on('join-chat-room', (roomId) => {
      socket.join(roomId);
      console.log(`User ${socket.id} joined chat room ${roomId}`);
    });

    // Disconnection handling
    socket.on('disconnect', () => {
      console.log('User disconnected:', socket.id);
    });
  });
};

// Server startup with retry logic
const startServer = async () => {
  try {
    console.log("Connecting to MongoDB...");
    await connectDB();

    // Configure Socket.io
    configureSocketIO();

    // Start HTTP server
    httpServer.listen(PORT, () => {
      console.log(`Server running on port ${PORT}`);
    });

    // Error handling with retries
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
  } catch (error) {
    console.error('Server startup error:', error);
    process.exit(1);
  }
};

// Start the server
startServer();

export default app;