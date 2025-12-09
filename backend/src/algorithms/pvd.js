import sharp from 'sharp';
import crypto from 'crypto';
import { buildHeader, parseHeader, encryptWithPassphrase, decryptWithPassphrase } from '../utils/cryptoHeader.js';
import { detectImageFormat, compressEncodedImage, createMetricsResponse } from '../utils/imageCompression.js';

/**
 * PVD (Pixel Value Differencing) Steganography
 * 
 * This implementation uses PVD technique:
 * - Works on pixel pairs
 * - Embeds data based on difference between adjacent pixels
 * - Variable capacity based on pixel difference magnitude
 * - More resistant to statistical analysis
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
 * Get range width based on pixel difference
 * Uses quantization ranges for variable capacity
 */
function getRangeInfo(diff) {
  const absDiff = Math.abs(diff);
  
  // Define ranges: [start, end, capacity_bits]
  const ranges = [
    [0, 7, 3],      // Small difference: 3 bits
    [8, 15, 3],
    [16, 31, 4],    // Medium difference: 4 bits
    [32, 63, 5],    // Larger difference: 5 bits
    [64, 127, 6],
    [128, 255, 7]   // Large difference: 7 bits
  ];
  
  for (const [start, end, bits] of ranges) {
    if (absDiff >= start && absDiff <= end) {
      return { start, end, bits, width: end - start + 1 };
    }
  }
  
  return { start: 0, end: 7, bits: 3, width: 8 };
}

/**
 * Embed data in pixel pair using PVD
 */
function embedInPair(p1, p2, dataBits) {
  const origDiff = p2 - p1;
  const rangeInfo = getRangeInfo(origDiff);
  const { start, bits: capacity } = rangeInfo;
  
  // How many bits can we embed?
  const bitsToEmbed = Math.min(capacity, dataBits.length);
  if (bitsToEmbed === 0) return { p1, p2, bitsUsed: 0 };
  
  // Convert bits to decimal value
  let dataValue = 0;
  for (let i = 0; i < bitsToEmbed; i++) {
    dataValue = (dataValue << 1) | (dataBits[i] || 0);
  }
  
  // Calculate new difference
  const newDiff = start + dataValue;
  
  // Adjust pixels to achieve new difference
  let newP1 = p1;
  let newP2 = p2;
  
  const diffChange = newDiff - Math.abs(origDiff);
  
  if (origDiff >= 0) {
    // p2 >= p1
    newP2 = p2 + Math.floor(diffChange / 2);
    newP1 = p1 - Math.ceil(diffChange / 2);
  } else {
    // p2 < p1
    newP1 = p1 + Math.floor(diffChange / 2);
    newP2 = p2 - Math.ceil(diffChange / 2);
  }
  
  // Ensure pixels stay in valid range [0, 255]
  newP1 = Math.max(0, Math.min(255, newP1));
  newP2 = Math.max(0, Math.min(255, newP2));
  
  return { p1: newP1, p2: newP2, bitsUsed: bitsToEmbed };
}

/**
 * Extract data from pixel pair using PVD
 */
function extractFromPair(p1, p2) {
  const diff = p2 - p1;
  const rangeInfo = getRangeInfo(diff);
  const { start, bits: capacity } = rangeInfo;
  
  const absDiff = Math.abs(diff);
  const dataValue = absDiff - start;
  
  // Convert value to bits
  const bits = [];
  for (let i = capacity - 1; i >= 0; i--) {
    bits.push((dataValue >> i) & 1);
  }
  
  return bits;
}

/**
 * Encode payload using PVD steganography
 */
async function encodePVD(inputImageBuffer, payloadBuffer, options = {}) {
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

  const modifiedData = Buffer.from(data);
  let bitIdx = 0;
  let totalCapacity = 0;

  // Process pixel pairs horizontally
  for (let c = 0; c < 3 && bitIdx < payloadBits.length; c++) { // RGB channels
    for (let y = 0; y < height && bitIdx < payloadBits.length; y++) {
      for (let x = 0; x < width - 1 && bitIdx < payloadBits.length; x += 2) {
        const idx1 = (y * width + x) * channels + c;
        const idx2 = (y * width + x + 1) * channels + c;
        
        const p1 = data[idx1];
        const p2 = data[idx2];
        
        // Determine capacity for this pair
        const rangeInfo = getRangeInfo(p2 - p1);
        totalCapacity += rangeInfo.bits;
        
        // Get bits to embed
        const bitsForThisPair = payloadBits.slice(bitIdx, bitIdx + rangeInfo.bits);
        
        // Embed bits in pair
        const { p1: newP1, p2: newP2, bitsUsed } = embedInPair(p1, p2, bitsForThisPair);
        
        modifiedData[idx1] = newP1;
        modifiedData[idx2] = newP2;
        
        bitIdx += bitsUsed;
      }
    }
  }

  if (bitIdx < payloadBits.length) {
    throw new Error(`Payload (${payloadBits.length} bits) exceeds PVD capacity (${totalCapacity} bits).`);
  }

  // Output with optimized compression
  // Use targetFormat if pre-conversion was applied, otherwise use original format
  const formatToUse = options.targetFormat || originalMetrics.format;
  const quality = options.quality || 85;
  const { buffer: outBuffer, format: outputFormat, metrics: compressionMetrics } = await compressEncodedImage(
    modifiedData,
    { width, height, channels },
    {
      originalFormat: formatToUse,
      quality,
      algorithm: 'pvd',
      originalSize: originalMetrics.size
    }
  );

  const metrics = {
    width,
    height,
    capacityBits: totalCapacity,
    usedBits: bitIdx,
    algorithm: 'PVD',
    outputFormat,
    ...compressionMetrics
  };

  return { stegoBuffer: outBuffer, metrics };
}

/**
 * Decode payload using PVD steganography
 */
async function decodePVD(stegoImageBuffer, options = {}) {
  const passphrase = options.passphrase || null;

  const img = sharp(stegoImageBuffer);
  const { data, info } = await img.raw().ensureAlpha().toBuffer({ resolveWithObject: true });
  const { width, height, channels } = info;

  const extractedBits = [];

  // Extract bits from pixel pairs
  for (let c = 0; c < 3; c++) { // RGB channels
    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width - 1; x += 2) {
        const idx1 = (y * width + x) * channels + c;
        const idx2 = (y * width + x + 1) * channels + c;
        
        const p1 = data[idx1];
        const p2 = data[idx2];
        
        // Extract bits from this pair
        const bits = extractFromPair(p1, p2);
        extractedBits.push(...bits);
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
    return { payload: plaintext, header, metrics: { width, height, algorithm: 'PVD' } };
  } else {
    const sha = crypto.createHash('sha256').update(payloadBuf).digest();
    if (!sha.equals(header.sha256)) {
      throw new Error('SHA mismatch — data corrupted.');
    }
    return { payload: payloadBuf, header, metrics: { width, height, algorithm: 'PVD' } };
  }
}

export {
  encodePVD,
  decodePVD
};
