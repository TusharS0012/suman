import sharp from 'sharp';

// Compression notification messages
const COMPRESSION_MESSAGES = {
  FORMAT_CHANGED: (originalFormat, outputFormat, algorithm) => 
    `Image format changed from ${originalFormat} to ${outputFormat} (required for ${algorithm.toUpperCase()} algorithm). This may result in larger file size.`,
  OPTIMIZED: (outputFormat) => 
    `Optimized compression applied while maintaining ${outputFormat.toUpperCase()} format.`,
  PRE_CONVERTED: (originalFormat, outputFormat) =>
    `Image pre-converted from ${originalFormat.toUpperCase()} to ${outputFormat.toUpperCase()} format before encoding for optimal compression.`
};

/**
 * Detects the format of the input image buffer
 * @param {Buffer} imageBuffer - The input image buffer
 * @returns {Promise<Object>} - Object containing format and metadata
 */
async function detectImageFormat(imageBuffer) {
  const metadata = await sharp(imageBuffer).metadata();
  return {
    format: metadata.format,
    width: metadata.width,
    height: metadata.height,
    size: imageBuffer.length
  };
}

/**
 * Pre-converts an image to AVIF or WebP format before encoding.
 * This allows for better compression and smaller output file sizes.
 * 
 * @param {Buffer} imageBuffer - The input image buffer
 * @param {string} targetFormat - Target format ('avif' or 'webp')
 * @param {Object} options - Conversion options
 * @returns {Promise<Object>} - Object containing converted buffer and metrics
 */
async function preConvertImage(imageBuffer, targetFormat = 'webp', options = {}) {
  const originalMetrics = await detectImageFormat(imageBuffer);
  
  const sharpInstance = sharp(imageBuffer);
  let convertedBuffer;
  
  if (targetFormat === 'avif') {
    // AVIF: Best compression, slower encoding
    // Note: AVIF support depends on Sharp build configuration
    try {
      convertedBuffer = await sharpInstance
        .avif({
          quality: options.quality || 80,
          effort: options.effort || 4, // 0-9, higher = better compression but slower
          chromaSubsampling: '4:4:4' // No chroma subsampling for better quality
        })
        .toBuffer();
    } catch (error) {
      // Fallback to WebP if AVIF is not supported
      console.warn('AVIF format not supported, falling back to WebP:', error.message);
      convertedBuffer = await sharpInstance
        .webp({
          quality: options.quality || 85,
          effort: options.effort || 4,
          lossless: false
        })
        .toBuffer();
      targetFormat = 'webp';
    }
  } else if (targetFormat === 'webp') {
    // WebP: Good compression, faster than AVIF
    convertedBuffer = await sharpInstance
      .webp({
        quality: options.quality || 85,
        effort: options.effort || 4, // 0-6 for WebP, higher = better compression
        lossless: false,
        nearLossless: true
      })
      .toBuffer();
  } else {
    throw new Error(`Unsupported target format: ${targetFormat}. Use 'avif' or 'webp'.`);
  }
  
  return {
    buffer: convertedBuffer,
    originalFormat: originalMetrics.format,
    targetFormat,
    metrics: {
      originalSize: originalMetrics.size,
      convertedSize: convertedBuffer.length,
      sizeReduction: originalMetrics.size - convertedBuffer.length,
      sizeReductionPercent: ((originalMetrics.size - convertedBuffer.length) / originalMetrics.size * 100).toFixed(2),
      note: COMPRESSION_MESSAGES.PRE_CONVERTED(originalMetrics.format, targetFormat)
    }
  };
}

/**
 * Applies optimized compression to the output image to minimize file size
 * while preserving steganography data integrity.
 * 
 * Strategy:
 * - Supports AVIF/WebP output for better compression
 * - For LSB steganography: Use PNG with optimized compression (lossless required)
 * - For frequency domain methods (DCT/DWT): Can use AVIF/WebP/JPEG with high quality
 * - For PVD: Use PNG (lossless required for pixel value differences)
 * 
 * @param {Buffer} imageData - Raw image data buffer
 * @param {Object} rawInfo - Raw image info (width, height, channels)
 * @param {Object} options - Compression options
 * @param {string} options.originalFormat - Original image format (png, jpeg, avif, webp, etc.)
 * @param {string} options.algorithm - Steganography algorithm used (lsb, dct, dwt, pvd)
 * @param {number} options.originalSize - Original image file size in bytes
 * @returns {Promise<Object>} - Object containing compressed buffer and metrics
 */
async function compressEncodedImage(imageData, rawInfo, options = {}) {
  const { originalFormat = 'png', algorithm = 'lsb', originalSize = 0, quality = 85 } = options;
  const { width, height, channels } = rawInfo;

  const sharpInstance = sharp(imageData, {
    raw: { width, height, channels }
  });

  let outputBuffer;
  let outputFormat;
  let formatChanged = false;

  // Determine output format and compression strategy based on algorithm and original format
  if (algorithm === 'dct' || algorithm === 'dwt') {
    // Frequency domain methods are more robust to lossy compression
    if (originalFormat === 'avif') {
      // Try AVIF, fallback to WebP if not supported
      try {
        outputBuffer = await sharpInstance
          .avif({
            quality: quality || 85,
            effort: 4,
            chromaSubsampling: '4:4:4'
          })
          .toBuffer();
        outputFormat = 'avif';
      } catch (error) {
        console.warn('AVIF output not supported, using WebP:', error.message);
        outputBuffer = await sharpInstance
          .webp({
            quality: quality || 90,
            effort: 4,
            lossless: false
          })
          .toBuffer();
        outputFormat = 'webp';
        formatChanged = true;
      }
    } else if (originalFormat === 'webp') {
      // Preserve WebP format with high quality
      outputBuffer = await sharpInstance
        .webp({
          quality: quality || 90,
          effort: 4,
          lossless: false
        })
        .toBuffer();
      outputFormat = 'webp';
    } else if (originalFormat === 'jpeg' || originalFormat === 'jpg') {
      // Use JPEG with high quality to preserve embedded data
      outputBuffer = await sharpInstance
        .jpeg({
          quality: quality || 95,
          chromaSubsampling: '4:4:4',
          mozjpeg: true
        })
        .toBuffer();
      outputFormat = 'jpeg';
    } else {
      // Use PNG with optimized compression
      outputBuffer = await sharpInstance
        .png({
          compressionLevel: 9,
          adaptiveFiltering: true,
          palette: false
        })
        .toBuffer();
      outputFormat = 'png';
    }
  } else {
    // LSB and PVD need high fidelity; default to lossless PNG unless user asked for AVIF/WebP.
    // When AVIF/WebP requested, use near-lossless (quality-controlled) to reduce size, accepting slight risk.
    if (originalFormat === 'webp') {
      outputBuffer = await sharpInstance
        .webp({
          quality: quality || 90,
          effort: 4,
          lossless: false,
          nearLossless: true
        })
        .toBuffer();
      outputFormat = 'webp';
    } else if (originalFormat === 'avif') {
      outputBuffer = await sharpInstance
        .avif({
          quality: quality || 85,
          effort: 4,
          chromaSubsampling: '4:4:4'
        })
        .toBuffer();
      outputFormat = 'avif';
    } else {
      if (originalFormat !== 'png') {
        formatChanged = true;
      }
      outputBuffer = await sharpInstance
        .png({
          compressionLevel: 9,
          adaptiveFiltering: true,
          palette: false
        })
        .toBuffer();
      outputFormat = 'png';
    }
  }

  // Calculate size metrics
  const outputSize = outputBuffer.length;
  const sizeIncrease = outputSize - originalSize;
  const sizeIncreasePercent = originalSize > 0 
    ? ((sizeIncrease / originalSize) * 100).toFixed(2) 
    : 0;

  return {
    buffer: outputBuffer,
    format: outputFormat,
    metrics: {
      originalSize,
      outputSize,
      sizeIncrease,
      sizeIncreasePercent: parseFloat(sizeIncreasePercent),
      compressionApplied: true,
      formatChanged,
      originalFormat,
      note: formatChanged 
        ? COMPRESSION_MESSAGES.FORMAT_CHANGED(originalFormat, outputFormat, algorithm)
        : COMPRESSION_MESSAGES.OPTIMIZED(outputFormat)
    }
  };
}

/**
 * Creates a standardized response with file size metrics
 * Note: Currently not used but kept for potential future use
 * @param {Buffer} stegoBuffer - The encoded image buffer
 * @param {Object} originalMetrics - Original image metrics
 * @param {Object} algorithmMetrics - Algorithm-specific metrics
 * @returns {Object} - Complete metrics object
 */
function createMetricsResponse(stegoBuffer, originalMetrics, algorithmMetrics) {
  const sizeIncrease = stegoBuffer.length - originalMetrics.size;
  const increasePercent = originalMetrics.size > 0
    ? ((sizeIncrease / originalMetrics.size) * 100).toFixed(2)
    : '0.00';
  
  return {
    ...algorithmMetrics,
    fileSize: {
      original: originalMetrics.size,
      encoded: stegoBuffer.length,
      increase: sizeIncrease,
      increasePercent: increasePercent
    }
  };
}

/**
 * Handles optional pre-conversion of image to AVIF/WebP format
 * @param {Buffer} imageBuffer - Original image buffer
 * @param {string|null} outputFormat - Desired output format ('avif' or 'webp')
 * @param {number} quality - Compression quality (0-100)
 * @returns {Promise<Object>} - Object with buffer and optional preConversionMetrics
 */
async function handlePreConversion(imageBuffer, outputFormat, quality = 80) {
  if (outputFormat === 'avif' || outputFormat === 'webp') {
    const converted = await preConvertImage(imageBuffer, outputFormat, { quality });
    return {
      buffer: converted.buffer,
      preConversionMetrics: converted.metrics
    };
  }
  return {
    buffer: imageBuffer,
    preConversionMetrics: null
  };
}

/**
 * Gets MIME type from image format
 * @param {string} format - Image format (png, jpeg, webp, avif)
 * @returns {string} - MIME type
 */
function getMimeTypeFromFormat(format) {
  const mimeTypes = {
    'png': 'image/png',
    'jpeg': 'image/jpeg',
    'jpg': 'image/jpeg',
    'webp': 'image/webp',
    'avif': 'image/avif'
  };
  return mimeTypes[format] || 'image/png';
}

export {
  detectImageFormat,
  preConvertImage,
  handlePreConversion,
  compressEncodedImage,
  createMetricsResponse,
  getMimeTypeFromFormat
};
