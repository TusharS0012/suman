import { useSearchParams, useNavigate } from "react-router-dom";
import { useEffect, useState } from "react";
import FileUpload from "./FileUpload";
import SteganographyUpload from "./SteganographyUpload";
import "../css/ConverterPage.css";

const ConverterPage = () => {
    const [searchParams] = useSearchParams();
    const navigate = useNavigate();
    const [converterInfo, setConverterInfo] = useState({
        type: "",
        targetFormat: "",
        sourceFormat: "",
        endpoint: "",
        acceptedFormats: [],
        index: null,
    });
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);

    const validateParams = params => {
        const errors = [];

        if (!params.type || params.type.trim() === "") {
            errors.push("Converter type is required");
        }

        if (!params.target || params.target.trim() === "") {
            errors.push("Target format is required");
        }

        if (!params.endpoint || params.endpoint.trim() === "") {
            errors.push("Endpoint is required");
        }

        const formatRegex = /^[a-zA-Z0-9\-_]+$/;
        if (params.target && !formatRegex.test(params.target)) {
            errors.push("Invalid target format");
        }

        if (params.source && !formatRegex.test(params.source)) {
            errors.push("Invalid source format");
        }

        return errors;
    };

    useEffect(() => {
        try {
            const type = searchParams.get("type");
            const targetFormat = searchParams.get("target");
            const sourceFormat = searchParams.get("source");
            const endpoint = searchParams.get("endpoint");
            const acceptedFormatsStr = searchParams.get("accepted");
            const index = searchParams.get("index");

            // Validate required parameters
            const validationErrors = validateParams({
                type,
                target: targetFormat,
                source: sourceFormat,
                endpoint,
            });

            if (validationErrors.length > 0) {
                console.error("Parameter validation errors:", validationErrors);
                setError("Invalid converter parameters");
                setTimeout(() => navigate("/"), 2000);
                return;
            }

            let acceptedFormats = [];
            if (acceptedFormatsStr) {
                try {
                    acceptedFormats = acceptedFormatsStr
                        .split(",")
                        .map(format => format.trim())
                        .filter(format => format.length > 0);
                } catch (err) {
                    console.warn("Error parsing accepted formats:", err);
                }
            }

            let parsedIndex = null;
            if (index) {
                const indexNum = parseInt(index, 10);
                if (!isNaN(indexNum) && indexNum >= 0) {
                    parsedIndex = indexNum;
                }
            }

            setConverterInfo({
                type: type.trim(),
                targetFormat: targetFormat.trim(),
                sourceFormat: sourceFormat ? sourceFormat.trim() : "",
                endpoint: endpoint.trim(),
                acceptedFormats,
                index: parsedIndex,
            });

            setLoading(false);
        } catch (err) {
            console.error("Error initializing converter page:", err);
            setError("Failed to load converter");
            setLoading(false);
        }
    }, [searchParams, navigate]);

    const handleBack = () => {
        try {
            navigate("/");
        } catch (err) {
            console.error("Navigation error:", err);
            window.location.href = "/";
        }
    };

    if (loading) {
        return (
            <div className="converter-loading">
                <div className="loading-spinner">Loading converter...</div>
            </div>
        );
    }

    if (error) {
        return (
            <div className="converter-error">
                <h2>Error</h2>
                <p>{error}</p>
                <button onClick={handleBack} className="back-button">
                    ← Back to Home
                </button>
            </div>
        );
    }

    return (
        <main className="converterPage-section">
            <header className="converter-header">
                <h1>{converterInfo.type} Module</h1>
                <p>
                    Process your image using the <strong>{converterInfo.type}</strong> module
                </p>
                <button className="back-button" onClick={handleBack} aria-label="Go back to converters list">
                    ← All Modules
                </button>
            </header>

            <section className="file-upload-section">
                {converterInfo.endpoint === "img-convert" ? (
                    <SteganographyUpload algorithm={converterInfo.type} />
                ) : (
                    <FileUpload
                        targetFormat={converterInfo.targetFormat}
                        sourceFormat={converterInfo.sourceFormat}
                        endpoint={converterInfo.endpoint}
                        acceptedFormats={converterInfo.acceptedFormats}
                        converterType={converterInfo.type}
                        converterIndex={converterInfo.index}
                    />
                )}
            </section>
        </main>
    );
};

export default ConverterPage;
