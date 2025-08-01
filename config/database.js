import mongoose from 'mongoose';


const connectDB = async () => {
  const MAX_DB_CONN_RETRIES = parseInt(process.env.MAX_DB_CONN_RETRIES);
  const DB_CONN_RETRY_INTERVAL = parseInt(process.env.DB_CONN_RETRY_INTERVAL);
  let retries = 0;

  const connect = async () => {
    try {
      
      const MONGODB_URI = process.env.MONGODB_URI;

      if (!MONGODB_URI) {
        console.error('MONGO_URI is not defined in environment variables');
        throw new Error('MONGO_URI is undefined')
      }

      const conn = await mongoose.connect(MONGODB_URI);

      console.log(`MongoDB Connected: ${conn.connection.host}`);
      return true;
    } catch (error) {
      console.error(`MongoDB connection error: ${error.message}`);

      if (retries < MAX_DB_CONN_RETRIES) {
        retries++;
        console.log(`Retrying database connection (${retries}/${MAX_DB_CONN_RETRIES}) in ${DB_CONN_RETRY_INTERVAL / 1000}s...`);

        await new Promise(resolve => setTimeout(resolve, DB_CONN_RETRY_INTERVAL));
        return connect();
      } else {
        console.error('Max retries reached. Database connection failed.');
        process.exit(1);
      }
    }
  };

  return connect();
};

// Set up mongoose event handlers
mongoose.connection.on('disconnected', () => {
  console.log('MongoDB disconnected');
});

mongoose.connection.on('error', (err) => {
  console.error(`MongoDB connection error: ${err.message}`);
});

// Handle application termination
process.on('SIGINT', async () => {
  await mongoose.connection.close();
  console.log('MongoDB connection closed due to app termination');
  process.exit(0);
});

export default connectDB;