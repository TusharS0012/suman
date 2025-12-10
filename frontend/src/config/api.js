// API Configuration
const API_BASE_URL = import.meta.env.VITE_API_URL;

export const API_ENDPOINTS = {
  // LSB Algorithm
  ENCODE: "/api/encode",
  DECODE: "/api/decode",

  // DCT Algorithm
  DCT_ENCODE: "/api/encode",
  DCT_DECODE: "/api/decode",

  // DWT Algorithm
  DWT_ENCODE: "/api/encode",
  DWT_DECODE: "/api/decode",

  // PVD Algorithm
  PVD_ENCODE: "/api/encode",
  PVD_DECODE: "/api/decode",

  // Legacy endpoints
  STEGANOGRAPHY_ENCODE: "/api/steganography/encode",
  STEGANOGRAPHY_DECODE: "/api/steganography/decode",
};

export const getApiUrl = (endpoint) => {
  return `${API_BASE_URL}${endpoint}`;
};

// Get algorithm-specific endpoints
export const getAlgorithmEndpoints = (algorithm) => {
  const algoLower = algorithm.toLowerCase();

  switch (algoLower) {
    case "dct":
      return {
        encode: API_ENDPOINTS.DCT_ENCODE,
        decode: API_ENDPOINTS.DCT_DECODE,
      };
    case "dwt":
      return {
        encode: API_ENDPOINTS.DWT_ENCODE,
        decode: API_ENDPOINTS.DWT_DECODE,
      };
    case "pvd":
      return {
        encode: API_ENDPOINTS.PVD_ENCODE,
        decode: API_ENDPOINTS.PVD_DECODE,
      };
    case "lsb":
    default:
      return {
        encode: API_ENDPOINTS.ENCODE,
        decode: API_ENDPOINTS.DECODE,
      };
  }
};

export default {
  BASE_URL: API_BASE_URL,
  ENDPOINTS: API_ENDPOINTS,
  getApiUrl,
  getAlgorithmEndpoints,
};
