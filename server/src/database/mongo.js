import mongoose from 'mongoose';

export async function connectMongo(uri) {
  try {
    await mongoose.connect(uri, {
      bufferCommands: false,
      serverSelectionTimeoutMS: 5000,
    });
  } catch {
    // Driver errors can include connection details.
    throw new Error('MongoDB connection failed. Check MONGODB_URI, database access, and network access.');
  }
}

export async function isMongoReady() {
  if (mongoose.connection.readyState !== 1) return false;

  try {
    await mongoose.connection.db.command({ ping: 1 }, { timeoutMS: 1000 });
    return true;
  } catch {
    return false;
  }
}

export function disconnectMongo() {
  return mongoose.disconnect();
}
