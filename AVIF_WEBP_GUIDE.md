# AVIF/WebP Pre-Conversion for Steganography

## Overview

The steganography system now supports **pre-converting** uploaded images to AVIF or WebP format **before** encoding messages. This approach provides:

1. **Smaller file sizes**: AVIF and WebP offer superior compression compared to PNG/JPEG
2. **Better compression post-encoding**: Modern formats compress more efficiently after steganography
3. **User control**: Users can choose their preferred output format

## How It Works

### Traditional Approach (Previous Implementation)
```
Upload Image (PNG/JPEG) → Encode Message → Compress Output → Final Image
```
**Problem**: Post-encoding compression can distort the message or not achieve good compression.

### New Approach (Current Implementation)
```
Upload Image → Convert to AVIF/WebP → Encode Message → Compress in Same Format → Final Image
```
**Benefits**: Pre-conversion establishes a compressed baseline, then encoding maintains the format for optimal results.

## API Usage

### Request Parameters

All encoding endpoints (`/api/encode`, `/api/dct/encode`, `/api/dwt/encode`, `/api/pvd/encode`) now accept:

| Parameter | Type | Description | Default |
|-----------|------|-------------|---------|
| `outputFormat` | string | Target format: `'avif'` or `'webp'` | `null` (no pre-conversion) |
| `quality` | number | Compression quality (0-100) | `80` for AVIF, `85` for WebP |
| `image` | file | Image file to encode | Required |
| `payload` | string | Message to encode | Required |
| `passphrase` | string | Encryption passphrase | Optional |
| `bitsPerChannel` | number | Bits per channel (LSB, DCT, DWT) | `1` |

### Example Request (Using cURL)

```bash
# Encode with WebP pre-conversion
curl -X POST http://localhost:5000/api/dct/encode \
  -F "image=@input.jpg" \
  -F "payload=Secret message" \
  -F "outputFormat=webp" \
  -F "quality=85"

# Encode with AVIF pre-conversion (if supported)
curl -X POST http://localhost:5000/api/dwt/encode \
  -F "image=@input.png" \
  -F "payload=Confidential data" \
  -F "outputFormat=avif" \
  -F "quality=80"
```

### Example Response

```json
{
  "imageBase64": "UklGRiQAAABXRUJQVlA4...",
  "mime": "image/webp",
  "metrics": {
    "width": 600,
    "height": 400,
    "capacityBits": 67500,
    "usedBits": 848,
    "outputFormat": "webp",
    "originalSize": 32424,
    "outputSize": 4586,
    "sizeIncrease": -27838,
    "sizeIncreasePercent": -85.86,
    "compressionApplied": true,
    "formatChanged": false,
    "originalFormat": "webp",
    "note": "Optimized compression applied while maintaining WEBP format.",
    "preConversion": {
      "originalSize": 32424,
      "convertedSize": 2284,
      "sizeReduction": 30140,
      "sizeReductionPercent": "92.96",
      "note": "Image pre-converted from PNG to WEBP format before encoding for optimal compression."
    }
  }
}
```

## Performance Results

### Test Results (600x400 gradient image)

| Algorithm | Original Format | Output Format | Pre-Conversion | Size Change |
|-----------|----------------|---------------|----------------|-------------|
| **DCT** | PNG (31.66 KB) | WebP | Yes | **-85.86%** 🎉 |
| **DWT** | PNG (31.66 KB) | WebP | Yes | **-86.21%** 🎉 |
| LSB | PNG (31.66 KB) | WebP → PNG | Yes | +101.71% (LSB requires lossless) |
| PVD | PNG (31.66 KB) | WebP → PNG | Yes | +101.75% (PVD requires lossless) |

### Key Findings

1. **Best Results**: DCT and DWT algorithms with WebP pre-conversion
   - Achieve **85-86% size reduction** compared to original PNG
   - Output stays in WebP format for maximum compression

2. **LSB and PVD**: Require lossless compression (PNG)
   - Pre-conversion to WebP/AVIF doesn't help as much
   - Final output converts back to PNG
   - Still beneficial for starting with smaller file

3. **Recommended Combinations**:
   - **DCT + WebP**: Best compression, good quality, widely supported
   - **DWT + WebP**: Excellent compression, robust to processing
   - **LSB + PNG**: Traditional approach works best
   - **PVD + PNG**: Traditional approach works best

## Format Support

### WebP ✅
- **Fully supported** in Sharp 0.32.6
- **Recommended** for production use
- Excellent compression (85-90% size reduction in tests)
- Wide browser support
- Quality range: 0-100 (recommend 85-90 for steganography)

### AVIF ⚠️
- Support depends on Sharp build configuration
- May not be available in all environments
- Falls back to WebP if not supported
- Better compression than WebP when available
- Quality range: 0-100 (recommend 80-85 for steganography)

## Algorithm Compatibility

| Algorithm | Format Preservation | Pre-Conversion Benefit | Recommendation |
|-----------|-------------------|----------------------|----------------|
| **LSB** | PNG only (lossless required) | Limited | Use PNG input |
| **PVD** | PNG only (lossless required) | Limited | Use PNG input |
| **DCT** | WebP/AVIF/JPEG preserved | **Excellent** | ✅ Use WebP pre-conversion |
| **DWT** | WebP/AVIF/JPEG preserved | **Excellent** | ✅ Use WebP pre-conversion |

## Migration Guide

### For Existing Users

**No changes required!** The system is backward compatible:
- Don't specify `outputFormat` → Works as before
- Specify `outputFormat=webp` → Enables pre-conversion

### For New Users

**Recommended workflow**:
1. Upload any image (PNG, JPEG, etc.)
2. Choose algorithm:
   - For **DCT or DWT**: Add `outputFormat=webp` for best compression
   - For **LSB or PVD**: Don't specify outputFormat (use default PNG)
3. Encode your message
4. Download the output image (check `mime` field for format)

## Code Example (Frontend)

```javascript
async function encodeWithWebP(imageFile, message) {
  const formData = new FormData();
  formData.append('image', imageFile);
  formData.append('payload', message);
  formData.append('outputFormat', 'webp'); // Enable pre-conversion
  formData.append('quality', '85');
  formData.append('bitsPerChannel', '1');
  
  const response = await fetch('http://localhost:5000/api/dct/encode', {
    method: 'POST',
    body: formData
  });
  
  const result = await response.json();
  
  console.log(`Original size: ${result.metrics.preConversion.originalSize} bytes`);
  console.log(`After pre-conversion: ${result.metrics.preConversion.convertedSize} bytes`);
  console.log(`Final output: ${result.metrics.outputSize} bytes`);
  console.log(`Overall reduction: ${result.metrics.sizeIncreasePercent}%`);
  
  // Create downloadable image
  const blob = b64toBlob(result.imageBase64, result.mime);
  const url = URL.createObjectURL(blob);
  
  return { url, metrics: result.metrics };
}

function b64toBlob(base64, type) {
  const binary = atob(base64);
  const array = [];
  for (let i = 0; i < binary.length; i++) {
    array.push(binary.charCodeAt(i));
  }
  return new Blob([new Uint8Array(array)], { type });
}
```

## Troubleshooting

### "AVIF format not supported"
**Solution**: AVIF support depends on Sharp build. Use WebP instead:
```javascript
formData.append('outputFormat', 'webp'); // Instead of 'avif'
```

### "Output converted to PNG unexpectedly"
**Cause**: LSB and PVD algorithms require lossless compression.
**Solution**: Use DCT or DWT algorithms with WebP/AVIF, or accept PNG for LSB/PVD.

### "File size increased instead of decreased"
**Check**:
1. Algorithm choice (DCT/DWT work best with WebP)
2. Quality setting (80-90 recommended)
3. Input image type (photos compress better than graphics)

## Conclusion

The pre-conversion feature provides significant file size reductions (85%+) when using:
- **DCT or DWT algorithms**
- **WebP format**
- **Photographic images**

For LSB and PVD algorithms, traditional PNG output remains the best option due to lossless requirements.
