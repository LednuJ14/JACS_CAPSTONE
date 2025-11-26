import React, { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Eye, EyeOff, CheckCircle, AlertCircle, Lock } from 'lucide-react';
import Logo from './Logo';
import { useSearchParams } from 'react-router-dom';

const ResetPassword = ({ onSuccess }) => {
  const [searchParams] = useSearchParams();
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);
  const [message, setMessage] = useState(null);
  const [formData, setFormData] = useState({
    password: '',
    confirmPassword: ''
  });

  const token = searchParams.get('token');

  useEffect(() => {
    if (!token) {
      setMessage({ type: 'error', text: 'Invalid reset link. Please request a new password reset.' });
    }
  }, [token]);

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (!token) {
      setMessage({ type: 'error', text: 'Invalid reset link. Please request a new password reset.' });
      return;
    }

    if (formData.password !== formData.confirmPassword) {
      setMessage({ type: 'error', text: 'Passwords do not match.' });
      return;
    }

    if (formData.password.length < 8) {
      setMessage({ type: 'error', text: 'Password must be at least 8 characters long.' });
      return;
    }

    setIsLoading(true);
    setMessage(null);

    try {
      // Static success without network
      setTimeout(() => {
        setIsSuccess(true);
        setMessage({ type: 'success', text: 'Password reset successfully!' });
        setIsLoading(false);
      }, 600);
    } catch (error) {
      setMessage({ type: 'error', text: 'Something went wrong.' });
      setIsLoading(false);
    }
  };

  const handleInputChange = (field, value) => {
    setFormData(prev => ({
      ...prev,
      [field]: value
    }));

    if (message) setMessage(null);
  };

  if (isSuccess) {
    return (
      <div className="w-full max-w-md mx-auto p-8">
        {/* Logo */}
        <div className="flex justify-center mb-8">
          <Logo variant="dark" />
        </div>

        {/* Success State */}
        <div className="text-center space-y-6">
          <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto">
            <CheckCircle className="h-8 w-8 text-green-600" />
          </div>
          <h1 className="text-2xl font-semibold text-foreground mb-2">
            Password Reset Successfully!
          </h1>
          <p className="text-muted-foreground">
            Your password has been updated. You can now log in with your new password.
          </p>
        </div>

        <Button
          onClick={onSuccess}
          className="w-full h-12 bg-jacs-dark hover:bg-jacs-dark/90 text-white font-medium rounded-lg transition-all duration-300"
        >
          Go to Login
        </Button>
      </div>
    );
  }

  if (!token) {
    return (
      <div className="w-full max-w-md mx-auto p-8">
        {/* Logo */}
        <div className="flex justify-center mb-8">
          <Logo variant="dark" />
        </div>

        {/* Error State */}
        <div className="text-center space-y-6">
          <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mx-auto">
            <AlertCircle className="h-8 w-8 text-red-600" />
          </div>
          <h1 className="text-2xl font-semibold text-foreground mb-2">
            Invalid Reset Link
          </h1>
          <p className="text-muted-foreground">
            This password reset link is invalid or has expired. Please request a new one.
          </p>
        </div>

        <Button
          onClick={onSuccess}
          className="w-full h-12 bg-jacs-dark hover:bg-jacs-dark/90 text-white font-medium rounded-lg transition-all duration-300"
        >
          Back to Login
        </Button>
      </div>
    );
  }

  return (
    <div className="w-full max-w-md mx-auto p-8">
      {/* Logo */}
      <div className="flex justify-center mb-8">
        <Logo variant="dark" />
      </div>

      {/* Reset Password Title */}
      <div className="text-center mb-8">
        <div className="w-16 h-16 bg-blue-100 rounded-full flex items-center justify-center mx-auto mb-4">
          <Lock className="h-8 w-8 text-blue-600" />
        </div>
        <h1 className="text-2xl font-semibold text-foreground">Reset Your Password</h1>
        <p className="text-sm text-muted-foreground mt-2">
          Enter your new password below
        </p>
      </div>

      {/* Message Display */}
      {message && (
        <div className={`mb-6 p-4 rounded-lg ${
          message.type === 'success'
            ? 'bg-green-50 border border-green-200 text-green-800'
            : 'bg-red-50 border border-red-200 text-red-800'
        }`}>
          <div className="flex items-center">
            {message.type === 'success' ? (
              <CheckCircle className="h-5 w-5 mr-2" />
            ) : (
              <AlertCircle className="h-5 w-5 mr-2" />
            )}
            {message.text}
          </div>
        </div>
      )}

      {/* Reset Password Form */}
      <form onSubmit={handleSubmit} className="space-y-6">
        <div className="space-y-2">
          <Label htmlFor="password" className="text-sm text-muted-foreground">
            New Password
          </Label>
          <div className="relative">
            <Input
              id="password"
              type={showPassword ? "text" : "password"}
              placeholder="Enter new password"
              value={formData.password}
              onChange={(e) => handleInputChange('password', e.target.value)}
              className="h-12 border-input bg-background pr-10"
              required
              minLength={8}
            />
            <button
              type="button"
              onClick={() => setShowPassword(!showPassword)}
              className="absolute right-3 top-1/2 transform -translate-y-1/2 text-muted-foreground hover:text-foreground"
            >
              {showPassword ? <EyeOff size={20} /> : <Eye size={20} />}
            </button>
          </div>
        </div>

        <div className="space-y-2">
          <Label htmlFor="confirmPassword" className="text-sm text-muted-foreground">
            Confirm New Password
          </Label>
          <div className="relative">
            <Input
              id="confirmPassword"
              type={showConfirmPassword ? "text" : "password"}
              placeholder="Confirm new password"
              value={formData.confirmPassword}
              onChange={(e) => handleInputChange('confirmPassword', e.target.value)}
              className="h-12 border-input bg-background pr-10"
              required
              minLength={8}
            />
            <button
              type="button"
              onClick={() => setShowConfirmPassword(!showConfirmPassword)}
              className="absolute right-3 top-1/2 transform -translate-y-1/2 text-muted-foreground hover:text-foreground"
            >
              {showConfirmPassword ? <EyeOff size={20} /> : <Eye size={20} />}
            </button>
          </div>
        </div>

        {/* Submit Button */}
        <Button
          type="submit"
          className="w-full h-12 bg-jacs-dark hover:bg-jacs-dark/90 text-white font-medium rounded-lg transition-all duration-300"
          disabled={isLoading}
        >
          {isLoading ? 'RESETTING...' : 'Reset Password'}
        </Button>

        {/* Back to Login Link */}
        <div className="text-center">
          <span className="text-muted-foreground">Remember your password? </span>
          <button
            type="button"
            onClick={onSuccess}
            className="text-jacs-accent hover:text-jacs-accent/80 font-medium transition-colors"
          >
            Back to Login
          </button>
        </div>
      </form>
    </div>
  );
};

export default ResetPassword;
