import "../css/Footer.css";
import { Link } from "react-router-dom";
import React, { useState, useEffect } from "react";
import { Facebook, Youtube, Linkedin, Mail, Phone, ArrowUp } from "lucide-react";

const Footer = () => {
    const [isScrollVisible, setIsScrollVisible] = useState(false);
    const [isScrolling, setIsScrolling] = useState(false);

    useEffect(() => {
        const toggleScrollVisibility = () => {
            try {
                if (window.pageYOffset > 300) {
                    setIsScrollVisible(true);
                } else {
                    setIsScrollVisible(false);
                }
            } catch (error) {
                console.error("Error checking scroll position:", error);
            }
        };

        window.addEventListener("scroll", toggleScrollVisibility);
        return () => window.removeEventListener("scroll", toggleScrollVisibility);
    }, []);

    const scrollToTop = () => {
        try {
            setIsScrolling(true);
            window.scrollTo({
                top: 0,
                behavior: "smooth",
            });

            setTimeout(() => {
                setIsScrolling(false);
            }, 500);
        } catch (error) {
            console.error("Error scrolling to top:", error);
            try {
                window.scrollTo(0, 0);
            } catch (fallbackError) {
                console.error("Fallback scroll also failed:", fallbackError);
            }
            setIsScrolling(false);
        }
    };

    const handleExternalLink = (url, platform) => {
        try {
            if (!url || typeof url !== "string") {
                console.error(`Invalid URL for ${platform}:`, url);
                return false;
            }

            const trustedDomains = ["facebook.com", "youtube.com", "linkedin.com"];

            const urlObj = new URL(url);
            const isValidDomain = trustedDomains.some(domain => urlObj.hostname.includes(domain));

            if (!isValidDomain) {
                console.warn(`Untrusted domain detected for ${platform}:`, urlObj.hostname);
                return false;
            }

            if (window.gtag) {
                window.gtag("event", "social_link_click", {
                    platform: platform,
                    url: url,
                });
            }

            return true;
        } catch (error) {
            console.error(`Error validating link for ${platform}:`, error);
            return false;
        }
    };

    const handleContactLink = (type, value) => {
        try {
            if (type === "email") {
                // Basic email validation
                const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
                if (!emailRegex.test(value.replace("mailto:", ""))) {
                    console.error("Invalid email format:", value);
                    return false;
                }
            } else if (type === "phone") {
                const phoneRegex = /^[+]?[\d\s\-\(\)]+$/;
                if (!phoneRegex.test(value.replace("tel:", ""))) {
                    console.error("Invalid phone format:", value);
                    return false;
                }
            }

            if (window.gtag) {
                window.gtag("event", "contact_click", {
                    contact_type: type,
                    value: value,
                });
            }

            return true;
        } catch (error) {
            console.error(`Error handling ${type} contact:`, error);
            return false;
        }
    };

    const SafeLink = ({ href, children, className, ariaLabel, platform, type, value }) => {
        const handleClick = e => {
            try {
                if (platform) {
                    if (!handleExternalLink(href, platform)) {
                        e.preventDefault();
                        return;
                    }
                } else if (type && value) {
                    if (!handleContactLink(type, value)) {
                        e.preventDefault();
                        return;
                    }
                }
            } catch (error) {
                console.error("Error in link click handler:", error);
                e.preventDefault();
            }
        };

        return (
            <a
                href={href}
                className={className}
                aria-label={ariaLabel}
                onClick={handleClick}
                target="_blank"
                rel="noopener noreferrer"
            >
                {children}
            </a>
        );
    };

    return (
        <footer className="footer" role="contentinfo">
            <div className="footer-container">
                <div className="footer-content">
                    <div className="footer-section">
                        <h3 className="section-title">Company</h3>
                        <div className="company-info">
                            <div className="logo">
                                <span className="company-name">SMVDU</span>
                            </div>
                            <div className="social-links">
                                <SafeLink
                                    href="https://www.facebook.com/smvdu"
                                    className="social-link"
                                    ariaLabel="Visit our Facebook page"
                                    platform="facebook"
                                >
                                    <Facebook size={20} />
                                </SafeLink>
                                <SafeLink
                                    href="https://www.youtube.com/smvdu"
                                    className="social-link"
                                    ariaLabel="Visit our YouTube channel"
                                    platform="youtube"
                                >
                                    <Youtube size={20} />
                                </SafeLink>
                                <SafeLink
                                    href="https://www.linkedin.com/company/smvdu"
                                    className="social-link"
                                    ariaLabel="Visit our LinkedIn page"
                                    platform="linkedin"
                                >
                                    <Linkedin size={20} />
                                </SafeLink>
                            </div>
                        </div>
                    </div>

                    <div className="footer-section">
                        <h3 className="section-title">Navigation</h3>
                        <nav className="footer-nav" role="navigation" aria-label="Footer navigation">
                            <Link to="/" className="home-link" aria-label="Go to homepage">
                                Home
                            </Link>
                        </nav>
                    </div>

                    <div className="footer-section">
                        <h3 className="section-title">Contact Info</h3>
                        <div className="contact-info">
                            <div className="contact-item">
                                <Mail size={18} />
                                <SafeLink
                                    href="mailto:stegno@smvdu.ac.in"
                                    className="contact-link"
                                    ariaLabel="Send us an email"
                                    type="email"
                                    value="mailto:stegno@smvdu.ac.in"
                                >
                                    stegno@smvdu.ac.in
                                </SafeLink>
                            </div>
                            <div className="contact-item">
                                <Phone size={18} />
                                <SafeLink
                                    href="tel:+1234567890"
                                    className="contact-link"
                                    ariaLabel="Call us"
                                    type="phone"
                                    value="tel:+1234567890"
                                >
                                    +1 (234) 567-890
                                </SafeLink>
                            </div>
                        </div>
                    </div>
                </div>

                <div className="footer-bottom">
                    <div className="copyright">
                        <p>&copy; 2025 SMVDU. All Rights Reserved.</p>
                    </div>
                    {isScrollVisible && (
                        <button
                            className={`scroll-top-btn ${isScrolling ? "scrolling" : ""}`}
                            onClick={scrollToTop}
                            aria-label="Scroll to top of page"
                            disabled={isScrolling}
                        >
                            <ArrowUp size={18} />
                        </button>
                    )}
                </div>
            </div>
        </footer>
    );
};

export default Footer;
