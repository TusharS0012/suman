import express from 'express';
import multer from 'multer';
import { encodeDCT, decodeDCT } from '../algorithms/dct.js';
import { encodeDWT, decodeDWT } from '../algorithms/dwt.js';
import { encodePVD, decodePVD } from '../algorithms/pvd.js';

// ✅ Added detectImageFormat here
import { handlePreConversion, getMimeTypeFromFormat, detectImageFormat } from '../utils/imageCompression.js';

import { encodeMsHEdgeGrayFT1, decodeMsHEdgeGrayFT1 } from '../algorithms/msHEdgeGrayFT1.js';

const router = express.Router();
const upload = multer();

// ============ DCT Routes ============

// POST /api/dct/encode
router.post('/dct/encode', upload.single('image'), async (req, res) => {
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

    const { stegoBuffer, metrics } = await encodeDCT(imageBuffer, payloadBuffer, opts);
    
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

// POST /api/dct/decode
router.post('/dct/decode', upload.single('image'), async (req, res) => {
  try {
    const imageFile = req.file;
    const bitsPerChannel = parseInt(req.body.bitsPerChannel || '1', 10);
    const passphrase = req.body.passphrase || null;
    if (!imageFile) return res.status(400).json({ error: 'image required' });

    const { payload } = await decodeDCT(imageFile.buffer, { bitsPerChannel, channels: [0,1,2], passphrase });
    res.json({ payload: payload.toString('utf8') });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
});

// ============ DWT Routes ============

// POST /api/dwt/encode
router.post('/dwt/encode', upload.single('image'), async (req, res) => {
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

    const { stegoBuffer, metrics } = await encodeDWT(imageBuffer, payloadBuffer, opts);
    
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

// POST /api/dwt/decode
router.post('/dwt/decode', upload.single('image'), async (req, res) => {
  try {
    const imageFile = req.file;
    const bitsPerChannel = parseInt(req.body.bitsPerChannel || '1', 10);
    const passphrase = req.body.passphrase || null;
    if (!imageFile) return res.status(400).json({ error: 'image required' });

    const { payload } = await decodeDWT(imageFile.buffer, { bitsPerChannel, passphrase });
    res.json({ payload: payload.toString('utf8') });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
});

// ============ PVD Routes ============

// POST /api/pvd/encode
router.post('/pvd/encode', upload.single('image'), async (req, res) => {
  try {
    const imageFile = req.file;
    const payloadText = req.body.payload || '';
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
      threshold: 16,
      targetFormat: outputFormat, // Pass pre-conversion target format
      quality
    };
    if (encryptPass) opts.encrypt = { passphrase: encryptPass };

    const { stegoBuffer, metrics } = await encodePVD(imageBuffer, payloadBuffer, opts);
    
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

// POST /api/pvd/decode
router.post('/pvd/decode', upload.single('image'), async (req, res) => {
  try {
    const imageFile = req.file;
    const passphrase = req.body.passphrase || null;
    if (!imageFile) return res.status(400).json({ error: 'image required' });

    const { payload } = await decodePVD(imageFile.buffer, { passphrase });
    res.json({ payload: payload.toString('utf8') });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
});

// ============ msHEdgeGrayFT1 Routes ============

// POST /api/mshedgegrayft1/encode
router.post('/mshedgegrayft1/encode', upload.single('image'), async (req, res) => {
  try {
    const imageFile = req.file;
    const payloadText = req.body.payload || '';
    const bitsPerChannel = parseInt(req.body.bitsPerChannel || '1', 10); // currently used as 1 bit per pixel
    const encryptPass = req.body.passphrase || null;
    const userOutputFormat = req.body.outputFormat || null; // format requested by frontend
    const quality = parseInt(req.body.quality || '85', 10);

    if (!imageFile) return res.status(400).json({ error: 'image required' });

    // 1) Optional pre-conversion (for avif/webp requests)
    const { buffer: imageBuffer, preConversionMetrics } = await handlePreConversion(
      imageFile.buffer,
      userOutputFormat,
      quality
    );

    // 2) Detect format of the buffer we actually encode
    const detected = await detectImageFormat(imageBuffer);
    const originalFormat = detected.format; // jpeg, png, webp, ...

    // 3) Decide final target format:
    //    - If user requested: use that
    //    - Else: keep original format (to avoid PNG blow-up)
    const targetFormat = userOutputFormat || originalFormat || 'png';

    const payloadBuffer = Buffer.from(payloadText, 'utf8');
    const opts = {
      bitsPerChannel,
      targetFormat,
      quality
    };
    if (encryptPass) opts.encrypt = { passphrase: encryptPass };

    const { stegoBuffer, metrics } = await encodeMsHEdgeGrayFT1(imageBuffer, payloadBuffer, opts);

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

// POST /api/mshedgegrayft1/decode
router.post('/mshedgegrayft1/decode', upload.single('image'), async (req, res) => {
  try {
    const imageFile = req.file;
    const bitsPerChannel = parseInt(req.body.bitsPerChannel || '1', 10);
    const passphrase = req.body.passphrase || null;

    if (!imageFile) return res.status(400).json({ error: 'image required' });

    const { payload } = await decodeMsHEdgeGrayFT1(imageFile.buffer, { bitsPerChannel, passphrase });
    res.json({ payload: payload.toString('utf8') });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
});

export default router;
