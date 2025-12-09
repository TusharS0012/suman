import React, { useState, useEffect, useCallback, useMemo } from "react";
import PropTypes from "prop-types";
import "../css/Body.css";
import ConverterContainer from "./ConverterContainer";
import ErrorBoundary from "./common/ErrorBoundary";
import cartoon from "/Researching-amico.svg";

/**
 * Body Component
 * Main landing section with hero content and steganography modules
 */
const Body = ({ className = "", onModuleSelect = () => {} }) => {
    // Image loading state (start with loaded=true to avoid flash)
    const [imageState, setImageState] = useState({
        loading: false,
        loaded: true,
        error: false
    });

    // Converter error state with retry tracking
    const [converterError, setConverterError] = useState({
        hasError: false,
        message: '',
        retryCount: 0
    });

    // Analytics tracking
    useEffect(() => {
        // Track page view (if analytics is available)
        if (window.gtag) {
            window.gtag('event', 'page_view', {
                page_title: 'Steganography Dashboard',
                page_location: window.location.href,
                page_path: window.location.pathname,
            });
        }
    }, []);

    // Memoized callbacks for better performance
    const handleImageError = useCallback(() => {
        setImageState({ 
            loading: false, 
            loaded: false, 
            error: true 
        });
        console.warn("Illustration failed to load");
    }, []);

    const handleConverterError = useCallback((error, errorInfo) => {
        console.error("Converter error:", error, errorInfo);
        setConverterError(prev => ({
            hasError: true,
            message: error?.message || 'Unable to load steganography modules',
            retryCount: prev.retryCount
        }));
    }, []);

    const handleRetry = useCallback(() => {
        if (converterError.retryCount >= 3) {
            setConverterError(prev => ({
                ...prev,
                message: 'Maximum retry attempts reached. Please refresh the page.'
            }));
            return;
        }

        setConverterError(prev => ({ 
            hasError: false,
            message: '',
            retryCount: prev.retryCount + 1
        }));
    }, [converterError.retryCount]);

    const handlePageReload = useCallback(() => {
        window.location.reload();
    }, []);

    // Memoized error fallback
    const errorFallback = useMemo(() => (
        <div className="converter-error-container" role="alert">
            <div className="error-content">
                <div className="error-icon-wrapper">
                    <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor">
                        <circle cx="12" cy="12" r="10" strokeWidth="2"/>
                        <line x1="12" y1="8" x2="12" y2="12" strokeWidth="2"/>
                        <line x1="12" y1="16" x2="12.01" y2="16" strokeWidth="2"/>
                    </svg>
                </div>
                <h3>Unable to Load Modules</h3>
                <p>{converterError.message || 'An unexpected error occurred.'}</p>
                <div className="error-actions">
                    <button 
                        onClick={handleRetry}
                        className="btn-primary"
                        disabled={converterError.retryCount >= 3}
                        aria-label="Retry loading modules"
                    >
                        {converterError.retryCount > 0 
                            ? `Retry (${converterError.retryCount}/3)` 
                            : 'Retry'}
                    </button>
                    <button 
                        onClick={handlePageReload}
                        className="btn-secondary"
                        aria-label="Reload page"
                    >
                        Refresh Page
                    </button>
                </div>
            </div>
        </div>
    ), [converterError.message, converterError.retryCount, handleRetry, handlePageReload]);

    return (
        <>
            {/* Skip to content link for accessibility */}
            <a href="#converter-section" className="skip-to-content">
                Skip to modules
            </a>

            <main role="main" className={className} data-testid="steganography-body">
                <section className="main-content" data-testid="main-content-section">
                    <div className="drop-section" data-testid="drop-section">
                        <div className="info-section">
                            <div className="title-section" data-testid="title-section">
                                {/* Trust Badge */}
                                <div className="trust-badge">
                                    <span className="badge-icon" role="img" aria-label="Security">🔒</span>
                                    <span>Secure & Private</span>
                                </div>

                                {/* Main Heading */}
                                <h1 id="main-heading" className="page-title" data-testid="page-title">
                                    Steganography
                                    <span className="gradient-text"> Processing</span>
                                </h1>

                                {/* Description */}
                                <p className="page-description" aria-describedby="main-heading" data-testid="page-subtitle">
                                    Hide and extract sensitive data within images using advanced cryptographic 
                                    algorithms. Professional-grade security with an intuitive interface.
                                </p>

                                {/* Stats Section */}
                                <div className="hero-stats" role="list">
                                    <div className="stat-item" role="listitem">
                                        <span className="stat-value">5</span>
                                        <span className="stat-label">Algorithms</span>
                                    </div>
                                    <div className="stat-item" role="listitem">
                                        <span className="stat-value">256-bit</span>
                                        <span className="stat-label">Encryption</span>
                                    </div>
                                    <div className="stat-item" role="listitem">
                                        <span className="stat-value">100%</span>
                                        <span className="stat-label">Private</span>
                                    </div>
                                </div>

                                {/* Trust Indicators */}
                                <div className="trust-indicators">
                                    <div className="trust-item">
                                        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor">
                                            <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" strokeWidth="2"/>
                                        </svg>
                                        <span>No Data Collection</span>
                                    </div>
                                    <div className="trust-item">
                                        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor">
                                            <rect x="3" y="11" width="18" height="11" rx="2" ry="2" strokeWidth="2"/>
                                            <path d="M7 11V7a5 5 0 0110 0v4" strokeWidth="2"/>
                                        </svg>
                                        <span>Client-Side Processing</span>
                                    </div>
                                    <div className="trust-item">
                                        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor">
                                            <polyline points="16 18 22 12 16 6" strokeWidth="2"/>
                                            <polyline points="8 6 2 12 8 18" strokeWidth="2"/>
                                        </svg>
                                        <span>Open Source</span>
                                    </div>
                                </div>
                            </div>
                        </div>

                        {/* Illustration Section */}
                        <div className="cartoon" data-testid="cartoon-section">
                            <div className="cartoon-wrapper">
                                {/* Main Image */}
                                {!imageState.error ? (
                                    <img
                                        src={cartoon}
                                        className="cartoon-img loaded"
                                        alt="Person researching steganography - illustration"
                                        onError={handleImageError}
                                        loading="lazy"
                                    />
                                ) : (
                                    /* Error Fallback */
                                    <div className="cartoon-fallback" role="img" aria-label="Steganography concept">
                                        <svg width="200" height="200" viewBox="0 0 24 24" fill="none" stroke="currentColor">
                                            <rect x="3" y="3" width="18" height="18" rx="2" ry="2" strokeWidth="2"/>
                                            <circle cx="8.5" cy="8.5" r="1.5" fill="currentColor"/>
                                            <polyline points="21 15 16 10 5 21" strokeWidth="2"/>
                                        </svg>
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>

                    {/* Modules Section */}
                    <section 
                        id="converter-section"
                        className="recommend-section" 
                        aria-labelledby="modules-heading"
                        data-testid="modules-section"
                    >
                        <div className="recommend-cnt">
                            <h2 id="modules-heading" className="section-title visually-hidden">
                                Steganography Modules
                            </h2>
                            
                            {!converterError.hasError ? (
                                <ErrorBoundary 
                                    onError={handleConverterError}
                                    errorMessage="The steganography modules failed to load"
                                >
                                    <ConverterContainer onModuleSelect={onModuleSelect} />
                                </ErrorBoundary>
                            ) : (
                                errorFallback
                            )}
                        </div>
                    </section>
                </section>
            </main>
        </>
    );
};

Body.propTypes = {
    className: PropTypes.string,
    onModuleSelect: PropTypes.func
};

export default Body;
