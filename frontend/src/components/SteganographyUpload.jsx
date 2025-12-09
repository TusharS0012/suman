import axios from "axios";
import { useState, useRef } from "react";
import { getApiUrl, getAlgorithmEndpoints } from "../config/api";
import "../css/SteganographyUpload.css";

const MAX_FILE_SIZE = 50 * 1024 * 1024; // 50MB

// Algorithm descriptions
const getAlgorithmDescription = (algo) => {
    const descriptions = {
        LSB: "Least Significant Bit - Simple and fast, modifies the least significant bits of pixels",
        DCT: "Discrete Cosine Transform - More robust to JPEG compression, embeds in frequency domain",
        DWT: "Discrete Wavelet Transform - Highly robust, uses wavelet decomposition",
        PVD: "Pixel Value Differencing - Variable capacity based on pixel differences, resistant to statistical analysis"
    };
    return descriptions[algo.toUpperCase()] || "Advanced steganography algorithm";
};

export default function SteganographyUpload({ algorithm = "LSB" }) {
    const [file, setFile] = useState(null);
    const [message, setMessage] = useState("");
    const [passphrase, setPassphrase] = useState("");
    const [bitsPerChannel, setBitsPerChannel] = useState(1);
    const [outputFormat, setOutputFormat] = useState("webp"); // requested output (webp/avif/original)
    const [quality, setQuality] = useState(85); // compression quality hint
    const [mode, setMode] = useState("encode"); // encode or decode
    const [status, setStatus] = useState("idle");
    const [uploadProgress, setUploadProgress] = useState(0);
    const [error, setError] = useState("");
    const [result, setResult] = useState(null);
    const [isProcessing, setIsProcessing] = useState(false);
    const fileInputRef = useRef(null);

    const handleFileChange = (e) => {
        const selectedFile = e.target.files?.[0];
        if (!selectedFile) {
            setFile(null);
            setError("");
            return;
        }

        // Validate file
        if (selectedFile.size > MAX_FILE_SIZE) {
            setError(`File size exceeds ${MAX_FILE_SIZE / (1024 * 1024)}MB limit`);
            setFile(null);
            return;
        }

        const fileExtension = selectedFile.name.split(".").pop()?.toLowerCase();
        const validImageFormats = ["png", "jpg", "jpeg", "bmp", "gif", "webp", "avif", "tiff"];
        
        if (!validImageFormats.includes(fileExtension)) {
            setError("Please select a valid image file (PNG, JPG, BMP, etc.)");
            setFile(null);
            return;
        }

        setFile(selectedFile);
        setError("");
        setResult(null);
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        
        if (!file) {
            setError("Please select an image file");
            return;
        }

        if (mode === "encode" && !message.trim()) {
            setError("Please enter a message to hide");
            return;
        }

        try {
            setIsProcessing(true);
            setStatus("processing");
            setUploadProgress(0);
            setError("");
            setResult(null);

            const formData = new FormData();
            formData.append("image", file);
            
            if (mode === "encode") {
                formData.append("payload", message);
            }
            
            formData.append("bitsPerChannel", bitsPerChannel.toString());

            // Optional output format + quality
            if (mode === "encode" && outputFormat) {
                formData.append("outputFormat", outputFormat);
                formData.append("quality", quality.toString());
            }
            
            if (passphrase) {
                formData.append("passphrase", passphrase);
            }

            // Get algorithm-specific endpoints
            const endpoints = getAlgorithmEndpoints(algorithm);
            const endpoint = mode === "encode" ? endpoints.encode : endpoints.decode;
            const apiUrl = getApiUrl(endpoint);

            console.log(`${mode === "encode" ? "Encoding" : "Decoding"} with ${algorithm} algorithm`);
            console.log(`API URL: ${apiUrl}`);

            const response = await axios.post(apiUrl, formData, {
                headers: {
                    "Content-Type": "multipart/form-data",
                },
                timeout: 120000,
                onUploadProgress: (progressEvent) => {
                    if (progressEvent.total) {
                        const progress = Math.round((progressEvent.loaded * 100) / progressEvent.total);
                        setUploadProgress(progress);
                    }
                },
            });

            console.log("Response:", response.data);

            if (mode === "encode") {
                // For encode, we get back base64 image
                setResult({
                    type: "image",
                    data: response.data.imageBase64,
                    mime: response.data.mime || "image/png",
                    metrics: response.data.metrics,
                });
            } else {
                // For decode, we get back the hidden message
                setResult({
                    type: "text",
                    data: response.data.payload,
                });
            }

            setStatus("success");
        } catch (err) {
            console.error("Processing failed:", err);
            setError(err.response?.data?.error || err.message || "Processing failed");
            setStatus("error");
        } finally {
            setIsProcessing(false);
        }
    };

    const handleReset = () => {
        setFile(null);
        setMessage("");
        setPassphrase("");
        setResult(null);
        setError("");
        setStatus("idle");
        setUploadProgress(0);
        if (fileInputRef.current) {
            fileInputRef.current.value = "";
        }
    };

    const downloadImage = () => {
        if (result?.type === "image") {
            const link = document.createElement("a");
            link.href = `data:${result.mime};base64,${result.data}`;

            // Infer extension from MIME so downloads match requested format
            const mimeToExt = {
                "image/webp": "webp",
                "image/avif": "avif",
                "image/png": "png",
                "image/jpeg": "jpg",
            };
            const ext = mimeToExt[result.mime] || file.name.split('.').pop() || 'png';
            const baseName = file.name.replace(/\.[^.]+$/, '');
            link.download = `stego_${baseName}.${ext}`;
            link.click();
        }
    };

    return (
        <div className="steganography-upload">
            <div className="algorithm-info">
                <h3>Using: <span className="algorithm-name">{algorithm}</span> Steganography</h3>
                <p className="algorithm-description">{getAlgorithmDescription(algorithm)}</p>
            </div>

            <div className="mode-selector">
                <button
                    type="button"
                    className={`mode-btn ${mode === "encode" ? "active" : ""}`}
                    onClick={() => setMode("encode")}
                    disabled={isProcessing}
                >
                    Encode (Hide Message)
                </button>
                <button
                    type="button"
                    className={`mode-btn ${mode === "decode" ? "active" : ""}`}
                    onClick={() => setMode("decode")}
                    disabled={isProcessing}
                >
                    Decode (Extract Message)
                </button>
            </div>

            <form onSubmit={handleSubmit} className="stego-form">
                <div className="form-group">
                    <label htmlFor="file-input">
                        Select Image {mode === "encode" ? "(Cover Image)" : "(Stego Image)"}
                    </label>
                    <input
                        id="file-input"
                        ref={fileInputRef}
                        type="file"
                        accept="image/*"
                        onChange={handleFileChange}
                        disabled={isProcessing}
                    />
                    {file && <p className="file-name">Selected: {file.name}</p>}
                </div>

                {mode === "encode" && (
                    <div className="form-group">
                        <label htmlFor="message-input">Secret Message</label>
                        <textarea
                            id="message-input"
                            value={message}
                            onChange={(e) => setMessage(e.target.value)}
                            placeholder="Enter the message you want to hide..."
                            rows={4}
                            disabled={isProcessing}
                        />
                    </div>
                )}

                <div className="form-group">
                    <label htmlFor="bits-input">
                        Bits Per Channel (1-8)
                        <span className="info-text"> - Higher = more capacity, lower quality</span>
                    </label>
                    <input
                        id="bits-input"
                        type="number"
                        min="1"
                        max="8"
                        value={bitsPerChannel}
                        onChange={(e) => setBitsPerChannel(parseInt(e.target.value) || 1)}
                        disabled={isProcessing}
                    />
                </div>

                {mode === "encode" && (
                    <>
                        <div className="form-group">
                            <label htmlFor="output-format-select">
                                Output Format
                                <span className="info-text"> - Pre-convert and encode into this format</span>
                            </label>
                            <select
                                id="output-format-select"
                                value={outputFormat}
                                onChange={(e) => setOutputFormat(e.target.value)}
                                disabled={isProcessing}
                            >
                                <option value="">Original (no conversion)</option>
                                <option value="webp">WebP</option>
                                <option value="avif">AVIF</option>
                            </select>
                        </div>

                        {outputFormat && (
                            <div className="form-group">
                                <label htmlFor="quality-input">
                                    Quality (0-100)
                                    <span className="info-text"> - Higher = larger size, better quality</span>
                                </label>
                                <input
                                    id="quality-input"
                                    type="number"
                                    min="1"
                                    max="100"
                                    value={quality}
                                    onChange={(e) => setQuality(Math.min(100, Math.max(1, parseInt(e.target.value) || 80)))}
                                    disabled={isProcessing}
                                />
                            </div>
                        )}
                    </>
                )}

                <div className="form-group">
                    <label htmlFor="passphrase-input">
                        Passphrase (Optional)
                        <span className="info-text"> - For encryption</span>
                    </label>
                    <input
                        id="passphrase-input"
                        type="password"
                        value={passphrase}
                        onChange={(e) => setPassphrase(e.target.value)}
                        placeholder="Enter passphrase for encryption (optional)"
                        disabled={isProcessing}
                    />
                </div>

                {error && <div className="error-message">{error}</div>}

                {uploadProgress > 0 && uploadProgress < 100 && (
                    <div className="progress-bar">
                        <div className="progress-fill" style={{ width: `${uploadProgress}%` }}></div>
                        <span className="progress-text">{uploadProgress}%</span>
                    </div>
                )}

                <div className="form-actions">
                    <button
                        type="submit"
                        className="submit-btn"
                        disabled={isProcessing || !file}
                    >
                        {isProcessing ? "Processing..." : mode === "encode" ? "Encode Image" : "Decode Image"}
                    </button>
                    <button
                        type="button"
                        className="reset-btn"
                        onClick={handleReset}
                        disabled={isProcessing}
                    >
                        Reset
                    </button>
                </div>
            </form>

            {result && (
                <div className="result-section">
                    <h3>Result</h3>
                    {result.type === "image" ? (
                        <div className="image-result">
                            <img
                                src={`data:${result.mime};base64,${result.data}`}
                                alt="Steganography result"
                                style={{ maxWidth: "100%", height: "auto" }}
                            />
                            <button onClick={downloadImage} className="download-btn">
                                Download Image
                            </button>
                            {result.metrics && (
                                <div className="metrics">
                                    <h4>Metrics:</h4>
                                    <pre>{JSON.stringify(result.metrics, null, 2)}</pre>
                                </div>
                            )}
                        </div>
                    ) : (
                        <div className="text-result">
                            <p><strong>Hidden Message:</strong></p>
                            <div className="message-box">{result.data}</div>
                        </div>
                    )}
                </div>
            )}
        </div>
    );
}
