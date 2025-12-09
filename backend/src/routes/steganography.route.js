import express from 'express';
import steganographyController from '../controllers/steganography.controller.js';
import { upload } from '../middlewares/upload.middleware.js';

const router = express.Router();

// Define routes for steganography operations
router.post('/encode', upload.single('image'), steganographyController.encodeImage);
router.post('/decode', upload.single('image'), steganographyController.decodeImage);

export default router;