import React, { useState, useRef, useCallback } from "react";

const MAX_FILE_SIZE = 50 * 1024 * 1024; // 50MB
const MAX_FILES = 10;
const ALLOWED_EXTENSIONS = [
  "jpg",
  "jpeg",
  "png",
  "gif",
  "bmp",
  "tiff",
  "webp",
  "pdf",
];
const DANGEROUS_EXTENSIONS = [
  "exe",
  "bat",
  "cmd",
  "com",
  "scr",
  "vbs",
  "js",
  "jar",
  "php",
];

const DragFile = ({
  onFilesSelected,
  acceptedFormats = [],
  maxFiles = MAX_FILES,
}) => {
  const [files, setFiles] = useState([]);
  const [dragActive, setDragActive] = useState(false);
  const [error, setError] = useState("");
  const fileInputRef = useRef(null);

  const validateFiles = useCallback(
    (fileList) => {
      const errors = [];
      const validFiles = [];

      if (fileList.length > maxFiles) {
        errors.push(`Maximum ${maxFiles} files allowed`);
        return { errors, validFiles };
      }

      Array.from(fileList).forEach((file, index) => {
        if (file.size > MAX_FILE_SIZE) {
          errors.push(
            `File "${file.name}" exceeds ${
              MAX_FILE_SIZE / (1024 * 1024)
            }MB limit`
          );
          return;
        }

        if (file.size === 0) {
          errors.push(`File "${file.name}" is empty`);
          return;
        }

        const extension = file.name.split(".").pop()?.toLowerCase();
        if (!extension) {
          errors.push(`File "${file.name}" has no extension`);
          return;
        }

        if (DANGEROUS_EXTENSIONS.includes(extension)) {
          errors.push(
            `File "${file.name}" type not allowed for security reasons`
          );
          return;
        }

        if (!ALLOWED_EXTENSIONS.includes(extension)) {
          errors.push(`File "${file.name}" extension not supported`);
          return;
        }

        if (acceptedFormats.length > 0) {
          const isAccepted = acceptedFormats.some(
            (format) =>
              format.toLowerCase() === extension ||
              (format.toLowerCase() === "jpg" && extension === "jpeg")
          );

          if (!isAccepted) {
            errors.push(
              `File "${
                file.name
              }" format not accepted. Accepted: ${acceptedFormats.join(", ")}`
            );
            return;
          }
        }

        if (file.name.includes("../") || file.name.includes("..\\")) {
          errors.push(`File "${file.name}" has invalid name`);
          return;
        }

        validFiles.push(file);
      });

      return { errors, validFiles };
    },
    [maxFiles, acceptedFormats]
  );

  const handleFiles = useCallback(
    (fileList) => {
      try {
        const { errors, validFiles } = validateFiles(fileList);

        if (errors.length > 0) {
          setError(errors.join(". "));
          return;
        }

        setFiles(validFiles);
        setError("");

        if (onFilesSelected) {
          onFilesSelected(validFiles);
        }
      } catch (err) {
        console.error("Error handling files:", err);
        setError("Error processing files");
      }
    },
    [validateFiles, onFilesSelected]
  );

  const handleFileChange = useCallback(
    (e) => {
      const fileList = e.target.files;
      if (fileList && fileList.length > 0) {
        handleFiles(fileList);
      }
    },
    [handleFiles]
  );

  const handleDrop = useCallback(
    (e) => {
      e.preventDefault();
      e.stopPropagation();
      setDragActive(false);

      try {
        const fileList = e.dataTransfer.files;
        if (fileList && fileList.length > 0) {
          handleFiles(fileList);
        }
      } catch (err) {
        console.error("Error handling drop:", err);
        setError("Error processing dropped files");
      }
    },
    [handleFiles]
  );

  const handleDragOver = useCallback((e) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(true);
  }, []);

  const handleDragLeave = useCallback((e) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);
  }, []);

  const removeFile = useCallback(
    (index) => {
      try {
        const newFiles = files.filter((_, i) => i !== index);
        setFiles(newFiles);
        setError("");

        if (onFilesSelected) {
          onFilesSelected(newFiles);
        }
      } catch (err) {
        console.error("Error removing file:", err);
      }
    },
    [files, onFilesSelected]
  );

  const clearAll = useCallback(() => {
    setFiles([]);
    setError("");
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
    if (onFilesSelected) {
      onFilesSelected([]);
    }
  }, [onFilesSelected]);

  const formatFileSize = (bytes) => {
    if (bytes === 0) return "0 Bytes";
    const k = 1024;
    const sizes = ["Bytes", "KB", "MB", "GB"];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + " " + sizes[i];
  };

  return (
    <div className="drag-file-container">
      <div
        className={`drag-drop-zone ${dragActive ? "drag-active" : ""}`}
        onDrop={handleDrop}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        role="button"
        tabIndex={0}
        aria-label="Drag and drop files here or click to select"
      >
        <div className="drag-drop-content">
          <p>Drag and drop files here, or</p>
          <input
            ref={fileInputRef}
            type="file"
            multiple
            onChange={handleFileChange}
            accept={
              acceptedFormats.length > 0
                ? acceptedFormats.map((f) => `.${f}`).join(",")
                : "image/*,.pdf"
            }
            aria-label="Select files"
          />
          <button
            type="button"
            className="select-files-btn"
            onClick={() => fileInputRef.current?.click()}
          >
            Select Files
          </button>
        </div>

        <div className="file-info">
          <p>
            Maximum {maxFiles} files, {MAX_FILE_SIZE / (1024 * 1024)}MB each
          </p>
          {acceptedFormats.length > 0 && (
            <p>Accepted formats: {acceptedFormats.join(", ").toUpperCase()}</p>
          )}
        </div>
      </div>

      {error && (
        <div className="error-message" role="alert">
          <p>{error}</p>
        </div>
      )}

      {files.length > 0 && (
        <div className="files-list">
          <div className="files-header">
            <h4>Selected Files ({files.length})</h4>
            <button type="button" className="clear-all-btn" onClick={clearAll}>
              Clear All
            </button>
          </div>

          <ul className="files-grid">
            {files.map((file, index) => (
              <li key={`${file.name}-${index}`} className="file-item">
                <div className="file-info">
                  <span className="file-name" title={file.name}>
                    {file.name}
                  </span>
                  <span className="file-size">{formatFileSize(file.size)}</span>
                  <span className="file-type">
                    {file.name.split(".").pop()?.toUpperCase()}
                  </span>
                </div>
                <button
                  type="button"
                  className="remove-file-btn"
                  onClick={() => removeFile(index)}
                  aria-label={`Remove ${file.name}`}
                >
                  ×
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
};

export default DragFile;
