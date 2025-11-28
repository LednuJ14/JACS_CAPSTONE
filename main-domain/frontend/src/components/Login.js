import React, { useState, useEffect } from 'react';
import ApiService from '../services/api';
import Logo07 from '../assets/images/logo-07.png';

const Login = ({ onLoginSuccess, onBackToMain, onSignUpClick, onForgotPasswordClick }) => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [rememberMe, setRememberMe] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  // const [role] = useState('tenant'); // Removed unused variable
  const [isLoaded, setIsLoaded] = useState(false);
  const [isLoggingIn, setIsLoggingIn] = useState(false);
  const [is2faOpen, setIs2faOpen] = useState(false);
  const [twofaCode, setTwofaCode] = useState('');
  const [pendingEmail, setPendingEmail] = useState('');
  const [showVerificationPrompt, setShowVerificationPrompt] = useState(false);
  const [isResendingVerification, setIsResendingVerification] = useState(false);

  // Trigger animations on component mount
  useEffect(() => {
    const timer = setTimeout(() => setIsLoaded(true), 100);
    return () => clearTimeout(timer);
  }, []);

  const handleSubmit = async (event) => {
    event.preventDefault();

    if (!email || !password) {
      setErrorMessage('Please enter both email and password.');
      return;
    }

    setErrorMessage('');
    setIsLoggingIn(true);

    try {
      // Make API call to backend for authentication
      const data = await ApiService.login(email, password);
      // Handle pending 2FA
      if (data && data.status === 'pending_2fa') {
        setPendingEmail(email);
        setIs2faOpen(true);
        return;
      }

      // Normal success path: Store tokens and proceed (ApiService already set tokens)
      if (data && data.user) {
        localStorage.setItem('user_role', data.user.role);
        localStorage.setItem('user_id', data.user.id);
        if (typeof onLoginSuccess === 'function') {
          onLoginSuccess({ 
            email: data.user.email, 
            rememberMe, 
            role: data.user.role.toLowerCase()
          });
        }
      }
    } catch (error) {
      console.error('Login error:', error);
      
      let errorMsg = 'Login failed. Please try again.';
      
      if (error.isNetworkError) {
        errorMsg = 'Unable to connect to server. Please check your internet connection and try again.';
      } else if (error.status === 401) {
        errorMsg = 'Invalid email or password. Please check your credentials and try again.';
      } else if (error.status === 423) {
        errorMsg = 'Account temporarily locked due to too many failed attempts. Please try again later.';
      } else if (error.status === 403) {
        errorMsg = 'Account is suspended or inactive. Please contact support.';
      } else if (error.status === 400 && error.message && error.message.includes('Email verification required')) {
        errorMsg = 'Please verify your email address before logging in. Check your inbox for the verification link.';
        setShowVerificationPrompt(true);
        setPendingEmail(email);
      } else if (error.message) {
        errorMsg = error.message;
      }
      
      setErrorMessage(errorMsg);
    } finally {
      setIsLoggingIn(false);
    }
  };

  const handleResendVerification = async () => {
    if (!pendingEmail) return;
    setIsResendingVerification(true);
    setErrorMessage('');
    
    try {
      const response = await fetch('/api/auth/resend-verification', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ email: pendingEmail })
      });
      
      const data = await response.json();
      
      if (response.ok) {
        setErrorMessage('Verification email sent! Please check your inbox.');
      } else {
        setErrorMessage(data.error || 'Failed to resend verification email.');
      }
    } catch (error) {
      console.error('Resend verification error:', error);
      setErrorMessage('An error occurred while sending verification email.');
    } finally {
      setIsResendingVerification(false);
    }
  };

  const handleVerify2FA = async () => {
    if (!twofaCode || !pendingEmail) return;
    setIsLoggingIn(true);
    setErrorMessage('');
    try {
      const data = await ApiService.verify2FA(pendingEmail, twofaCode);
      if (data && data.user) {
        localStorage.setItem('user_role', data.user.role);
        localStorage.setItem('user_id', data.user.id);
        setIs2faOpen(false);
        setTwofaCode('');
        if (typeof onLoginSuccess === 'function') {
          onLoginSuccess({ 
            email: data.user.email, 
            rememberMe, 
            role: data.user.role.toLowerCase()
          });
        }
      }
    } catch (error) {
      console.error('2FA verify error:', error);
      const msg = error?.message || 'Invalid or expired code. Please try again.';
      setErrorMessage(msg);
    } finally {
      setIsLoggingIn(false);
    }
  };

  const handleBackClick = () => {
    if (typeof onBackToMain === 'function') {
      onBackToMain();
    }
  };

  const handleSignUpClick = () => {
    if (typeof onSignUpClick === 'function') {
      onSignUpClick();
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 via-white to-gray-100 flex items-center justify-center p-4">
      {/* Back Button */}
      <button
        onClick={handleBackClick}
        className={`fixed top-6 left-6 z-50 flex items-center space-x-2 px-4 py-2 bg-white/90 backdrop-blur-sm rounded-xl border border-gray-200 text-gray-700 hover:bg-white hover:text-black transition-all duration-300 transform hover:scale-105 hover:-translate-y-1 hover:shadow-lg group ${
          isLoaded ? 'translate-x-0 opacity-100' : '-translate-x-8 opacity-0'
        }`}
        style={{ transitionDelay: '200ms' }}
      >
        <svg className="w-4 h-4 transition-transform duration-200 group-hover:-translate-x-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
        </svg>
        <span className="text-sm font-medium">Back to Home</span>
      </button>

      <div 
        className={`w-full max-w-6xl bg-white rounded-3xl shadow-2xl overflow-hidden grid grid-cols-1 lg:grid-cols-2 transform transition-all duration-1000 ease-out ${
          isLoaded 
            ? 'translate-y-0 opacity-100 scale-100' 
            : 'translate-y-8 opacity-0 scale-95'
        }`}
      >
        {/* Left Visual Panel */}
        <div className="relative hidden lg:block">
          <div className="absolute inset-0">
            <div
              className="w-full h-full bg-cover bg-center"
              style={{
                backgroundImage:
                  "url('https://images.unsplash.com/photo-1560448204-e02f11c3d0e2?ixlib=rb-4.0.3&ixid=M3wxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8fA%3D%3D&auto=format&fit=crop&w=1000&q=80')",
              }}
            />
            <div className="absolute inset-0 bg-gradient-to-br from-black/80 via-gray-900/70 to-black/80"></div>
          </div>
          
          <div className="relative h-full flex flex-col justify-between p-8 text-white">
            {/* Header */}
            <div 
              className={`flex items-center space-x-3 transform transition-all duration-800 delay-200 ease-out ${
                isLoaded ? 'translate-x-0 opacity-100' : '-translate-x-8 opacity-0'
              }`}
            >
              <div className="w-16 h-16 flex items-center justify-center transform transition-transform duration-300 hover:scale-110 hover:rotate-6 overflow-hidden">
                <img src={Logo07} alt="JACS Logo" className="w-14 h-14 object-contain filter brightness-0 invert" />
              </div>
              <div>
                <h1 className="text-xl font-bold">JACS</h1>
                <p className="text-sm text-gray-300">Property Management</p>
              </div>
            </div>

            {/* Content */}
            <div 
              className={`space-y-6 transform transition-all duration-800 delay-400 ease-out ${
                isLoaded ? 'translate-x-0 opacity-100' : '-translate-x-8 opacity-0'
              }`}
            >
              <div>
                <h2 className="text-4xl font-bold mb-4 bg-gradient-to-r from-white to-gray-300 bg-clip-text text-transparent">
                  Welcome Back
                </h2>
                <p className="text-lg text-gray-300 leading-relaxed">
                  Access your property management dashboard and discover the perfect rental spaces for your needs.
                </p>
              </div>
              
              {/* Features */}
              <div className="space-y-4">
                {[
                  { text: "Find your perfect rental space", delay: "delay-500" },
                  { text: "Manage properties efficiently", delay: "delay-700" },
                  { text: "Secure and reliable platform", delay: "delay-900" }
                ].map((feature, index) => (
                  <div 
                    key={index}
                    className={`flex items-center space-x-3 transform transition-all duration-600 ease-out ${feature.delay} ${
                      isLoaded ? 'translate-x-0 opacity-100' : '-translate-x-4 opacity-0'
                    } hover:translate-x-2 hover:scale-105`}
                  >
                    <div className="w-8 h-8 bg-white/20 rounded-lg flex items-center justify-center transform transition-all duration-300 hover:bg-white/30 hover:scale-110 hover:rotate-12">
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                      </svg>
                    </div>
                    <span className="text-gray-300">{feature.text}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* Footer */}
            <div 
              className={`text-sm text-gray-400 transform transition-all duration-800 delay-1000 ease-out ${
                isLoaded ? 'translate-x-0 opacity-100' : '-translate-x-8 opacity-0'
              }`}
            >
              <p>© 2024 JACS Property Management. All rights reserved.</p>
            </div>
          </div>
        </div>

        {/* Right Form Panel */}
        <div className="p-8 lg:p-12 flex items-center justify-center">
          <div className="w-full max-w-md">
            {/* Mobile Header */}
            <div 
              className={`lg:hidden text-center mb-8 transform transition-all duration-800 delay-200 ease-out ${
                isLoaded ? 'translate-y-0 opacity-100' : 'translate-y-4 opacity-0'
              }`}
            >
              <div className="flex items-center justify-center space-x-3 mb-4">
                <div className="w-12 h-12 bg-gradient-to-br from-black to-gray-800 rounded-2xl flex items-center justify-center transform transition-all duration-300 hover:scale-110 hover:rotate-6">
                  <svg className="w-7 h-7 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
                  </svg>
                </div>
                <div>
                  <h1 className="text-2xl font-bold text-gray-900">JACS</h1>
                  <p className="text-sm text-gray-600">Property Management</p>
                </div>
              </div>
            </div>

            <form onSubmit={handleSubmit} className="space-y-6">
              {/* Form Header */}
              <div 
                className={`text-center lg:text-left transform transition-all duration-800 delay-300 ease-out ${
                  isLoaded ? 'translate-y-0 opacity-100' : 'translate-y-4 opacity-0'
                }`}
              >
                <h2 className="text-3xl font-bold text-gray-900 mb-2 bg-gradient-to-r from-gray-900 to-gray-700 bg-clip-text text-transparent">
                  Sign In
                </h2>
                <p className="text-gray-600">Welcome back! Please enter your details.</p>
              </div>

              {/* Role Selection */}
              <div 
                className={`space-y-3 transform transition-all duration-800 delay-400 ease-out ${
                  isLoaded ? 'translate-y-0 opacity-100' : 'translate-y-4 opacity-0'
                }`}
              > 
              </div>

              {/* Username Field */}
              <div 
                className={`transform transition-all duration-800 delay-600 ease-out ${
                  isLoaded ? 'translate-y-0 opacity-100' : 'translate-y-4 opacity-0'
                }`}
              >
                <label className="block text-sm font-semibold text-gray-700 mb-2">Email</label>
                <div className="relative group">
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none transition-all duration-200 group-focus-within:text-black">
                    <svg className="h-5 w-5 text-gray-400 group-focus-within:text-black transition-colors" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                    </svg>
                  </div>
                  <input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="Enter your email address"
                    className="w-full pl-10 pr-4 py-3 border border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-black focus:border-transparent transition-all duration-200 transform focus:scale-105 hover:shadow-md"
                  />
                </div>
              </div>

              {/* Password Field */}
              <div 
                className={`transform transition-all duration-800 delay-700 ease-out ${
                  isLoaded ? 'translate-y-0 opacity-100' : 'translate-y-4 opacity-0'
                }`}
              >
                <label className="block text-sm font-semibold text-gray-700 mb-2">Password</label>
                <div className="relative group">
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none transition-all duration-200 group-focus-within:text-black">
                    <svg className="h-5 w-5 text-gray-400 group-focus-within:text-black transition-colors" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                    </svg>
                  </div>
                  <input
                    type={showPassword ? 'text' : 'password'}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="Enter your password"
                    className="w-full pl-10 pr-12 py-3 border border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-black focus:border-transparent transition-all duration-200 transform focus:scale-105 hover:shadow-md"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute inset-y-0 right-0 pr-3 flex items-center text-gray-400 hover:text-gray-600 transition-all duration-200 transform hover:scale-110"
                    aria-label={showPassword ? 'Hide password' : 'Show password'}
                  >
                    {showPassword ? (
                      <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.878 9.878L3 3m6.878 6.878L21 21" />
                      </svg>
                    ) : (
                      <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                      </svg>
                    )}
                  </button>
                </div>
              </div>

              {/* Remember Me & Forgot Password */}
              <div 
                className={`flex items-center justify-between transform transition-all duration-800 delay-800 ease-out ${
                  isLoaded ? 'translate-y-0 opacity-100' : 'translate-y-4 opacity-0'
                }`}
              >
                <label className="flex items-center space-x-2 cursor-pointer group">
                  <input
                    type="checkbox"
                    checked={rememberMe}
                    onChange={(e) => setRememberMe(e.target.checked)}
                    className="w-4 h-4 text-black border-gray-300 rounded focus:ring-black transition-all duration-200 transform group-hover:scale-110"
                  />
                  <span className="text-sm text-gray-700 group-hover:text-black transition-colors">Remember me</span>
                </label>
                <button 
                  type="button" 
                  onClick={onForgotPasswordClick}
                  className="text-sm font-semibold text-black hover:text-gray-700 transition-all duration-200 transform hover:scale-105"
                >
                  Forgot password?
                </button>
              </div>

              {/* Error Message */}
              {errorMessage && (
                <div className="bg-red-50 border border-red-200 rounded-xl p-4 transform transition-all duration-300 animate-bounce">
                  <div className="flex items-center space-x-2">
                    <svg className="w-5 h-5 text-red-500 animate-pulse" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                    <span className="text-sm text-red-700">{errorMessage}</span>
                  </div>
                </div>
              )}

              {/* Login Button */}
              <button
                type="submit"
                disabled={isLoggingIn}
                className={`w-full bg-gradient-to-r from-black to-gray-800 text-white py-3 px-4 rounded-xl font-semibold hover:from-gray-800 hover:to-black focus:outline-none focus:ring-2 focus:ring-black focus:ring-offset-2 transition-all duration-300 transform hover:scale-105 hover:-translate-y-1 hover:shadow-xl active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed disabled:transform-none ${
                  isLoaded ? 'translate-y-0 opacity-100 delay-900' : 'translate-y-4 opacity-0'
                }`}
              >
                <span className="relative z-10 flex items-center justify-center space-x-2">
                  {isLoggingIn && (
                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                  )}
                  <span>{isLoggingIn ? 'Signing In...' : 'Sign In'}</span>
                </span>
              </button>

              {/* Sign Up Link */}
              <div 
                className={`text-center transform transition-all duration-800 delay-1000 ease-out ${
                  isLoaded ? 'translate-y-0 opacity-100' : 'translate-y-4 opacity-0'
                }`}
              >
                <p className="text-sm text-gray-600">
                  Don't have an account?{' '}
                  <button 
                    type="button" 
                    onClick={handleSignUpClick}
                    className="font-semibold text-black hover:text-gray-700 transition-all duration-200 transform hover:scale-105"
                  >
                    Sign up
                  </button>
                </p>
              </div>
            </form>
          </div>
        </div>
      </div>
      {/* 2FA Modal */}
      {is2faOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="bg-white rounded-xl w-full max-w-md p-6 shadow-xl">
            <h3 className="text-lg font-bold text-black mb-2">Two-Factor Verification</h3>
            <p className="text-sm text-gray-600 mb-4">We sent a 6-digit code to your email. Enter it below to complete sign in.</p>
            <input
              type="text"
              value={twofaCode}
              onChange={(e) => setTwofaCode(e.target.value)}
              placeholder="123456"
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-black focus:border-transparent text-black mb-4"
            />
            <div className="flex items-center justify-end gap-2">
              <button
                type="button"
                onClick={() => { setIs2faOpen(false); setTwofaCode(''); }}
                className="px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleVerify2FA}
                disabled={isLoggingIn || !twofaCode}
                className={`px-4 py-2 text-sm font-medium text-white rounded-lg ${isLoggingIn || !twofaCode ? 'bg-gray-400 cursor-not-allowed' : 'bg-black hover:bg-gray-800'}`}
              >
                {isLoggingIn ? 'Verifying...' : 'Verify'}
              </button>
            </div>
          </div>
        </div>
      )}
      
      {/* Email Verification Prompt Modal */}
      {showVerificationPrompt && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="bg-white rounded-xl w-full max-w-md p-6 shadow-xl">
            <h3 className="text-lg font-bold text-black mb-2">Email Verification Required</h3>
            <p className="text-sm text-gray-600 mb-4">
              Please verify your email address before logging in. Check your inbox for the verification link.
            </p>
            <p className="text-xs text-gray-500 mb-6">
              Email: <span className="font-medium text-black">{pendingEmail}</span>
            </p>
            
            <div className="flex items-center justify-between gap-3">
              <button
                type="button"
                onClick={() => setShowVerificationPrompt(false)}
                className="px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200"
              >
                Close
              </button>
              
              <button
                type="button"
                onClick={handleResendVerification}
                disabled={isResendingVerification}
                className={`px-4 py-2 text-sm font-medium text-white rounded-lg ${
                  isResendingVerification 
                    ? 'bg-gray-400 cursor-not-allowed' 
                    : 'bg-black hover:bg-gray-800'
                }`}
              >
                {isResendingVerification ? 'Sending...' : 'Resend Email'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Login;


