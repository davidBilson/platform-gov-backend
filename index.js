import cors from 'cors';
import express from 'express';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
// routes
import routes from './routes/index.js'; //default route (second entry points)
// import { notFoundHandler, errorHandler } from './middleware/errorHandlers.middleware.js';
// configs
import connectDB from './config/database.js'; // database connection
dotenv.config({ path: './config/.env' });

const app = express();
const PORT = process.env.PORT;
const MAX_RETRIES = parseInt(process.env.MAX_RETRIES);
let retryCount = 0;
const RETRY_INTERVAL = parseInt(process.env.RETRY_INTERVAL); // 3 seconds

// ALLOWED ORIGINS
const allowedOrigins = (process.env.ALLOWED_ORIGINS || '').split(',').map(origin => origin.trim());

// MIDDLEWARES
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

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

app.use('/uploads', express.static(path.join(__dirname, 'uploads'))); // serve static files from uploads directory

// ROUTES
app.use('/api', routes); //single entry point

// KICKSTART SERVER
async function startServer() {

  try {
    console.log("connecting to mongodb...")
    // connect to mongodb
    await connectDB();

    // start server
    const server = app.listen(PORT);
    server.on('listening', () => {
      console.log(`Server running on port ${PORT}`);
    });
    server.on('error', (err) => {
      console.error(`Failed to start server: ${err.message}`);
  
      if (retryCount < MAX_RETRIES) {
        retryCount++;
        console.log(`Retrying to start server (${retryCount}/${MAX_RETRIES}) in ${RETRY_INTERVAL / 1000}s...`);
        setTimeout(startServer, RETRY_INTERVAL);
      } else {
        console.error(`Max retries reached. Server could not start.`);
        process.exit(1);
      }
    });
  } catch (error) {
    
  }
  
}


startServer();

export default app; //for testing or modularization purposes