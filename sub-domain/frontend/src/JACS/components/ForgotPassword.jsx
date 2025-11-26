import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { ArrowLeft, Mail, CheckCircle, AlertCircle } from 'lucide-react';
import { apiService } from '../../services/api';
import Logo from './Logo';

const ForgotPassword = ({ onBack }) => {
  const [email, setEmail] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);
  const [error, setError] = useState(null);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!email.trim()) {
      setError('Please enter your email address');
      return;
    }

    setIsLoading(true);
    setError(null);
    
    try {
      const response = await fetch('http://localhost:5000/api/auth/forgot-password', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ email: email.trim() })
      });
      
      const data = await response.json();
      
      if (response.ok) {
        setIsSuccess(true);
      } else {
        setError(data.error || 'Failed to send reset email. Please try again.');
      }
    } catch (error) {
      console.error('Forgot password error:', error);
      setError('Network error. Please check your connection and try again.');
    } finally {
      setIsLoading(false);
    }
  };

  if (isSuccess) {
    return (
      <div className="w-full max-w-md mx-auto p-8">
        {/* Logo */}
        <div className="flex justify-end mb-8">
          <Logo variant="dark" />
        </div>

        {/* Success State */}
        <div className="text-center space-y-6">
          <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto">
            <CheckCircle className="h-8 w-8 text-green-600" />
          </div>
          <h1 className="text-2xl font-semibold text-foreground mb-2">
            Check Your Email
          </h1>
          <p className="text-muted-foreground">
            We've sent a password reset link to <strong>{email}</strong>
          </p>
        </div>

        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 text-left">
          <h3 className="font-medium text-blue-900 mb-2">What to do next:</h3>
          <ol className="text-sm text-blue-800 space-y-1">
            <li>1. Check your Gmail inbox</li>
            <li>2. Look for an email from JACS</li>
            <li>3. Click the password reset link</li>
            <li>4. Create a new password</li>
          </ol>
        </div>

        <Button
          onClick={() => {
            setIsSuccess(false);
            setEmail('');
            setError(null);
          }}
          className="w-full h-12 bg-jacs-dark hover:bg-jacs-dark/90 text-white font-medium rounded-lg transition-all duration-300"
        >
          Send Another Email
        </Button>

        <Button
          variant="outline"
          onClick={onBack}
          className="w-full h-12 border-2 hover:bg-muted transition-all duration-300"
        >
          Back to Login
        </Button>
      </div>
    );
  }

  return (
    <div className="w-full max-w-md mx-auto p-8">
      {/* Header with Back Button and Logo */}
      <div className="flex justify-between items-center mb-8">
        <button
          onClick={onBack}
          className="p-2 hover:bg-muted rounded-lg transition-colors"
        >
          <ArrowLeft size={20} className="text-muted-foreground" />
        </button>
        <Logo variant="dark" />
      </div>

      {/* Forgot Password Title */}
      <div className="text-center mb-8">
        <h1 className="text-2xl font-semibold text-foreground">Forgot Password</h1>
        <p className="text-sm text-muted-foreground mt-2">
          Enter your email address and we'll send you a link to reset your password
        </p>
      </div>

      {/* Error Message */}
      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg mb-4 flex items-center">
          <AlertCircle className="w-5 h-5 mr-2" />
          <span>{error}</span>
        </div>
      )}

      {/* Forgot Password Form */}
      <form onSubmit={handleSubmit} className="space-y-6">
        <div className="space-y-2">
          <Label htmlFor="email" className="text-sm text-muted-foreground text-left block">
            Email Address
          </Label>
          <div className="relative">
            <Input
              id="email"
              type="email"
              placeholder="Enter your email address"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="h-12 border-input bg-background pl-10"
              required
            />
            <Mail className="absolute left-3 top-1/2 transform -translate-y-1/2 h-5 w-5 text-muted-foreground" />
          </div>
        </div>

        {/* Submit Button */}
        <Button
          type="submit"
          className="w-full h-12 bg-jacs-dark hover:bg-jacs-dark/90 text-white font-medium rounded-lg transition-all duration-300"
          disabled={isLoading}
        >
          {isLoading ? 'SENDING...' : 'Send Reset Link'}
        </Button>

        {/* Back to Login Link */}
        <div className="text-center">
          <span className="text-muted-foreground">Remember your password? </span>
          <button
            type="button"
            onClick={onBack}
            className="text-jacs-accent hover:text-jacs-accent/80 font-medium transition-colors"
          >
            Back to Login
          </button>
        </div>
      </form>
    </div>
  );
};

export default ForgotPassword;
