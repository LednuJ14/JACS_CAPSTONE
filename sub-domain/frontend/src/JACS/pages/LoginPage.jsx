import React, { useState, useEffect, useMemo } from 'react';
import { useSearchParams, Link } from 'react-router-dom';
import LoginForm from '../components/LoginForm';
import ForgotPassword from '../components/ForgotPassword';
import PasswordResetModal from '../components/PasswordResetModal';
import GeometricBackground from '../components/GeometricBackground';
import { useProperty } from '../components/PropertyContext';
import { apiService } from '../../services/api';

const LoginPage = () => {
  const [searchParams] = useSearchParams();
  const [currentView, setCurrentView] = useState('login');
  const [showResetModal, setShowResetModal] = useState(false);
  const [resetToken, setResetToken] = useState(null);
  const { property } = useProperty();
  const [displaySettings, setDisplaySettings] = useState(null);
  const [propertyData, setPropertyData] = useState(null);

  // Load property data by subdomain (for login page when not authenticated)
  const loadPropertyBySubdomain = async () => {
    try {
      const hostname = window.location.hostname || '';
      
      // First, check for subdomain in query parameters (for IP address access)
      const urlParams = new URLSearchParams(window.location.search);
      const subdomainParam = urlParams.get('subdomain');
      
      let subdomain = null;
      if (subdomainParam) {
        // Use subdomain from query parameter when using IP address
        subdomain = subdomainParam.toLowerCase();
      } else {
        // Extract subdomain from hostname (for localhost subdomain routing)
        const hostnameSubdomain = hostname.split('.')[0];
        if (hostnameSubdomain && hostnameSubdomain.toLowerCase() !== 'localhost' && !hostnameSubdomain.match(/^\d+\.\d+\.\d+\.\d+$/)) {
          subdomain = hostnameSubdomain.toLowerCase();
        }
      }
      
      if (subdomain) {
        const property = await apiService.getPropertyBySubdomain(subdomain);
        if (property) {
          setPropertyData(property);
          // Display settings will be set in the separate useEffect
        }
      }
    } catch (error) {
      // Silently handle connection errors (backend not running)
      const isConnectionError = error?.message?.includes('Failed to fetch') || 
                                error?.message?.includes('ERR_CONNECTION_REFUSED') ||
                                error?.name === 'TypeError';
      
      // Only log non-connection errors
      if (!isConnectionError) {
        console.warn('Failed to load property by subdomain:', error);
      }
      // Connection errors are handled silently - app continues with fallback data
    }
  };

  useEffect(() => {
    // Always try to load by subdomain to get the latest data (including logo)
    // This ensures we get fresh data even if property context has stale data
    loadPropertyBySubdomain();
    
    // Also use property from context as fallback
    if (property && !propertyData) {
      setPropertyData(property);
    }
  }, [property]);

  // Listen for display settings updates (e.g., when logo is uploaded)
  useEffect(() => {
    const handleDisplaySettingsUpdate = (event) => {
      // Reload property data to get updated logo
      loadPropertyBySubdomain();
    };

    window.addEventListener('displaySettingsUpdated', handleDisplaySettingsUpdate);
    window.addEventListener('propertyContextRefresh', handleDisplaySettingsUpdate);

    return () => {
      window.removeEventListener('displaySettingsUpdated', handleDisplaySettingsUpdate);
      window.removeEventListener('propertyContextRefresh', handleDisplaySettingsUpdate);
    };
  }, []);

  const formatName = (value) => {
    if (!value || typeof value !== 'string') return null;
    const cleaned = value
      .replace(/[-_]+/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();
    if (!cleaned) return null;
    return cleaned
      .split(' ')
      .map(word => word.charAt(0).toUpperCase() + word.slice(1))
      .join(' ');
  };

  const getHostSegment = () => {
    if (typeof window === 'undefined') return null;
    const host = window.location.hostname || '';
    if (!host) return null;
    const parts = host.split('.');
    if (!parts.length) return null;
    const candidate = parts[0];
    if (!candidate || candidate.toLowerCase() === 'localhost') return null;
    // Remove trailing numeric suffixes like "-11"
    return candidate.replace(/-\d+$/, '');
  };

  // Load display settings from property data (no auth required)
  useEffect(() => {
    // Display settings should come from propertyData or property (from public endpoint)
    const currentProperty = propertyData || property;
    
    // Prioritize propertyData (from subdomain lookup) as it's more up-to-date
    if (propertyData?.display_settings) {
      setDisplaySettings(propertyData.display_settings);
    } else if (currentProperty?.display_settings) {
      setDisplaySettings(currentProperty.display_settings);
    } else {
      // Initialize empty display settings if not found
      setDisplaySettings({});
    }
  }, [propertyData, property]);

  const propertyName = useMemo(() => {
    // Use propertyData (from subdomain lookup) or property (from context)
    const currentProperty = propertyData || property;
    
    // Always use real property name from database (not from display_settings)
    // Priority: property name from database > host
    const fromProperty = formatName(
      currentProperty?.property_name ||
      currentProperty?.name ||
      currentProperty?.title ||
      currentProperty?.building_name
    );
    if (fromProperty) return fromProperty;
    const fromHost = formatName(getHostSegment());
    return fromHost || 'Your Property';
  }, [property, propertyData]);

  // Check for password reset token in URL
  useEffect(() => {
    const token = searchParams.get('token');
    console.log('🔍 URL Search Params:', searchParams.toString());
    console.log('🔑 Token detected:', token);
    if (token) {
      console.log('✅ Setting token and opening modal');
      setResetToken(token);
      setShowResetModal(true);
    } else {
      console.log('❌ No token found in URL');
    }
  }, [searchParams]);

  

  const handleBackToLogin = () => {
    setCurrentView('login');
  };

  const handleForgotPassword = () => {
    setCurrentView('forgot-password');
  };

  const handleCloseResetModal = () => {
    setShowResetModal(false);
    setResetToken(null);
    // Remove token from URL without page reload
    window.history.replaceState({}, document.title, window.location.pathname);
  };

  const renderCurrentView = () => {
    switch (currentView) {
      case 'login':
        return (
          <LoginForm
            onForgotPassword={handleForgotPassword}
          />
        );
      
      case 'forgot-password':
        return (
          <ForgotPassword
            onBack={handleBackToLogin}
          />
        );
      default:
        return (
          <LoginForm
            onForgotPassword={handleForgotPassword}
          />
        );
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-100 p-4">
 

      {/* Main Login Card Container */}
      <div className="w-full max-w-6xl bg-white rounded-3xl shadow-2xl overflow-hidden relative">
        <div className="flex min-h-[600px]">
          {/* Left Side - Geometric Background */}
          <div className="hidden lg:flex lg:w-1/2 relative">
            <GeometricBackground />
            {/* Content Overlay with modern animations */}
            <div className="absolute inset-0 flex flex-col justify-between p-8 z-10">
              {/* Top Logo with animation */}
              <div className="flex items-center space-x-4 justify-start animate-in slide-in-from-left-4 duration-700">
                <div className="w-14 h-14 rounded-2xl bg-white/15 border-2 border-white/30 backdrop-blur flex items-center justify-center shadow-xl overflow-hidden relative transition-all duration-300 hover:shadow-2xl hover:scale-105">
                  {/* Decorative curved accent elements */}
                  <div className="absolute inset-0 overflow-hidden rounded-2xl">
                    <div className="absolute -top-1.5 -right-1.5 w-6 h-6 rounded-full bg-white/25 blur-md"></div>
                    <div className="absolute -bottom-1.5 -left-1.5 w-5 h-5 rounded-full bg-white/25 blur-md"></div>
                    {/* Curved line accent - elegant swoosh */}
                    <svg className="absolute inset-0 w-full h-full opacity-25" viewBox="0 0 56 56" fill="none" preserveAspectRatio="none">
                      <path d="M8 28 Q28 8, 48 28" stroke="white" strokeWidth="1.5" strokeLinecap="round" fill="none" />
                      <path d="M8 28 Q28 48, 48 28" stroke="white" strokeWidth="1.5" strokeLinecap="round" fill="none" />
                    </svg>
                    {/* Subtle gradient overlay */}
                    <div className="absolute inset-0 bg-gradient-to-br from-white/10 to-transparent rounded-2xl"></div>
                  </div>
                  
                  {displaySettings?.logoUrl && displaySettings.logoUrl.trim() !== '' ? (
                    <img
                      key={`logo-${displaySettings.logoUrl}-${propertyData?.id || property?.id || 'none'}-${Date.now()}`}
                      src={(() => {
                        const logoUrl = displaySettings.logoUrl;
                        let fullUrl;
                        if (logoUrl.startsWith('http://') || logoUrl.startsWith('https://')) {
                          fullUrl = logoUrl;
                        } else if (logoUrl.startsWith('/api/')) {
                          // Already has /api/ prefix (e.g., /api/properties/11/logo/filename.png)
                          fullUrl = `http://localhost:5001${logoUrl}`;
                        } else if (logoUrl.startsWith('/')) {
                          // Starts with / but not /api/
                          fullUrl = `http://localhost:5001${logoUrl}`;
                        } else {
                          // No leading slash
                          fullUrl = `http://localhost:5001/api/${logoUrl}`;
                        }
                        // Add cache busting query parameter to ensure fresh logo loads
                        return `${fullUrl}?t=${Date.now()}`;
                      })()}
                      alt="Property Logo"
                      className="w-full h-full object-contain object-center relative z-10"
                      style={{ display: 'block', width: '100%', height: '100%', objectFit: 'contain' }}
                      onError={(e) => {
                        console.error('LoginPage: Failed to load logo:', {
                          logoUrl: displaySettings.logoUrl,
                          src: e.target.src,
                          displaySettings: displaySettings
                        });
                        e.target.style.display = 'none';
                        const fallback = e.target.parentElement.querySelector('.logo-fallback');
                        if (fallback) {
                          fallback.style.display = 'block';
                          fallback.classList.remove('hidden');
                        }
                      }}
                      onLoad={(e) => {
                        console.log('LoginPage: Logo loaded successfully:', e.target.src);
                        const fallback = e.target.parentElement.querySelector('.logo-fallback');
                        if (fallback) {
                          fallback.style.display = 'none';
                          fallback.classList.add('hidden');
                        }
                      }}
                    />
                  ) : null}
                  <svg
                    className={`w-8 h-8 text-white logo-fallback relative z-10 ${displaySettings?.logoUrl && displaySettings.logoUrl.trim() !== '' ? 'hidden' : ''}`}
                    style={{ 
                      display: displaySettings?.logoUrl && displaySettings.logoUrl.trim() !== '' ? 'none' : 'block',
                      position: 'absolute',
                      inset: 0,
                      margin: 'auto'
                    }}
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="1.6"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  >
                    <path d="M3 21h18" />
                    <path d="M5 21V9l7-5 7 5v12" />
                    <path d="M9 21v-6h6v6" />
                    <path d="M9 10h.01M15 10h.01M12 7h.01" />
                  </svg>
                </div>
                <div className="text-white">
                  <p className="uppercase text-xs tracking-[0.4em] text-white/70">
                    Property Portal
                  </p>
                  <p className="text-xl font-semibold">{propertyName}</p>
                </div>
              </div>
              {/* Bottom Text with staggered animations */}
              <div className="text-white space-y-4">
                <h1 className="text-4xl font-bold leading-tight animate-in slide-in-from-bottom-4 duration-700 delay-200">
                  Welcome to {propertyName}
                </h1>
                <p className="text-xl opacity-90 font-light animate-in slide-in-from-bottom-4 duration-700 delay-400">
                  by JACS
                </p>
              </div>
            </div>
          </div>

          {/* Right Side - Login/Signup Form with modern container */}
          <div className="w-full lg:w-1/2 flex items-center justify-center bg-white p-8 relative">
            <div className="w-full max-w-sm relative z-10 animate-in slide-in-from-right-4 duration-700 delay-300">
              {renderCurrentView()}
            </div>
          </div>
        </div>
      </div>

      {/* Password Reset Modal */}
      <PasswordResetModal
        isOpen={showResetModal}
        onClose={handleCloseResetModal}
        token={resetToken}
      />
    </div>
  );
};

export default LoginPage;
