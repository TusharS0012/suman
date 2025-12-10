import sharp from "sharp";
import crypto from "crypto";
import {
  buildHeader,
  parseHeader,
  encryptWithPassphrase,
  decryptWithPassphrase,
} from "../utils/cryptoHeader.js";

//
// DCT STEGO
//

function bytesToBits(buf) {
  const bits = [];
  for (let i = 0; i < buf.length; i++) {
    for (let j = 7; j >= 0; j--) bits.push((buf[i] >> j) & 1);
  }
  return bits;
}

function bitsToBytes(bits) {
  const bytes = [];
  for (let i = 0; i < bits.length; i += 8) {
    let val = 0;
    for (let j = 0; j < 8; j++) val = (val << 1) | (bits[i + j] || 0);
    bytes.push(val);
  }
  return Buffer.from(bytes);
}

// DCT math
function dct1D(values) {
  const N = values.length;
  const out = new Array(N);
  for (let k = 0; k < N; k++) {
    let sum = 0;
    for (let n = 0; n < N; n++) {
      sum += values[n] * Math.cos((Math.PI * k * (2 * n + 1)) / (2 * N));
    }
    out[k] = (k === 0 ? Math.sqrt(1 / N) : Math.sqrt(2 / N)) * sum;
  }
  return out;
}
function idct1D(vals) {
  const N = vals.length;
  const out = new Array(N);
  for (let n = 0; n < N; n++) {
    let sum = 0;
    for (let k = 0; k < N; k++) {
      sum +=
        (k === 0 ? Math.sqrt(1 / N) : Math.sqrt(2 / N)) *
        vals[k] *
        Math.cos((Math.PI * k * (2 * n + 1)) / (2 * N));
    }
    out[n] = sum;
  }
  return out;
}
function dct2D(block) {
  const size = 8;
  const tmp = new Array(size);
  const out = new Array(size);
  for (let i = 0; i < size; i++) tmp[i] = dct1D(block[i]);
  for (let j = 0; j < size; j++) {
    const col = tmp.map((r) => r[j]);
    const d = dct1D(col);
    for (let i = 0; i < size; i++) {
      if (!out[i]) out[i] = [];
      out[i][j] = d[i];
    }
  }
  return out;
}
function idct2D(coeffs) {
  const size = 8;
  const tmp = new Array(size);
  const out = new Array(size);
  for (let j = 0; j < size; j++) {
    const col = coeffs.map((r) => r[j]);
    const d = idct1D(col);
    for (let i = 0; i < size; i++) {
      if (!tmp[i]) tmp[i] = [];
      tmp[i][j] = d[i];
    }
  }
  for (let i = 0; i < size; i++) out[i] = idct1D(tmp[i]);
  return out;
}

//
// ENCODE
//
export async function encodeDCT(input, payloadBuffer, options = {}) {
  console.log("\n[DCT ENCODE] Starting…");

  const bitsPerChannel = options.bitsPerChannel || 1;
  const encryptOpt = options.encrypt || null;

  const meta = await sharp(input).metadata();
  let width = meta.width;
  let height = meta.height;

  if (!width || !height) {
    throw new Error("Invalid image dimensions");
  }

  // Enforce divisibility by 8
  width = width - (width % 8);
  height = height - (height % 8);

  console.log(`[DCT ENCODE] Using aligned size: ${width}x${height}`);

  // Remove alpha → ALWAYS RGB
  const { data, info } = await sharp(input)
    .resize(width, height)
    .raw()
    .removeAlpha()
    .toBuffer({ resolveWithObject: true });

  console.log(
    `[DCT ENCODE] Raw size: ${width}x${height} channels=${info.channels}`
  );

  let plaintext = Buffer.from(payloadBuffer);
  let headerObj;

  if (encryptOpt && encryptOpt.passphrase) {
    const { ciphertext, salt, iv, authTag } = encryptWithPassphrase(
      plaintext,
      encryptOpt.passphrase
    );
    headerObj = buildHeader(
      { payloadLength: ciphertext.length, encrypted: true, salt, iv, authTag },
      plaintext
    );
    plaintext = ciphertext;
  } else {
    headerObj = buildHeader(
      { payloadLength: plaintext.length, encrypted: false },
      plaintext
    );
  }

  const fullPayload = Buffer.concat([headerObj.headerBuffer, plaintext]);
  const payloadBits = bytesToBits(fullPayload);
  const blockSize = 8;

  const blocksX = Math.floor(width / blockSize);
  const blocksY = Math.floor(height / blockSize);
  const totalBlocks = blocksX * blocksY;
  const coeffsPerBlock = 6;
  const capacityBits = totalBlocks * coeffsPerBlock * 3 * bitsPerChannel;

  console.log(
    `[DCT ENCODE] Capacity: ${capacityBits} bits, Need: ${payloadBits.length} bits`
  );

  if (payloadBits.length > capacityBits) {
    throw new Error("Payload too large");
  }

  const modified = Buffer.from(data);
  let bitIdx = 0;

  const embedPos = [
    [2, 1],
    [1, 2],
    [2, 2],
    [3, 1],
    [1, 3],
    [3, 2],
  ];

  for (let by = 0; by < blocksY && bitIdx < payloadBits.length; by++) {
    for (let bx = 0; bx < blocksX && bitIdx < payloadBits.length; bx++) {
      for (let c = 0; c < 3 && bitIdx < payloadBits.length; c++) {
        const blk = [];
        for (let y = 0; y < blockSize; y++) {
          blk[y] = [];
          for (let x = 0; x < blockSize; x++) {
            blk[y][x] =
              modified[
                ((by * blockSize + y) * width + (bx * blockSize + x)) *
                  info.channels +
                  c
              ];
          }
        }
        const dctB = dct2D(blk);

        for (const [r, col] of embedPos) {
          if (bitIdx >= payloadBits.length) break;
          const bit = payloadBits[bitIdx++];
          const coeff = dctB[r][col];
          const q = Math.trunc(coeff / 8);
          const wantOdd = bit === 1;

          const newQ =
            (Math.abs(q) % 2 === 1) === wantOdd ? q : q + (q >= 0 ? 1 : -1);
          dctB[r][col] = newQ * 8;
        }
        const outBlock = idct2D(dctB);
        for (let y = 0; y < blockSize; y++) {
          for (let x = 0; x < blockSize; x++) {
            modified[
              ((by * blockSize + y) * width + (bx * blockSize + x)) *
                info.channels +
                c
            ] = Math.max(0, Math.min(255, Math.round(outBlock[y][x])));
          }
        }
      }
    }
  }

  // Write back to RGB PNG
  const stego = await sharp(modified, {
    raw: { width, height, channels: 3 },
  })
    .tiff({
      compression: "none", // ← true raw, no change to pixel values
    })
    .toBuffer();

  console.log(`[DCT ENCODE] Done. Final size: ${stego.length} bytes\n`);

  return {
    stegoBuffer: stego,
    metrics: {
      width,
      height,
      capacityBits,
      embeddedBits: payloadBits.length,
      algorithm: "DCT",
      outputFormat: "tiff",
    },
  };
}

//
// DECODE
//
export async function decodeDCT(input, options = {}) {
  console.log("\n[DCT DECODE] Starting…");
  const passphrase = options.passphrase || null;

  const { data, info } = await sharp(input)
    .raw()
    .removeAlpha()
    .toBuffer({ resolveWithObject: true });

  const width = info.width;
  const height = info.height;

  console.log(
    `[DCT DECODE] Image size: ${width}x${height} channels=${info.channels}`
  );

  if (width % 8 !== 0 || height % 8 !== 0) {
    throw new Error("Invalid image — size must be divisible by 8");
  }

  const blockSize = 8;
  const blocksX = Math.floor(width / blockSize);
  const blocksY = Math.floor(height / blockSize);

  const bits = [];
  const embedPos = [
    [2, 1],
    [1, 2],
    [2, 2],
    [3, 1],
    [1, 3],
    [3, 2],
  ];

  for (let by = 0; by < blocksY && bits.length < 100000; by++) {
    for (let bx = 0; bx < blocksX && bits.length < 100000; bx++) {
      for (let c = 0; c < 3 && bits.length < 100000; c++) {
        const blk = [];
        for (let y = 0; y < blockSize; y++) {
          blk[y] = [];
          for (let x = 0; x < blockSize; x++) {
            blk[y][x] =
              data[
                ((by * blockSize + y) * width + (bx * blockSize + x)) *
                  info.channels +
                  c
              ];
          }
        }
        const dctB = dct2D(blk);
        for (const [r, col] of embedPos) {
          const q = Math.trunc(dctB[r][col] / 8);
          bits.push(Math.abs(q) & 1);
        }
      }
    }
  }

  console.log(`[DCT DECODE] First 32 bits:`, bits.slice(0, 32));
  const firstBytes = bitsToBytes(bits.slice(0, 32)).slice(0, 4);
  console.log(
    `[DCT DECODE] First 4 bytes:`,
    firstBytes,
    firstBytes.toString("ascii")
  );

  let header;
  try {
    header = parseHeader(bitsToBytes(bits).slice(0, 85));
  } catch {
    console.log("[DCT DECODE] Invalid magic — NOT a stego image");
    throw new Error("No hidden data found in this image");
  }

  console.log("[DCT DECODE] Header OK:", header);

  const start = header.headerSize * 8;
  const end = start + header.payloadLength * 8;
  const payloadBits = bits.slice(start, end);
  const payloadBuf = bitsToBytes(payloadBits).slice(0, header.payloadLength);

  if (header.encrypted) {
    if (!passphrase) {
      throw new Error("Encrypted — passphrase required");
    }
    const plaintext = decryptWithPassphrase(
      payloadBuf,
      passphrase,
      header.salt,
      header.iv,
      header.authTag
    );
    const sha = crypto.createHash("sha256").update(plaintext).digest();
    if (!sha.equals(header.sha256)) {
      throw new Error("Wrong passphrase or corrupted data");
    }
    return { payload: plaintext, header };
  }

  // non-encrypted
  const sha = crypto.createHash("sha256").update(payloadBuf).digest();
  if (!sha.equals(header.sha256)) {
    throw new Error("Corrupted payload");
  }

  return { payload: payloadBuf, header };
}
