import { useState } from "react";
import "../css/ConverterBox.css";

const ConverterBox = ({ logo, title, info }) => {
    const [imageLoaded, setImageLoaded] = useState(false);
    const [imageError, setImageError] = useState(false);

    if (!title || !info) {
        console.warn("ConverterBox: Missing required props (title or info)");
        return null;
    }

    const handleImageLoad = () => {
        setImageLoaded(true);
        setImageError(false);
    };

    const handleImageError = () => {
        setImageError(true);
        setImageLoaded(false);
        console.warn(`Failed to load converter logo: ${logo}`);
    };

    const sanitizedTitle = title.replace(/[<>]/g, "");
    const sanitizedInfo = info.replace(/[<>]/g, "");

    return (
        <div className="converter-box" role="button" tabIndex={0}>
            <div className="converter-logo-container">
                {/* {logo && !imageError ? (
          <img
            src={logo}
            className={`converter-logo ${imageLoaded ? "loaded" : "loading"}`}
            alt={`${sanitizedTitle} converter icon`}
            onLoad={handleImageLoad}
            onError={handleImageError}
            loading="lazy"
          />
        ) : (
          <div className="converter-logo-fallback" aria-label="Converter icon">
            🔄
          </div>
        )} */}
            </div>

            <h3 className="converter-title">{sanitizedTitle}</h3>
            <p className="converter-info">{sanitizedInfo}</p>
        </div>
    );
};

export default ConverterBox;
