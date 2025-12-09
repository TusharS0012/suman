import { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import ConverterBox from "./ConverterBox";
import "../css/ConverterContainer.css";
import { Converter_List } from "../utils/const";

const ConverterContainer = () => {
    const [converterList, setConverterList] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);

    useEffect(() => {
        try {
            if (!Array.isArray(Converter_List) || Converter_List.length === 0) {
                throw new Error("Invalid or empty converter list");
            }

            const validatedList = Converter_List.filter((item, index) => {
                if (!item || typeof item !== "object") {
                    console.warn(`Invalid converter item at index ${index}:`, item);
                    return false;
                }

                const requiredFields = ["title", "info", "targetFormat", "endpoint"];
                const missingFields = requiredFields.filter(field => !item[field]);

                if (missingFields.length > 0) {
                    console.warn(`Converter item at index ${index} missing fields:`, missingFields);
                    return false;
                }

                return true;
            });

            if (validatedList.length === 0) {
                throw new Error("No valid converters found");
            }

            setConverterList(validatedList);
            setLoading(false);
        } catch (err) {
            console.error("Error loading converters:", err);
            setError(err.message);
            setLoading(false);
        }
    }, []);

    const buildConverterUrl = (item, index) => {
        try {
            const params = new URLSearchParams({
                type: item.title,
                target: item.targetFormat,
                endpoint: item.endpoint,
                index: index.toString(),
            });

            if (item.sourceFormat) {
                params.append("source", item.sourceFormat);
            }

            if (item.acceptedFormats && Array.isArray(item.acceptedFormats)) {
                params.append("accepted", item.acceptedFormats.join(","));
            }

            return `/converterPage?${params.toString()}`;
        } catch (err) {
            console.error("Error building converter URL:", err);
            return "/";
        }
    };

    if (loading) {
        return (
            <div className="converter-loading">
                <div className="loading-spinner" aria-label="Loading converters">
                    Loading modules...
                </div>
            </div>
        );
    }

    if (error) {
        return (
            <div className="converter-error">
                <h3>Unable to load modules</h3>
                <p>{error}</p>
                <button onClick={() => window.location.reload()} className="retry-button">
                    Retry
                </button>
            </div>
        );
    }

    return (
        <div className="ConverterContainer">
            {converterList.map((item, index) => (
                <Link key={`${item.title}-${index}`} to={buildConverterUrl(item, index)} className="converter-link">
                    <ConverterBox logo={item.logo} title={item.title} info={item.info} />
                </Link>
            ))}
        </div>
    );
};

export default ConverterContainer;
