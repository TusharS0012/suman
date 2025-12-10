import mongoose from 'mongoose';
import dotenv from 'dotenv';

dotenv.config();

const connectDB = async () => {
  try {
    await mongoose.connect("mongodb+srv://tusharsharma01011_db_user:RcCByvYc8PcNbW6d@cluster0.irtiqia.mongodb.net/?appName=Cluster0", {
    });
    console.log('MongoDB connected successfully');
  } catch (error) {
    console.error('MongoDB connection failed:', error.message);
    process.exit(1);
  }
};

export default connectDB;