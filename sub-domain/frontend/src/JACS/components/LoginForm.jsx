import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { Eye, EyeOff, CheckCircle, AlertCircle } from 'lucide-react';
import { apiService } from '../../services/api';

const LoginForm = ({ onForgotPassword }) => {
  const navigate = useNavigate();
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [message, setMessage] = useState(null);
  const [formData, setFormData] = useState({
    username: '',
    password: '',
    rememberMe: false
  });
  const [twoFactorToken, setTwoFactorToken] = useState('');
  const [requiresTwoFactor, setRequiresTwoFactor] = useState(false);

  // Load saved credentials on component mount
  useEffect(() => {
    const savedCredentials = localStorage.getItem('savedCredentials');
    if (savedCredentials) {
      try {
        const { username, password, rememberMe, oauthProvider } = JSON.parse(savedCredentials);
        if (rememberMe) {
          setFormData(prev => ({
            ...prev,
            username,
            password,
            rememberMe: true
          }));
          // If it's an OAuth login, show a message
          if (oauthProvider) {
            setMessage({ type: 'success', text: `Welcome back! You were logged in with ${oauthProvider}.` });
          }
        }
      } catch (error) {
        console.error('Error loading saved credentials:', error);
        localStorage.removeItem('savedCredentials');
      }
    }
  }, []);

  const handleInputChange = (field, value) => {
    setFormData(prev => ({ ...prev, [field]: value }));
    // Clear any existing messages when user starts typing
    if (message) {
      setMessage(null);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    // Enhanced validation
    if (!formData.username.trim()) {
      setMessage({ type: 'error', text: 'Please enter your username' });
      return;
    }
    if (!formData.password.trim()) {
      setMessage({ type: 'error', text: 'Please enter your password' });
      return;
    }
    if (formData.password.length < 1) {
      setMessage({ type: 'error', text: 'Password cannot be empty' });
      return;
    }

    setIsLoading(true);
    setMessage(null);

    try {
      if (requiresTwoFactor) {
        // Handle 2FA verification (email-based, like main domain)
        if (!twoFactorToken.trim()) {
          setMessage({ type: 'error', text: 'Please enter your verification code' });
          setIsLoading(false);
          return;
        }

        // Get email from stored user or use username
        const storedUser = apiService.getStoredUser();
        const email = storedUser?.email || localStorage.getItem('pending_2fa_email') || formData.username;
        
        const data = await apiService.verify2FA(email, twoFactorToken);
        setMessage({ type: 'success', text: 'Login successful! Welcome back!' });
        console.log('Login successful:', data);

        // Clear pending 2FA email
        localStorage.removeItem('pending_2fa_email');

        // Handle Remember Me functionality
        if (formData.rememberMe) {
          localStorage.setItem('savedCredentials', JSON.stringify({
            username: formData.username,
            password: formData.password,
            rememberMe: true
          }));
        } else {
          localStorage.removeItem('savedCredentials');
        }

        // Clear form and reset 2FA state
        setFormData(prev => ({ ...prev, username: '', password: '', rememberMe: false }));
        setTwoFactorToken('');
        setRequiresTwoFactor(false);

        // Redirect based on role from backend
        setTimeout(() => {
          const user = apiService.getStoredUser();
          if (user?.role === 'tenant') {
            navigate('/tenant');
          } else if (user?.role === 'staff') {
            navigate('/staff');
          } else if (user?.role === 'property_manager') {
            navigate('/dashboard');
          } else {
            navigate('/dashboard'); // Default fallback
          }
        }, 1500);
      } else {
        // Initial login attempt
        try {
          const data = await apiService.login(formData.username, formData.password, undefined);
          
          // Check if response indicates 2FA is required
          if (data.status === 'pending_2fa') {
            setRequiresTwoFactor(true);
            // Store email for 2FA verification
            const email = data.email || formData.username;
            localStorage.setItem('pending_2fa_email', email);
            setMessage({ type: 'info', text: 'Verification code sent to your email. Please enter the code to continue.' });
            setIsLoading(false);
            return;
          }
          
          setMessage({ type: 'success', text: 'Login successful! Welcome back!' });
          console.log('Login successful:', data);

          // Handle Remember Me functionality
          if (formData.rememberMe) {
            localStorage.setItem('savedCredentials', JSON.stringify({
              username: formData.username,
              password: formData.password,
              rememberMe: true
            }));
          } else {
            localStorage.removeItem('savedCredentials');
          }

          // Clear form after successful login
          setFormData(prev => ({ ...prev, username: '', password: '', rememberMe: false }));

          // Redirect based on role from backend
          setTimeout(() => {
            const user = apiService.getStoredUser();
            if (user?.role === 'tenant') {
              navigate('/tenant');
            } else if (user?.role === 'staff') {
              navigate('/staff');
            } else if (user?.role === 'property_manager') {
              navigate('/dashboard');
            } else {
              navigate('/dashboard'); // Default fallback
            }
          }, 1500);
        } catch (error) {
          // Check if 2FA is required
          const errorMessage = error instanceof Error ? error.message : String(error);
          if (errorMessage === '2FA_REQUIRED' || errorMessage.includes('pending_2fa')) {
            setRequiresTwoFactor(true);
            // Store email for 2FA verification
            const email = formData.username; // Use username as email
            localStorage.setItem('pending_2fa_email', email);
            setMessage({ type: 'info', text: 'Verification code sent to your email. Please enter the code to continue.' });
          } else {
            throw error; // Re-throw other errors
          }
        }
      }
    } catch (error) {
      console.error('Login error:', error);
      const errorMessage = error instanceof Error ? error.message : String(error);
      if (!requiresTwoFactor) {
        setMessage({ type: 'error', text: 'Login failed. Please check your credentials and try again.' });
      } else {
        setMessage({ type: 'error', text: 'Invalid verification code. Please try again.' });
      }
      // Clear password field on error
      setFormData(prev => ({ ...prev, password: '' }));
    } finally {
      setIsLoading(false);
    }
  };

  

  

  return (
    <div className="w-full max-w-sm mx-auto">
      {/* Header */}
      <div className="mb-8 text-center">
        <h1 className="text-2xl font-semibold text-gray-900">Welcome back</h1>
        <p className="text-sm text-gray-500 mt-1">Sign in to continue to your dashboard</p>
      </div>

      {/* Simple Message Display */}
      {message && (
        <div className={`p-4 rounded-lg border mb-6 ${
          message.type === 'success' ? 'bg-green-50 border-green-200 text-green-800' :
          message.type === 'error' ? 'bg-red-50 border-red-200 text-red-800' :
          'bg-blue-50 border-blue-200 text-blue-800'
        }`}>
          <div className="flex items-center">
            {message.type === 'success' ? (
              <CheckCircle className="h-5 w-5 mr-2 text-green-600" />
            ) : message.type === 'error' ? (
              <AlertCircle className="h-5 w-5 mr-2 text-red-600" />
            ) : (
              <AlertCircle className="h-5 w-5 mr-2 text-blue-600" />
            )}
            <span className="font-medium">{message.text}</span>
          </div>
        </div>
      )}

      {/* Simple Login Form */}
      <form onSubmit={handleSubmit} className="space-y-6 bg-white/80 backdrop-blur rounded-2xl border border-gray-100 p-6 shadow-sm">

        <div className="space-y-2">
          <Input
            id="username"
            type="text"
            placeholder="Enter Username"
            value={formData.username}
            onChange={(e) => handleInputChange('username', e.target.value)}
            className="h-12 border-gray-300 bg-white"
            required
          />
        </div>

        <div className="space-y-2">
          <div className="relative">
            <Input
              id="password"
              type={showPassword ? "text" : "password"}
              placeholder="Enter Password"
              value={formData.password}
              onChange={(e) => handleInputChange('password', e.target.value)}
              className="h-12 border-gray-300 bg-white pr-10"
              required
            />
            <button
              type="button"
              onClick={() => setShowPassword(!showPassword)}
              className="absolute right-3 top-1/2 transform -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
            >
              {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
            </button>
          </div>
        </div>

        {/* 2FA Token Input - Email-based (like main domain) */}
        {requiresTwoFactor && (
          <div className="space-y-2">
            <Label htmlFor="twoFactorToken" className="text-muted-foreground text-left block">
              Verification Code
            </Label>
            <Input
              id="twoFactorToken"
              type="text"
              placeholder="Enter 6-digit code"
              value={twoFactorToken}
              onChange={(e) => setTwoFactorToken(e.target.value)}
              className="h-12 border-input bg-background"
              maxLength={6}
              required
            />
            <p className="text-sm text-gray-600">
              Enter the 6-digit code sent to your email
            </p>
          </div>
        )}

        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <Checkbox
              id="remember"
              checked={formData.rememberMe}
              onCheckedChange={(checked) => handleInputChange('rememberMe', checked)}
            />
            <Label htmlFor="remember" className="text-sm text-muted-foreground">
              Remember Me
            </Label>
          </div>
          <button
            type="button"
            onClick={onForgotPassword}
            className="text-sm text-gray-600 hover:text-black transition-colors"
          >
            Forgot Password?
          </button>
        </div>

        <Button
          type="submit"
          className="w-full h-12 bg-black hover:bg-black/90 text-white font-medium rounded-lg transition-all duration-300 shadow-sm"
          disabled={isLoading}
        >
          {isLoading ? 'LOGGING IN...' : 'LOGIN'}
        </Button>

        <p className="text-xs text-center text-gray-400">By continuing, you agree to the Terms and Privacy Policy</p>
      </form>

      
    </div>
  );
};

export default LoginForm;
