import mongoose from 'mongoose';

const imageSchema = new mongoose.Schema({
  originalName: {
    type: String,
    required: true
  },
  encodedImage: {
    type: String,
    required: true
  },
  message: {
    type: String,
    required: true
  },
  createdAt: {
    type: Date,
    default: Date.now
  }
});

export default mongoose.model('Image', imageSchema);