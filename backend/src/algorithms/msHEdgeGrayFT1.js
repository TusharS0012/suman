// algorithms/msHEdgeGrayFT1.js
import sharp from 'sharp';
import crypto from 'crypto';

// ========== Small crypto helpers (optional encryption) ==========

function deriveKey(passphrase) {
  return crypto.createHash('sha256').update(String(passphrase)).digest();
}

function encryptPayload(buf, passphrase) {
  const key = deriveKey(passphrase);
  const iv = crypto.randomBytes(16);
  const cipher = crypto.createCipheriv('aes-256-cbc', key, iv);
  const enc = Buffer.concat([cipher.update(buf), cipher.final()]);
  // store iv + ciphertext
  return Buffer.concat([iv, enc]);
}

function decryptPayload(buf, passphrase) {
  const key = deriveKey(passphrase);
  const iv = buf.subarray(0, 16);
  const data = buf.subarray(16);
  const decipher = crypto.createDecipheriv('aes-256-cbc', key, iv);
  return Buffer.concat([decipher.update(data), decipher.final()]);
}

// ========== Fuzzy edge detector (msHEdgeGrayFT1-style) ==========

function trimf(x, a, b, c) {
  if (x <= a || x >= c) return 0;
  if (x === b) return 1;
  if (x < b) return (x - a) / (b - a || 1e-9);
  return (c - x) / (c - b || 1e-9);
}

// Fuzzify a difference value into LOW/MED/HIGH memberships
function fuzzifyDiff(d) {
  const low = trimf(d, 0, 0, 40);
  const med = trimf(d, 20, 80, 140);
  const high = trimf(d, 100, 255, 255);
  return { low, med, high };
}

function fuzzyEdgeStrength(diffRow, diffCol) {
  // Sugeno-like FIS per pixel
  const rulesOutput = [0.0, 0.4, 0.6, 1.0];

  const n = diffRow.length;
  const edgeStrength = new Float32Array(n);

  for (let i = 0; i < n; i++) {
    const fr = fuzzifyDiff(diffRow[i]);
    const fc = fuzzifyDiff(diffCol[i]);

    const strengths = new Float32Array(4);

    // Rule 1: row LOW & col LOW -> 0.0
    strengths[0] = Math.min(fr.low, fc.low);

    // Rule 2: (row MED & col LOW) or (row LOW & col MED) -> 0.4
    const r2a = Math.min(fr.med, fc.low);
    const r2b = Math.min(fr.low, fc.med);
    strengths[1] = Math.max(r2a, r2b);

    // Rule 3: row MED & col MED -> 0.6
    strengths[2] = Math.min(fr.med, fc.med);

    // Rule 4: row HIGH or col HIGH -> 1.0
    strengths[3] = Math.max(fr.high, fc.high);

    let num = 0;
    let den = 0;
    for (let r = 0; r < 4; r++) {
      num += strengths[r] * rulesOutput[r];
      den += strengths[r];
    }
    edgeStrength[i] = den > 0 ? num / den : 0;
  }

  return edgeStrength;
}

// basic 3x3 box blur (cheap approximation of Gaussian)
function boxBlurGray(gray, width, height) {
  const out = new Float32Array(gray.length);
  const kernel = [
    [1, 1, 1],
    [1, 1, 1],
    [1, 1, 1]
  ];
  const kSum = 9;

  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      let acc = 0;
      for (let ky = -1; ky <= 1; ky++) {
        for (let kx = -1; kx <= 1; kx++) {
          const ny = y + ky;
          const nx = x + kx;
          if (nx < 0 || ny < 0 || nx >= width || ny >= height) continue;
          acc += gray[ny * width + nx] * kernel[ky + 1][kx + 1];
        }
      }
      out[y * width + x] = acc / kSum;
    }
  }
  return out;
}

async function computeEdgeMask(buffer, edgeThreshold = 0.6) {
  const { data, info } = await sharp(buffer)
    .ensureAlpha(false)
    .raw()
    .toBuffer({ resolveWithObject: true });
  const { width, height, channels } = info; // expect 3 (RGB) or 4

  // 1. grayscale
  const gray = new Float32Array(width * height);
  for (let i = 0, p = 0; i < data.length; i += channels, p++) {
    const r = data[i];
    const g = data[i + 1];
    const b = data[i + 2];
    gray[p] = 0.299 * r + 0.587 * g + 0.114 * b;
  }

  // 2. blur
  const blurred = boxBlurGray(gray, width, height);

  // 3. diffRow & diffCol
  const diffRow = new Float32Array(width * height);
  const diffCol = new Float32Array(width * height);

  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const idx = y * width + x;
      if (x < width - 1) {
        const right = y * width + (x + 1);
        diffRow[idx] = Math.abs(blurred[right] - blurred[idx]);
      } else {
        diffRow[idx] = 0;
      }
      if (y < height - 1) {
        const down = (y + 1) * width + x;
        diffCol[idx] = Math.abs(blurred[down] - blurred[idx]);
      } else {
        diffCol[idx] = 0;
      }
    }
  }

  // 4. fuzzy edge strength
  const edgeStrength = fuzzyEdgeStrength(diffRow, diffCol);

  // 5. threshold to get edge mask
  const edgeMask = new Uint8Array(width * height);
  const edgeIndices = [];
  for (let i = 0; i < edgeStrength.length; i++) {
    if (edgeStrength[i] >= edgeThreshold) {
      edgeMask[i] = 1;
      edgeIndices.push(i);
    }
  }

  return { edgeMask, edgeIndices, width, height, channels, rawData: data };
}

// ========== Bit helpers ==========

function bitsFromBuffer(buf) {
  const bits = [];
  for (let i = 0; i < buf.length; i++) {
    const b = buf[i];
    for (let j = 7; j >= 0; j--) {
      bits.push((b >> j) & 1);
    }
  }
  return bits;
}

function bufferFromBits(bits) {
  const len = bits.length - (bits.length % 8);
  const out = Buffer.alloc(len / 8);
  for (let i = 0, byteIndex = 0; i < len; i += 8, byteIndex++) {
    let val = 0;
    for (let j = 0; j < 8; j++) {
      val = (val << 1) | (bits[i + j] & 1);
    }
    out[byteIndex] = val;
  }
  return out;
}

// ========== Public API: encode / decode ==========

export async function encodeMsHEdgeGrayFT1(imageBuffer, payloadBuffer, opts = {}) {
  let { targetFormat, quality = 85, bitsPerChannel = 1, encrypt } = opts;

  // ✅ Safety fallback only if route didn't pass anything
  if (!targetFormat) targetFormat = 'png';

  // encrypt if needed
  let workingPayload = payloadBuffer;
  if (encrypt && encrypt.passphrase) {
    workingPayload = encryptPayload(payloadBuffer, encrypt.passphrase);
  }

  const payloadBits = bitsFromBuffer(workingPayload);
  const payloadLen = payloadBits.length;

  if (payloadLen > (2 ** 32 - 1)) {
    throw new Error('Payload too large for 32-bit length field');
  }

  // 32-bit header for length
  const lengthBits = [];
  for (let i = 31; i >= 0; i--) {
    lengthBits.push((payloadLen >> i) & 1);
  }
  const allBits = lengthBits.concat(payloadBits);

  // compute edges
  const { edgeIndices, width, height, channels, rawData } =
    await computeEdgeMask(imageBuffer, 0.6);

  const capacityBits = edgeIndices.length * Math.min(bitsPerChannel, 1); // currently using 1 bit per pixel
  if (allBits.length > capacityBits) {
    throw new Error(
      `Not enough edge pixels: capacity ${capacityBits} bits, need ${allBits.length} bits`
    );
  }

  // Embed into LSB of G channel (index 1)
  const stegoData = Buffer.from(rawData);

  for (let bitIndex = 0; bitIndex < allBits.length; bitIndex++) {
    const pixelIndex = edgeIndices[bitIndex]; // one bit per pixel
    const channelOffset = pixelIndex * channels + 1; // G channel
    const bit = allBits[bitIndex] & 1;
    stegoData[channelOffset] = (stegoData[channelOffset] & 0xFE) | bit;
  }

  // Re-encode with sharp according to targetFormat
  let sharpInstance = sharp(stegoData, {
    raw: {
      width,
      height,
      channels
    }
  });

  if (targetFormat === 'jpeg' || targetFormat === 'jpg') {
    sharpInstance = sharpInstance.jpeg({ quality });
  } else if (targetFormat === 'webp') {
    sharpInstance = sharpInstance.webp({ quality });
  } else if (targetFormat === 'avif') {
    sharpInstance = sharpInstance.avif({ quality, effort: 4, chromaSubsampling: '4:4:4' });
  } else {
    // default png
    sharpInstance = sharpInstance.png({
      compressionLevel: 9,
      adaptiveFiltering: true,
      palette: false
    });
  }

  const stegoBuffer = await sharpInstance.toBuffer();

  const metrics = {
    method: 'msHEdgeGrayFT1',
    payloadBits: payloadBits.length,
    totalBitsWithHeader: allBits.length,
    capacityBits,
    usedRatio: allBits.length / capacityBits,
    outputFormat: targetFormat
  };

  return { stegoBuffer, metrics };
}

export async function decodeMsHEdgeGrayFT1(stegoBuffer, opts = {}) {
  const { passphrase, bitsPerChannel = 1 } = opts;

  const { edgeIndices, width, height, channels, rawData } =
    await computeEdgeMask(stegoBuffer, 0.6);

  const flat = rawData;
  const capacityBits = edgeIndices.length * Math.min(bitsPerChannel, 1);
  if (capacityBits < 32) {
    throw new Error('Not enough edge pixels to read length header');
  }

  // read 32-bit length
  const lengthBits = [];
  for (let i = 0; i < 32; i++) {
    const pixelIndex = edgeIndices[i];
    const channelOffset = pixelIndex * channels + 1; // G channel
    const bit = flat[channelOffset] & 1;
    lengthBits.push(bit);
  }

  let payloadLen = 0;
  for (let i = 0; i < 32; i++) {
    payloadLen = (payloadLen << 1) | (lengthBits[i] & 1);
  }

  if (32 + payloadLen > capacityBits) {
    throw new Error(
      `Declared payload length ${payloadLen} bits exceeds capacity ${capacityBits - 32} bits`
    );
  }

  const payloadBits = [];
  for (let i = 0; i < payloadLen; i++) {
    const pixelIndex = edgeIndices[32 + i];
    const channelOffset = pixelIndex * channels + 1;
    const bit = flat[channelOffset] & 1;
    payloadBits.push(bit);
  }

  let payloadBuffer = bufferFromBits(payloadBits);

  if (passphrase) {
    payloadBuffer = decryptPayload(payloadBuffer, passphrase);
  }

  return { payload: payloadBuffer };
}
