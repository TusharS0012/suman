import sharp from 'sharp';
import crypto from 'crypto';
import { buildHeader, parseHeader, encryptWithPassphrase, decryptWithPassphrase } from '../utils/cryptoHeader.js';
import { detectImageFormat, compressEncodedImage, createMetricsResponse } from '../utils/imageCompression.js';

/**
 * DWT (Discrete Wavelet Transform) Steganography
 * 
 * This implementation uses Haar wavelet transform:
 * - Applies DWT to decompose image into frequency subbands
 * - Embeds data in high-frequency subbands (HH, HL, LH)
 * - More robust to image processing operations
 */

// Helper functions
function bytesToBits(buf) {
  const bits = [];
  for (let i = 0; i < buf.length; i++) {
    const b = buf[i];
    for (let j = 7; j >= 0; j--) bits.push((b >> j) & 1);
  }
  return bits;
}

function bitsToBytes(bits) {
  const bytes = [];
  for (let i = 0; i < bits.length; i += 8) {
    let val = 0;
    for (let j = 0; j < 8; j++) {
      val = (val << 1) | (bits[i + j] || 0);
    }
    bytes.push(val);
  }
  return Buffer.from(bytes);
}

/**
 * 1D Haar Wavelet Transform (forward)
 * Splits signal into approximation (low-freq) and detail (high-freq) coefficients
 */
function haarDWT1D(signal) {
  const n = signal.length;
  const half = Math.floor(n / 2);
  const approx = new Array(half);
  const detail = new Array(half);
  
  for (let i = 0; i < half; i++) {
    const a = signal[2 * i];
    const b = signal[2 * i + 1] || signal[2 * i]; // Handle odd length
    approx[i] = (a + b) / Math.sqrt(2);
    detail[i] = (a - b) / Math.sqrt(2);
  }
  
  return { approx, detail };
}

/**
 * 1D Haar Wavelet Transform (inverse)
 */
function haarIDWT1D(approx, detail) {
  const n = approx.length;
  const signal = new Array(n * 2);
  
  for (let i = 0; i < n; i++) {
    const a = approx[i];
    const d = detail[i];
    signal[2 * i] = (a + d) / Math.sqrt(2);
    signal[2 * i + 1] = (a - d) / Math.sqrt(2);
  }
  
  return signal;
}

/**
 * 2D Haar DWT - decompose image into 4 subbands: LL, LH, HL, HH
 */
function haarDWT2D(imageData, width, height) {
  const halfWidth = Math.floor(width / 2);
  const halfHeight = Math.floor(height / 2);
  
  const LL = new Array(halfHeight).fill(0).map(() => new Array(halfWidth));
  const LH = new Array(halfHeight).fill(0).map(() => new Array(halfWidth));
  const HL = new Array(halfHeight).fill(0).map(() => new Array(halfWidth));
  const HH = new Array(halfHeight).fill(0).map(() => new Array(halfWidth));
  
  // Apply DWT to rows first
  const tempRows = [];
  for (let y = 0; y < height; y++) {
    const row = [];
    for (let x = 0; x < width; x++) {
      row.push(imageData[y * width + x]);
    }
    const { approx, detail } = haarDWT1D(row);
    tempRows.push({ approx, detail });
  }
  
  // Apply DWT to columns
  for (let x = 0; x < halfWidth; x++) {
    // Process approximation column
    const approxCol = tempRows.map(r => r.approx[x]);
    const { approx: LL_col, detail: LH_col } = haarDWT1D(approxCol);
    
    // Process detail column
    const detailCol = tempRows.map(r => r.detail[x]);
    const { approx: HL_col, detail: HH_col } = haarDWT1D(detailCol);
    
    for (let y = 0; y < halfHeight; y++) {
      LL[y][x] = LL_col[y];
      LH[y][x] = LH_col[y];
      HL[y][x] = HL_col[y];
      HH[y][x] = HH_col[y];
    }
  }
  
  return { LL, LH, HL, HH, halfWidth, halfHeight };
}

/**
 * 2D Haar IDWT - reconstruct image from subbands
 */
function haarIDWT2D(LL, LH, HL, HH, halfWidth, halfHeight) {
  const width = halfWidth * 2;
  const height = halfHeight * 2;
  
  // Reconstruct columns first
  const tempRows = [];
  for (let x = 0; x < halfWidth; x++) {
    // Reconstruct approximation column
    const LL_col = [];
    const LH_col = [];
    for (let y = 0; y < halfHeight; y++) {
      LL_col.push(LL[y][x]);
      LH_col.push(LH[y][x]);
    }
    const approxCol = haarIDWT1D(LL_col, LH_col);
    
    // Reconstruct detail column
    const HL_col = [];
    const HH_col = [];
    for (let y = 0; y < halfHeight; y++) {
      HL_col.push(HL[y][x]);
      HH_col.push(HH[y][x]);
    }
    const detailCol = haarIDWT1D(HL_col, HH_col);
    
    for (let y = 0; y < height; y++) {
      if (!tempRows[y]) tempRows[y] = { approx: [], detail: [] };
      tempRows[y].approx.push(approxCol[y]);
      tempRows[y].detail.push(detailCol[y]);
    }
  }
  
  // Reconstruct rows
  const imageData = [];
  for (let y = 0; y < height; y++) {
    const row = haarIDWT1D(tempRows[y].approx, tempRows[y].detail);
    imageData.push(...row);
  }
  
  return imageData;
}

/**
 * Encode payload using DWT steganography
 */
async function encodeDWT(inputImageBuffer, payloadBuffer, options = {}) {
  const bitsPerChannel = options.bitsPerChannel || 1;
  const encryptOpt = options.encrypt || null;

  // Detect original image format and size
  const originalMetrics = await detectImageFormat(inputImageBuffer);

  // Optional encryption
  let plaintext = Buffer.from(payloadBuffer);
  let headerObj;
  if (encryptOpt && encryptOpt.passphrase) {
    const { ciphertext, salt, iv, authTag } = encryptWithPassphrase(plaintext, encryptOpt.passphrase);
    headerObj = buildHeader({ payloadLength: ciphertext.length, encrypted: true, salt, iv, authTag }, plaintext);
    plaintext = ciphertext;
  } else {
    headerObj = buildHeader({ payloadLength: plaintext.length, encrypted: false }, plaintext);
  }

  const payloadWithHeader = Buffer.concat([headerObj.headerBuffer, plaintext]);
  const payloadBits = bytesToBits(payloadWithHeader);

  // Read image
  const img = sharp(inputImageBuffer);
  const { data, info } = await img.raw().ensureAlpha().toBuffer({ resolveWithObject: true });
  const { width, height, channels } = info;

  // Calculate capacity (using HH subband coefficients)
  const halfWidth = Math.floor(width / 2);
  const halfHeight = Math.floor(height / 2);
  const capacityBits = halfWidth * halfHeight * 3 * bitsPerChannel; // HH subband, RGB channels

  if (payloadBits.length > capacityBits) {
    throw new Error(`Payload (${payloadBits.length} bits) exceeds DWT capacity (${capacityBits} bits).`);
  }

  const modifiedData = Buffer.from(data);
  
  // Process each channel (R, G, B)
  for (let c = 0; c < 3; c++) {
    // Extract channel data
    const channelData = [];
    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        const idx = (y * width + x) * channels + c;
        channelData.push(data[idx]);
      }
    }

    // Apply DWT
    const { LL, LH, HL, HH, halfWidth, halfHeight } = haarDWT2D(channelData, width, height);

    // Embed data in HH subband (high frequency - less perceptible)
    let bitIdx = c * (halfWidth * halfHeight * bitsPerChannel);
    const maxBits = Math.min(payloadBits.length, (c + 1) * (halfWidth * halfHeight * bitsPerChannel));

    for (let y = 0; y < halfHeight && bitIdx < maxBits; y++) {
      for (let x = 0; x < halfWidth && bitIdx < maxBits; x++) {
        if (bitIdx < payloadBits.length) {
          // Embed bit by modifying HH coefficient
          const bit = payloadBits[bitIdx++];
          const coeff = HH[y][x];
          const quantStep = 4; // Quantization step for robustness
          const quantCoeff = Math.round(coeff / quantStep);
          
          // Make quantized coefficient even/odd based on bit value
          if (bit === 0 && quantCoeff % 2 !== 0) {
            HH[y][x] = (quantCoeff - 1) * quantStep;
          } else if (bit === 1 && quantCoeff % 2 === 0) {
            HH[y][x] = (quantCoeff + 1) * quantStep;
          }
        }
      }
    }

    // Apply IDWT
    const modifiedChannelData = haarIDWT2D(LL, LH, HL, HH, halfWidth, halfHeight);

    // Write back to image
    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        const idx = (y * width + x) * channels + c;
        modifiedData[idx] = Math.max(0, Math.min(255, Math.round(modifiedChannelData[y * width + x])));
      }
    }
  }

  // Output with optimized compression
  // Use targetFormat if pre-conversion was applied, otherwise use original format
  const formatToUse = options.targetFormat || originalMetrics.format;
  const quality = options.quality || 90;
  const { buffer: outBuffer, format: outputFormat, metrics: compressionMetrics } = await compressEncodedImage(
    modifiedData,
    { width, height, channels },
    {
      originalFormat: formatToUse,
      quality,
      algorithm: 'dwt',
      originalSize: originalMetrics.size
    }
  );

  const metrics = {
    width,
    height,
    capacityBits,
    usedBits: payloadBits.length,
    bitsPerChannel,
    algorithm: 'DWT',
    outputFormat,
    ...compressionMetrics
  };

  return { stegoBuffer: outBuffer, metrics };
}

/**
 * Decode payload using DWT steganography
 */
async function decodeDWT(stegoImageBuffer, options = {}) {
  const bitsPerChannel = options.bitsPerChannel || 1;
  const passphrase = options.passphrase || null;

  const img = sharp(stegoImageBuffer);
  const { data, info } = await img.raw().ensureAlpha().toBuffer({ resolveWithObject: true });
  const { width, height, channels } = info;

  const halfWidth = Math.floor(width / 2);
  const halfHeight = Math.floor(height / 2);

  // Extract bits from HH subbands
  const extractedBits = [];

  for (let c = 0; c < 3; c++) {
    // Extract channel data
    const channelData = [];
    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        const idx = (y * width + x) * channels + c;
        channelData.push(data[idx]);
      }
    }

    // Apply DWT
    const { HH } = haarDWT2D(channelData, width, height);

    // Extract bits from HH subband
    for (let y = 0; y < halfHeight; y++) {
      for (let x = 0; x < halfWidth; x++) {
        const coeff = HH[y][x];
        const quantStep = 4;
        const quantCoeff = Math.round(coeff / quantStep);
        const bit = quantCoeff % 2;
        extractedBits.push(bit);
      }
    }
  }

  // Parse header
  const headerFixedBytes = 41;
  const headerFixedBits = headerFixedBytes * 8;
  const headerFixedBytesBuf = bitsToBytes(extractedBits.slice(0, headerFixedBits)).slice(0, headerFixedBytes);
  const parsed = parseHeader(headerFixedBytesBuf);
  const totalHeaderBytes = parsed.headerSize;
  const totalHeaderBits = totalHeaderBytes * 8;

  // Parse full header
  const headerBuf = bitsToBytes(extractedBits.slice(0, totalHeaderBits)).slice(0, totalHeaderBytes);
  const header = parseHeader(headerBuf);

  // Extract payload
  const payloadBytes = header.payloadLength;
  const payloadBitsArr = extractedBits.slice(totalHeaderBits, totalHeaderBits + (payloadBytes * 8));
  const payloadBuf = bitsToBytes(payloadBitsArr).slice(0, payloadBytes);

  // Decrypt if needed
  if (header.encrypted) {
    if (!passphrase) throw new Error('Payload is encrypted, passphrase required for decryption.');
    const plaintext = decryptWithPassphrase(payloadBuf, passphrase, header.salt, header.iv, header.authTag);
    const sha = crypto.createHash('sha256').update(plaintext).digest();
    if (!sha.equals(header.sha256)) {
      throw new Error('SHA mismatch after decryption — data corrupted or wrong passphrase.');
    }
    return { payload: plaintext, header, metrics: { width, height, algorithm: 'DWT' } };
  } else {
    const sha = crypto.createHash('sha256').update(payloadBuf).digest();
    if (!sha.equals(header.sha256)) {
      throw new Error('SHA mismatch — data corrupted.');
    }
    return { payload: payloadBuf, header, metrics: { width, height, algorithm: 'DWT' } };
  }
}

export {
  encodeDWT,
  decodeDWT
};
