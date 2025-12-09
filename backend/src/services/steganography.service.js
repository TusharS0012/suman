import sharp from 'sharp';
import fs from 'fs/promises';
import path from 'path';

export const encodeMessage = async (imagePath, message) => {
  try {
    // Read the image
    const image = await sharp(imagePath);
    const metadata = await image.metadata();
    
    // Convert message to binary
    const binaryMessage = message
      .split('')
      .map(char => char.charCodeAt(0).toString(2).padStart(8, '0'))
      .join('');
    
    // Add termination sequence
    const binaryData = binaryMessage + '00000000'; // NULL terminator
    
    // Get image data
    const { data, info } = await image
      .raw()
      .toBuffer({ resolveWithObject: true });
    
    // Encode message in LSB
    for (let i = 0; i < binaryData.length; i++) {
      if (i >= data.length) break;
      // Clear LSB and set it to message bit
      data[i] = (data[i] & 0xFE) | parseInt(binaryData[i]);
    }
    
    // Create output filename
    const outputPath = path.join('uploads', `encoded_${path.basename(imagePath)}`);
    
    // Save encoded image
    await sharp(data, {
      raw: {
        width: info.width,
        height: info.height,
        channels: info.channels
      }
    })
    .toFormat(metadata.format)
    .toFile(outputPath);
    
    return {
      encodedImagePath: outputPath,
      originalName: path.basename(imagePath)
    };
  } catch (error) {
    throw new Error(`Error encoding message: ${error.message}`);
  }
};

export const decodeMessage = async (imagePath) => {
  try {
    // Read the image
    const { data } = await sharp(imagePath)
      .raw()
      .toBuffer({ resolveWithObject: true });
    
    // Extract binary message from LSB
    let binaryMessage = '';
    let byteArray = [];
    let currentByte = '';
    
    for (let i = 0; i < data.length; i++) {
      // Get LSB
      const bit = data[i] & 1;
      currentByte += bit;
      
      if (currentByte.length === 8) {
        byteArray.push(currentByte);
        // Check for NULL terminator
        if (currentByte === '00000000') break;
        currentByte = '';
      }
    }
    
    // Convert binary to string
    const message = byteArray
      .slice(0, -1) // Remove NULL terminator
      .map(byte => String.fromCharCode(parseInt(byte, 2)))
      .join('');
    
    return message;
  } catch (error) {
    throw new Error(`Error decoding message: ${error.message}`);
  }
};