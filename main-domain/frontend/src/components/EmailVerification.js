import React, { useState, useEffect } from 'react';

const EmailVerification = ({ onVerificationComplete, onBack }) => {
  const [verificationStatus, setVerificationStatus] = useState('loading'); // 'loading', 'success', 'error', 'expired'
  const [message, setMessage] = useState('');
  const [isResending, setIsResending] = useState(false);
  const [email, setEmail] = useState('');
  const [token, setToken] = useState('');
  const [isOriginalBrowser, setIsOriginalBrowser] = useState(false);
  const [broadcastChannel, setBroadcastChannel] = useState(null);

  useEffect(() => {
    // Get email and token from URL parameters
    const urlParams = new URLSearchParams(window.location.search);
    const emailParam = urlParams.get('email');
    const tokenParam = urlParams.get('token');

    if (emailParam && tokenParam) {
      setEmail(emailParam);
      setToken(tokenParam);
      
      // Check if this is the original browser where signup happened
      const pendingSession = localStorage.getItem('pending_verification_session');
      const pendingEmail = localStorage.getItem('pending_verification_email');
      
      if (pendingSession && pendingEmail === emailParam) {
        // This is the original browser - proceed with verification
        setIsOriginalBrowser(true);
        verifyEmail(emailParam, tokenParam);
      } else {
        // This is a different browser - verify here and also notify original browser
        setIsOriginalBrowser(false);
        setVerificationStatus('loading');
        attemptCrossBrowserVerification(emailParam, tokenParam);
      }
    } else {
      setVerificationStatus('error');
      setMessage('Invalid verification link. Please check your email for the correct link.');
    }

    // Cleanup broadcast channel on unmount
    return () => {
      if (broadcastChannel) {
        broadcastChannel.close();
      }
    };
  }, []);

  const attemptCrossBrowserVerification = async (emailAddress, verificationToken) => {
    // Create a BroadcastChannel to communicate with the original browser
    const channel = new BroadcastChannel('jacs_verification');
    setBroadcastChannel(channel);
    
    // Send verification data to original browser (if it's open in same browser)
    channel.postMessage({
      type: 'VERIFY_EMAIL',
      email: emailAddress,
      token: verificationToken
    });

    // Verify the email in this browser (Browser B)
    await verifyEmail(emailAddress, verificationToken);
    
    // Close channel after sending
    setTimeout(() => {
      if (channel) {
        channel.close();
      }
    }, 2000);
  };

  const verifyEmail = async (emailAddress, verificationToken) => {
    try {
      const response = await fetch('/api/auth/verify-email', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          email: emailAddress,
          token: verificationToken
        })
      });

      const data = await response.json();

      if (response.ok) {
        setVerificationStatus('success');
        setMessage(data.message || 'Email verified successfully!');
        
        // Clear verification session
        localStorage.removeItem('pending_verification_session');
        localStorage.removeItem('pending_verification_email');
        
        // Clear any existing session data to prevent logging in to wrong account
        localStorage.removeItem('access_token');
        localStorage.removeItem('refresh_token');
        localStorage.removeItem('token'); // Legacy token key
        localStorage.removeItem('user_role');
        localStorage.removeItem('user_id');
        
        // Store user data for auto-login (only the verified user)
        if (data.user) {
          localStorage.setItem('user_role', data.user.role || 'tenant');
          localStorage.setItem('user_id', data.user.id.toString());
        }
        
        // Only auto-redirect if this is the original browser
        if (isOriginalBrowser) {
          // Call the completion callback after a short delay to auto-redirect
          setTimeout(() => {
            // Clear URL parameters for a clean redirect
            if (window.history && window.history.replaceState) {
              window.history.replaceState({}, document.title, window.location.pathname);
            }
            
            if (onVerificationComplete) {
              onVerificationComplete(data.user);
            } else {
              // If no callback, redirect to dashboard
              window.location.href = '/';
            }
          }, 2000);
        }
        // If it's a different browser, just show the success message
        // The original browser will detect verification via polling
      } else {
        setVerificationStatus('error');
        setMessage(data.error || 'Email verification failed. Please try again.');
      }
    } catch (error) {
      console.error('Email verification error:', error);
      setVerificationStatus('error');
      setMessage('An error occurred during email verification. Please try again.');
    }
  };

  const resendVerificationEmail = async () => {
    if (!email) {
      setMessage('Email address not found. Please register again.');
      return;
    }

    setIsResending(true);
    try {
      const response = await fetch('/api/auth/resend-verification', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ email })
      });

      const data = await response.json();

      if (response.ok) {
        setMessage('Verification email sent! Please check your inbox.');
      } else {
        setMessage(data.error || 'Failed to resend verification email.');
      }
    } catch (error) {
      console.error('Resend verification error:', error);
      setMessage('An error occurred while sending verification email.');
    } finally {
      setIsResending(false);
    }
  };

  const renderContent = () => {
    switch (verificationStatus) {
      case 'loading':
        return (
          <div className="text-center">
            <div className="animate-spin rounded-full h-12 w-12 border-4 border-gray-200 border-t-black mx-auto mb-6"></div>
            <h2 className="text-2xl font-bold text-black mb-2">Verifying Your Email</h2>
            <p className="text-gray-600">Please wait while we verify your email address...</p>
          </div>
        );

      case 'success':
        return (
          <div className="text-center">
            <div className="mx-auto flex items-center justify-center h-16 w-16 rounded-full bg-black mb-6">
              <svg className="h-8 w-8 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7"></path>
              </svg>
            </div>
            <h2 className="text-2xl font-bold text-black mb-2">Email Verified!</h2>
            <p className="text-gray-600 mb-4">{message}</p>
            {isOriginalBrowser ? (
              <p className="text-sm text-gray-500">You can close this tab and go back to your original browser.</p>
            ) : (
              <div className="space-y-4">
                <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                  <p className="text-sm text-blue-800 font-medium mb-2">
                    ✅ Verification Complete!
                  </p>
                  <p className="text-sm text-blue-700">
                    Please return to the browser where you signed up. 
                    You can close this tab and go back to your original browser.
                  </p>
                </div>
              </div>
            )}
          </div>
        );

      case 'error':
        return (
          <div className="text-center">
            <div className="mx-auto flex items-center justify-center h-16 w-16 rounded-full bg-black mb-6">
              <svg className="h-8 w-8 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12"></path>
              </svg>
            </div>
            <h2 className="text-2xl font-bold text-black mb-2">Verification Failed</h2>
            <p className="text-gray-600 mb-6">{message}</p>
            
            <div className="space-y-3">
              {email && (
                <button
                  onClick={resendVerificationEmail}
                  disabled={isResending}
                  className="w-full flex justify-center py-3 px-4 border border-black rounded-md text-sm font-medium text-white bg-black hover:bg-gray-800 focus:outline-none focus:ring-2 focus:ring-black disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {isResending ? (
                    <>
                      <div className="animate-spin rounded-full h-4 w-4 border-2 border-white border-t-transparent mr-2"></div>
                      Sending...
                    </>
                  ) : (
                    'Resend Verification Email'
                  )}
                </button>
              )}
              
              {onBack && (
                <button
                  onClick={onBack}
                  className="w-full flex justify-center py-3 px-4 border border-black rounded-md text-sm font-medium text-black bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-black"
                >
                  Back to Login
                </button>
              )}
            </div>
          </div>
        );

      default:
        return null;
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-md w-full space-y-8">
        <div className="bg-white py-8 px-6 shadow-lg rounded-lg border border-gray-200">
          <div className="text-center mb-6">
            <h1 className="text-xl font-bold text-black">JACS Cebu Property Management</h1>
          </div>
          {renderContent()}
        </div>
      </div>
    </div>
  );
};

export default EmailVerification;
