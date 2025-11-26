import React, { useState, useEffect, useMemo } from 'react';
import { useSearchParams, Link } from 'react-router-dom';
import LoginForm from '../components/LoginForm';
import ForgotPassword from '../components/ForgotPassword';
import PasswordResetModal from '../components/PasswordResetModal';
import GeometricBackground from '../components/GeometricBackground';
import { useProperty } from '../components/PropertyContext';

const LoginPage = () => {
  const [searchParams] = useSearchParams();
  const [currentView, setCurrentView] = useState('login');
  const [showResetModal, setShowResetModal] = useState(false);
  const [resetToken, setResetToken] = useState(null);
  const { property } = useProperty();

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

  const propertyName = useMemo(() => {
    const fromProperty = formatName(
      property?.property_name ||
      property?.name ||
      property?.title ||
      property?.building_name
    );
    if (fromProperty) return fromProperty;
    const fromHost = formatName(getHostSegment());
    return fromHost || 'Your Property';
  }, [property]);

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
                <div className="w-14 h-14 rounded-2xl bg-white/15 border border-white/20 backdrop-blur flex items-center justify-center shadow-lg">
                  <svg
                    className="w-8 h-8 text-white"
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
