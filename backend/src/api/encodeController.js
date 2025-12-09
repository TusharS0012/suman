import express from 'express';
import multer from 'multer';
import { encodeLSB, decodeLSB } from '../algorithms/lsb.js';
import { handlePreConversion, getMimeTypeFromFormat } from '../utils/imageCompression.js';
const router = express.Router();
const upload = multer();

// POST /api/encode
router.post('/encode', upload.single('image'), async (req, res) => {
  try {
    const imageFile = req.file;
    const payloadText = req.body.payload || '';
    const bitsPerChannel = parseInt(req.body.bitsPerChannel || '1', 10);
    const encryptPass = req.body.passphrase || null;
    const outputFormat = req.body.outputFormat || null;
    const quality = parseInt(req.body.quality || '85', 10);

    if (!imageFile) return res.status(400).json({ error: 'image required' });
    
    // Handle optional pre-conversion
    const { buffer: imageBuffer, preConversionMetrics } = await handlePreConversion(
      imageFile.buffer,
      outputFormat,
      quality
    );
    
    const payloadBuffer = Buffer.from(payloadText, 'utf8');
    const opts = { 
      bitsPerChannel, 
      channels: [0, 1, 2],
      targetFormat: outputFormat, // Pass pre-conversion target format
      quality
    };
    if (encryptPass) opts.encrypt = { passphrase: encryptPass };

    const { stegoBuffer, metrics } = await encodeLSB(imageBuffer, payloadBuffer, opts);
    
    // Add pre-conversion metrics if available
    if (preConversionMetrics) {
      metrics.preConversion = preConversionMetrics;
    }
    
    res.json({ 
      imageBase64: stegoBuffer.toString('base64'), 
      mime: getMimeTypeFromFormat(metrics.outputFormat), 
      metrics 
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
});

// POST /api/decode
router.post('/decode', upload.single('image'), async (req, res) => {
  try {
    const imageFile = req.file;
    const bitsPerChannel = parseInt(req.body.bitsPerChannel || '1', 10);
    const passphrase = req.body.passphrase || null;
    if (!imageFile) return res.status(400).json({ error: 'image required' });

    const { payload } = await decodeLSB(imageFile.buffer, { bitsPerChannel, channels: [0,1,2], passphrase });
    res.json({ payload: payload.toString('utf8') });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
});

export default router;