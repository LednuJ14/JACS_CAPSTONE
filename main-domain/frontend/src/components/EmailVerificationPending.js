import React, { useState, useEffect } from 'react';

const EmailVerificationPending = ({ email, onResendEmail, onBackToLogin, onVerificationReceived }) => {
  const [isResending, setIsResending] = useState(false);
  const [message, setMessage] = useState('');
  const [messageType, setMessageType] = useState(''); // 'success' or 'error'
  const [broadcastChannel, setBroadcastChannel] = useState(null);

  // Set up BroadcastChannel listener to receive verification from other browser tabs (same browser)
  useEffect(() => {
    const channel = new BroadcastChannel('jacs_verification');
    setBroadcastChannel(channel);

    channel.onmessage = async (event) => {
      if (event.data.type === 'VERIFY_EMAIL' && event.data.email === email) {
        // Verification received from another browser tab - verify in this browser
        setMessage('Verification link received! Verifying your email...');
        setMessageType('success');
        
        try {
          const response = await fetch('/api/auth/verify-email', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              email: event.data.email,
              token: event.data.token
            })
          });

          const data = await response.json();

          if (response.ok) {
            setMessage('Email verified successfully! Redirecting...');
            setMessageType('success');
            
            // Clear verification session
            localStorage.removeItem('pending_verification_session');
            localStorage.removeItem('pending_verification_email');
            
            // Call the verification complete callback
            if (onVerificationReceived) {
              setTimeout(() => {
                onVerificationReceived(data.user);
              }, 1500);
            }
          } else {
            setMessage(data.error || 'Email verification failed. Please try again.');
            setMessageType('error');
          }
        } catch (error) {
          console.error('Email verification error:', error);
          setMessage('An error occurred during email verification. Please try again.');
          setMessageType('error');
        }
      }
    };

    // Cleanup on unmount
    return () => {
      if (channel) {
        channel.close();
      }
    };
  }, [email, onVerificationReceived]);

  // Poll server to check if email has been verified (for cross-browser verification)
  useEffect(() => {
    if (!email) return;

    let pollCount = 0;
    const maxPolls = 100; // Poll for up to 5 minutes (100 * 3 seconds)

    // Poll every 3 seconds to check if email is verified
    const pollInterval = setInterval(async () => {
      pollCount++;
      
      // Stop polling after max attempts
      if (pollCount > maxPolls) {
        clearInterval(pollInterval);
        return;
      }

      try {
        const response = await fetch(`/api/auth/check-verification-status?email=${encodeURIComponent(email)}`, {
          method: 'GET',
          headers: {
            'Content-Type': 'application/json',
          }
        });

        if (response.ok) {
          const data = await response.json();
          if (data.verified && data.user) {
            // Email has been verified! Redirect user
            clearInterval(pollInterval);
            setMessage('Email verified successfully! Redirecting to login...');
            setMessageType('success');
            
            // Clear any existing session data first to prevent logging in to wrong account
            localStorage.removeItem('access_token');
            localStorage.removeItem('refresh_token');
            localStorage.removeItem('token'); // Legacy token key
            localStorage.removeItem('user_role');
            localStorage.removeItem('user_id');
            
            // Clear verification session
            localStorage.removeItem('pending_verification_session');
            localStorage.removeItem('pending_verification_email');
            
            // Store verified email to show success message on login page
            if (data.user && data.user.email) {
              localStorage.setItem('verified_email', data.user.email);
            }
            
            // Call the verification complete callback to redirect to login
            if (onVerificationReceived) {
              setTimeout(() => {
                onVerificationReceived(data.user);
              }, 1500);
            }
          }
        }
      } catch (error) {
        // Silently handle errors - don't spam user with error messages
        // Only log occasionally to avoid console spam
        if (pollCount % 10 === 0) {
          console.log('Waiting for email verification...');
        }
      }
    }, 3000); // Poll every 3 seconds

    // Cleanup interval on unmount
    return () => {
      clearInterval(pollInterval);
    };
  }, [email, onVerificationReceived]);

  const handleResendEmail = async () => {
    setIsResending(true);
    setMessage('');
    setMessageType('');

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
        setMessage('Verification email sent successfully! Please check your inbox.');
        setMessageType('success');
        if (onResendEmail) {
          onResendEmail();
        }
      } else {
        setMessage(data.error || 'Failed to resend verification email.');
        setMessageType('error');
      }
    } catch (error) {
      console.error('Resend verification error:', error);
      setMessage('An error occurred while sending verification email.');
      setMessageType('error');
    } finally {
      setIsResending(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-md w-full space-y-8">
        <div className="bg-white py-8 px-6 shadow-lg rounded-lg border border-gray-200">
          <div className="text-center mb-6">
            <h1 className="text-xl font-bold text-black">JACS Cebu Property Management</h1>
          </div>
          
          <div className="text-center">
            {/* Email icon */}
            <div className="mx-auto flex items-center justify-center h-16 w-16 rounded-full bg-black mb-6">
              <svg className="h-8 w-8 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M3 8l7.89 4.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z"></path>
              </svg>
            </div>

            <h2 className="text-2xl font-bold text-black mb-2">Check Your Email</h2>
            <p className="text-gray-600 mb-4">
              We've sent a verification link to:
            </p>
            <p className="text-sm font-medium text-black mb-6 bg-gray-50 py-2 px-3 rounded border">
              {email}
            </p>

            <div className="text-left bg-gray-50 border rounded-lg p-4 mb-6">
              <h3 className="text-sm font-medium text-black mb-3">Next Steps:</h3>
              <ul className="text-sm text-gray-700 space-y-1">
                <li>• Check your email inbox</li>
                <li>• Look for an email from JACS Cebu Property Management</li>
                <li>• Click the verification link in the email</li>
                <li>• If you don't see it, check your spam folder</li>
              </ul>
            </div>

            {/* Active polling indicator */}
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 mb-4">
              <div className="flex items-center justify-center space-x-2">
                <div className="animate-spin rounded-full h-4 w-4 border-2 border-blue-500 border-t-transparent"></div>
                <p className="text-sm text-blue-700">
                  Waiting for email verification... This page will automatically refresh when verified.
                </p>
              </div>
            </div>

            {/* Message display */}
            {message && (
              <div className={`mb-4 p-3 rounded border ${
                messageType === 'success' 
                  ? 'bg-green-50 border-green-200 text-green-700' 
                  : 'bg-red-50 border-red-200 text-red-700'
              }`}>
                <p className="text-sm">{message}</p>
              </div>
            )}

            {/* Action buttons */}
            <div className="space-y-3">
              <button
                onClick={handleResendEmail}
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

              {onBackToLogin && (
                <button
                  onClick={onBackToLogin}
                  className="w-full flex justify-center py-3 px-4 border border-black rounded-md text-sm font-medium text-black bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-black"
                >
                  Back to Login
                </button>
              )}
            </div>

            <div className="mt-6 text-xs text-gray-500">
              <p>Didn't receive the email? Check your spam folder or try resending.</p>
              <p className="mt-1">The verification link will expire in 24 hours.</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default EmailVerificationPending;
