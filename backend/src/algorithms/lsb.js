import sharp from 'sharp';
import crypto from 'crypto';
import { buildHeader, parseHeader, encryptWithPassphrase, decryptWithPassphrase } from '../utils/cryptoHeader.js';
import { detectImageFormat, compressEncodedImage, createMetricsResponse } from '../utils/imageCompression.js';

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
 * Encode payload into PNG/JPEG image buffer using LSB embedding in RGB channels.
 * Input image is decoded with sharp into raw RGBA pixels; output is PNG buffer.
 * Options:
 *  - bitsPerChannel (1..3)
 *  - channels: array of channel indices [0=R,1=G,2=B]
 *  - encrypt: { passphrase: '...' } optional
 */
async function encodeLSB(inputImageBuffer, payloadBuffer, options = {}) {
  const bitsPerChannel = options.bitsPerChannel || 1;
  const channels = options.channels || [0, 1, 2];
  const encryptOpt = options.encrypt || null;

  // Detect original image format and size
  const originalMetrics = await detectImageFormat(inputImageBuffer);

  // optional encryption
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

  // read image raw pixels
  const img = sharp(inputImageBuffer);
  const { data, info } = await img.raw().ensureAlpha().toBuffer({ resolveWithObject: true });
  const { width, height, channels: ch } = info; // ch is 4 because ensureAlpha

  const pixelCount = width * height;
  const capacityBits = pixelCount * channels.length * bitsPerChannel;
  const payloadBits = bytesToBits(payloadWithHeader);

  if (payloadBits.length > capacityBits) {
    throw new Error(`Payload (${payloadBits.length} bits) exceeds capacity (${capacityBits} bits).`);
  }

  // Modify pixels in place (data is Buffer/Uint8Array)
  let bitIdx = 0;
  for (let px = 0; px < pixelCount && bitIdx < payloadBits.length; px++) {
    const base = px * ch;
    for (const c of channels) {
      if (bitIdx >= payloadBits.length) break;
      // gather next bitsPerChannel bits into value
      let val = 0;
      for (let b = 0; b < bitsPerChannel; b++) {
        val = (val << 1) | (payloadBits[bitIdx++] || 0);
      }
      const mask = (1 << bitsPerChannel) - 1;
      data[base + c] = (data[base + c] & ~mask) | val;
    }
    // skip alpha channel (base + 3)
  }

  // compose PNG output (lossless to preserve embedded bits)
  // Apply optimized compression
  // Use targetFormat if pre-conversion was applied, otherwise use original format
  const formatToUse = options.targetFormat || originalMetrics.format;
  const quality = options.quality || 85;
  const { buffer: outBuffer, format: outputFormat, metrics: compressionMetrics } = await compressEncodedImage(
    data,
    { width, height, channels: ch },
    {
      originalFormat: formatToUse,
      quality,
      algorithm: 'lsb',
      originalSize: originalMetrics.size
    }
  );

  // metrics: simple capacity and used bits
  const metrics = {
    width,
    height,
    capacityBits,
    usedBits: payloadBits.length,
    bitsPerChannel,
    outputFormat,
    ...compressionMetrics
  };
  return { stegoBuffer: outBuffer, metrics };
}

/**
 * Decode LSB payload from an image buffer.
 * Must match the parameters used during encode (bitsPerChannel, channels).
 * If header indicates encryption, pass passphrase in options to decrypt.
 */
async function decodeLSB(stegoImageBuffer, options = {}) {
  const bitsPerChannel = options.bitsPerChannel || 1;
  const channels = options.channels || [0, 1, 2];
  const passphrase = options.passphrase || null;

  const img = sharp(stegoImageBuffer);
  const { data, info } = await img.raw().ensureAlpha().toBuffer({ resolveWithObject: true });
  const { width, height, channels: ch } = info;
  const pixelCount = width * height;

  // Extract enough bits for header + reasonable payload
  // First, extract bits for minimum header (41 bytes = 328 bits)
  const headerFixedBytes = 41;
  const headerFixedBits = headerFixedBytes * 8;
  const extractedBits = [];
  
  // Extract bits in order
  for (let px = 0; px < pixelCount; px++) {
    const base = px * ch;
    for (const c of channels) {
      for (let b = 0; b < bitsPerChannel; b++) {
        extractedBits.push((data[base + c] >> (bitsPerChannel - 1 - b)) & 1);
        // Early exit once we have enough for header + max reasonable payload
        if (extractedBits.length >= 1000000) break; // Safety limit: ~125KB
      }
      if (extractedBits.length >= 1000000) break;
    }
    if (extractedBits.length >= 1000000) break;
  }

  // Parse header to determine size
  if (extractedBits.length < headerFixedBits) {
    throw new Error('Not enough data to extract header');
  }

  const headerFixedBytesBuf = bitsToBytes(extractedBits.slice(0, headerFixedBits)).slice(0, headerFixedBytes);
  const parsed = parseHeader(headerFixedBytesBuf);
  const totalHeaderBytes = parsed.headerSize;
  const totalHeaderBits = totalHeaderBytes * 8;

  // Ensure we have enough bits for full header
  if (extractedBits.length < totalHeaderBits) {
    throw new Error(`Not enough data: need ${totalHeaderBits} bits for header, have ${extractedBits.length} bits`);
  }

  // Parse full header
  const headerBuf = bitsToBytes(extractedBits.slice(0, totalHeaderBits)).slice(0, totalHeaderBytes);
  const header = parseHeader(headerBuf);

  // Extract payload
  const payloadBytes = header.payloadLength;
  const payloadBits = payloadBytes * 8;
  const totalBitsNeeded = totalHeaderBits + payloadBits;

  if (extractedBits.length < totalBitsNeeded) {
    throw new Error(`Not enough data: need ${totalBitsNeeded} bits total, have ${extractedBits.length} bits`);
  }

  const payloadBitsArr = extractedBits.slice(totalHeaderBits, totalBitsNeeded);
  const payloadBuf = bitsToBytes(payloadBitsArr).slice(0, payloadBytes);

  if (header.encrypted) {
    if (!passphrase) throw new Error('Payload is encrypted, passphrase required for decryption.');
    const plaintext = decryptWithPassphrase(payloadBuf, passphrase, header.salt, header.iv, header.authTag);
    const sha = crypto.createHash('sha256').update(plaintext).digest();
    if (!sha.equals(header.sha256)) {
      throw new Error('SHA mismatch after decryption — data corrupted or wrong passphrase.');
    }
    return { payload: plaintext, header, metrics: { width, height } };
  } else {
    const sha = crypto.createHash('sha256').update(payloadBuf).digest();
    if (!sha.equals(header.sha256)) {
      throw new Error('SHA mismatch — data corrupted.');
    }
    return { payload: payloadBuf, header, metrics: { width, height } };
  }
}

export {
  encodeLSB,
  decodeLSB
};