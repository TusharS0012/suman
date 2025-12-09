import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import dotenv from 'dotenv';
import connectDB from './config/index.js';
import steganographyRoutes from './routes/steganography.route.js'; // Fixed import
import errorHandler from './middlewares/error.middleware.js'; // Fixed import
import encodeRouter from './api/encodeController.js';
import algorithmsRouter from './api/algorithmsController.js';

dotenv.config();

const app = express();

// Connect to MongoDB
connectDB();

// Middleware
app.use(cors({
  origin: '*', // Vite's default port
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization']
}));
app.use(helmet());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Health check endpoint
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', message: 'Steganography API is running' });
});

// Routes
app.use('/api/steganography', steganographyRoutes);
app.use('/api', encodeRouter);
app.use('/api', algorithmsRouter);

// Error Handler
app.use(errorHandler);

const PORT = process.env.PORT || 5000;

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});