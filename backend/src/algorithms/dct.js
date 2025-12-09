import sharp from 'sharp';
import crypto from 'crypto';
import { buildHeader, parseHeader, encryptWithPassphrase, decryptWithPassphrase } from '../utils/cryptoHeader.js';
import { detectImageFormat, compressEncodedImage, createMetricsResponse } from '../utils/imageCompression.js';

/**
 * DCT (Discrete Cosine Transform) Steganography
 * 
 * This implementation uses a simplified DCT approach:
 * - Divides image into 8x8 blocks
 * - Applies DCT to each block
 * - Embeds data in mid-frequency coefficients
 * - More robust to JPEG compression than LSB
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

// Simplified 1D DCT
function dct1D(values) {
  const N = values.length;
  const result = new Array(N);
  for (let k = 0; k < N; k++) {
    let sum = 0;
    for (let n = 0; n < N; n++) {
      sum += values[n] * Math.cos((Math.PI * k * (2 * n + 1)) / (2 * N));
    }
    const alpha = k === 0 ? Math.sqrt(1 / N) : Math.sqrt(2 / N);
    result[k] = alpha * sum;
  }
  return result;
}

// Simplified 1D IDCT
function idct1D(coeffs) {
  const N = coeffs.length;
  const result = new Array(N);
  for (let n = 0; n < N; n++) {
    let sum = 0;
    for (let k = 0; k < N; k++) {
      const alpha = k === 0 ? Math.sqrt(1 / N) : Math.sqrt(2 / N);
      sum += alpha * coeffs[k] * Math.cos((Math.PI * k * (2 * n + 1)) / (2 * N));
    }
    result[n] = sum;
  }
  return result;
}

// 2D DCT on 8x8 block
function dct2D(block) {
  const size = 8;
  const temp = new Array(size);
  const result = new Array(size);
  
  // DCT on rows
  for (let i = 0; i < size; i++) {
    temp[i] = dct1D(block[i]);
  }
  
  // DCT on columns
  for (let j = 0; j < size; j++) {
    const col = [];
    for (let i = 0; i < size; i++) {
      col.push(temp[i][j]);
    }
    const dctCol = dct1D(col);
    for (let i = 0; i < size; i++) {
      if (!result[i]) result[i] = [];
      result[i][j] = dctCol[i];
    }
  }
  
  return result;
}

// 2D IDCT on 8x8 block
function idct2D(coeffs) {
  const size = 8;
  const temp = new Array(size);
  const result = new Array(size);
  
  // IDCT on columns
  for (let j = 0; j < size; j++) {
    const col = [];
    for (let i = 0; i < size; i++) {
      col.push(coeffs[i][j]);
    }
    const idctCol = idct1D(col);
    for (let i = 0; i < size; i++) {
      if (!temp[i]) temp[i] = [];
      temp[i][j] = idctCol[i];
    }
  }
  
  // IDCT on rows
  for (let i = 0; i < size; i++) {
    result[i] = idct1D(temp[i]);
  }
  
  return result;
}

/**
 * Encode payload using DCT steganography
 */
async function encodeDCT(inputImageBuffer, payloadBuffer, options = {}) {
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

  // Calculate capacity (using mid-frequency coefficients in 8x8 blocks)
  const blockSize = 8;
  const blocksX = Math.floor(width / blockSize);
  const blocksY = Math.floor(height / blockSize);
  const totalBlocks = blocksX * blocksY;
  const coeffsPerBlock = 6; // Using 6 mid-frequency coefficients per block per channel
  const capacityBits = totalBlocks * coeffsPerBlock * 3 * bitsPerChannel; // RGB channels

  if (payloadBits.length > capacityBits) {
    throw new Error(`Payload (${payloadBits.length} bits) exceeds DCT capacity (${capacityBits} bits).`);
  }

  // Process 8x8 blocks and embed data in DCT coefficients
  let bitIdx = 0;
  const modifiedData = Buffer.from(data);

  for (let by = 0; by < blocksY && bitIdx < payloadBits.length; by++) {
    for (let bx = 0; bx < blocksX && bitIdx < payloadBits.length; bx++) {
      // Process each channel (R, G, B)
      for (let c = 0; c < 3 && bitIdx < payloadBits.length; c++) {
        // Extract 8x8 block
        const block = [];
        for (let y = 0; y < blockSize; y++) {
          block[y] = [];
          for (let x = 0; x < blockSize; x++) {
            const px = ((by * blockSize + y) * width + (bx * blockSize + x)) * channels + c;
            block[y][x] = modifiedData[px];
          }
        }

        // Apply DCT
        const dctBlock = dct2D(block);

        // Embed in mid-frequency coefficients (positions chosen for robustness)
        const embedPositions = [[2, 1], [1, 2], [2, 2], [3, 1], [1, 3], [3, 2]];
        
        for (const [row, col] of embedPositions) {
          if (bitIdx >= payloadBits.length) break;
          
          // Embed bit by modifying coefficient
          const bit = payloadBits[bitIdx++];
          const coeff = dctBlock[row][col];
          const quantStep = 8; // Quantization step
          const quantCoeff = Math.round(coeff / quantStep);
          
          // Make coefficient even (for bit=0) or odd (for bit=1)
          // Use Math.abs to handle negative coefficients correctly
          let newQuantCoeff = quantCoeff;
          const absQuantCoeff = Math.abs(quantCoeff);
          const currentParity = absQuantCoeff % 2;
          
          if (bit === 0 && currentParity !== 0) {
            // Want even, have odd - adjust based on sign
            newQuantCoeff = quantCoeff > 0 ? quantCoeff - 1 : quantCoeff + 1;
          } else if (bit === 1 && currentParity === 0) {
            // Want odd, have even - adjust based on sign
            newQuantCoeff = quantCoeff > 0 ? quantCoeff + 1 : quantCoeff - 1;
          }
          // If already correct parity, keep as is
          
          dctBlock[row][col] = newQuantCoeff * quantStep;
        }

        // Apply IDCT
        const modifiedBlock = idct2D(dctBlock);

        // Write back to image
        for (let y = 0; y < blockSize; y++) {
          for (let x = 0; x < blockSize; x++) {
            const px = ((by * blockSize + y) * width + (bx * blockSize + x)) * channels + c;
            modifiedData[px] = Math.max(0, Math.min(255, Math.round(modifiedBlock[y][x])));
          }
        }
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
      algorithm: 'dct',
      originalSize: originalMetrics.size
    }
  );

  const metrics = {
    width,
    height,
    capacityBits,
    usedBits: payloadBits.length,
    bitsPerChannel,
    algorithm: 'DCT',
    outputFormat,
    ...compressionMetrics
  };

  return { stegoBuffer: outBuffer, metrics };
}

/**
 * Decode payload using DCT steganography
 */
async function decodeDCT(stegoImageBuffer, options = {}) {
  const bitsPerChannel = options.bitsPerChannel || 1;
  const passphrase = options.passphrase || null;

  const img = sharp(stegoImageBuffer);
  const { data, info } = await img.raw().ensureAlpha().toBuffer({ resolveWithObject: true });
  const { width, height, channels } = info;

  const blockSize = 8;
  const blocksX = Math.floor(width / blockSize);
  const blocksY = Math.floor(height / blockSize);

  // Extract ALL bits first - we'll parse header to know how many we need
  const extractedBits = [];
  const embedPositions = [[2, 1], [1, 2], [2, 2], [3, 1], [1, 3], [3, 2]];

  // Extract bits in the same order as encoding
  for (let by = 0; by < blocksY; by++) {
    for (let bx = 0; bx < blocksX; bx++) {
      for (let c = 0; c < 3; c++) {
        // Extract 8x8 block
        const block = [];
        for (let y = 0; y < blockSize; y++) {
          block[y] = [];
          for (let x = 0; x < blockSize; x++) {
            const px = ((by * blockSize + y) * width + (bx * blockSize + x)) * channels + c;
            block[y][x] = data[px];
          }
        }

        // Apply DCT
        const dctBlock = dct2D(block);

        // Extract from mid-frequency coefficients
        for (const [row, col] of embedPositions) {
          const coeff = dctBlock[row][col];
          const quantStep = 8;
          const quantCoeff = Math.round(coeff / quantStep);
          // Use absolute value to handle negative coefficients correctly
          const bit = Math.abs(quantCoeff) % 2;
          extractedBits.push(bit);
          
          // Early exit if we have enough for header + reasonable payload
          if (extractedBits.length >= 500000) break; // Safety limit
        }
        if (extractedBits.length >= 500000) break;
      }
      if (extractedBits.length >= 500000) break;
    }
    if (extractedBits.length >= 500000) break;
  }

  // Parse header (first 41 bytes minimum)
  const headerFixedBytes = 41;
  const headerFixedBits = headerFixedBytes * 8;
  
  if (extractedBits.length < headerFixedBits) {
    throw new Error('Not enough data to extract header');
  }

  const headerFixedBytesBuf = bitsToBytes(extractedBits.slice(0, headerFixedBits)).slice(0, headerFixedBytes);
  const parsed = parseHeader(headerFixedBytesBuf);
  const totalHeaderBytes = parsed.headerSize;
  const totalHeaderBits = totalHeaderBytes * 8;

  // Parse full header if needed
  if (extractedBits.length < totalHeaderBits) {
    throw new Error('Not enough data to extract full header');
  }

  const headerBuf = bitsToBytes(extractedBits.slice(0, totalHeaderBits)).slice(0, totalHeaderBytes);
  const header = parseHeader(headerBuf);

  // Extract payload
  const payloadBytes = header.payloadLength;
  const payloadBits = payloadBytes * 8;
  const totalBitsNeeded = totalHeaderBits + payloadBits;

  if (extractedBits.length < totalBitsNeeded) {
    throw new Error(`Not enough data: need ${totalBitsNeeded} bits, have ${extractedBits.length} bits`);
  }

  const payloadBitsArr = extractedBits.slice(totalHeaderBits, totalBitsNeeded);
  const payloadBuf = bitsToBytes(payloadBitsArr).slice(0, payloadBytes);

  // Decrypt if needed
  if (header.encrypted) {
    if (!passphrase) throw new Error('Payload is encrypted, passphrase required for decryption.');
    const plaintext = decryptWithPassphrase(payloadBuf, passphrase, header.salt, header.iv, header.authTag);
    const sha = crypto.createHash('sha256').update(plaintext).digest();
    if (!sha.equals(header.sha256)) {
      throw new Error('SHA mismatch after decryption — data corrupted or wrong passphrase.');
    }
    return { payload: plaintext, header, metrics: { width, height, algorithm: 'DCT' } };
  } else {
    const sha = crypto.createHash('sha256').update(payloadBuf).digest();
    if (!sha.equals(header.sha256)) {
      throw new Error('SHA mismatch — data corrupted.');
    }
    return { payload: payloadBuf, header, metrics: { width, height, algorithm: 'DCT' } };
  }
}

export {
  encodeDCT,
  decodeDCT
};
