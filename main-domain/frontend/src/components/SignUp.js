import React, { useState, useEffect } from 'react';
import ApiService from '../services/api';

const SignUp = ({ onSignUpSuccess, onBackToLogin }) => {
  const [formData, setFormData] = useState({
    firstName: '',
    lastName: '',
    email: '',
    username: '',
    password: '',
    confirmPassword: '',
    phone: '',
    dateOfBirth: '',
    address: ''
  });
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [agreeToTerms, setAgreeToTerms] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [role, setRole] = useState(''); // 'tenant' | 'manager' | 'admin'
  const [isLoaded, setIsLoaded] = useState(false);
  const [currentStep, setCurrentStep] = useState(0); // Start with role selection
  const [passwordStrength, setPasswordStrength] = useState({
    score: 0,
    feedback: [],
    isValid: false
  });
  // const [showPasswordStrength] = useState(false); // Removed unused variable

  // Trigger animations on component mount
  useEffect(() => {
    const timer = setTimeout(() => setIsLoaded(true), 100);
    return () => clearTimeout(timer);
  }, []);

  // Password strength validation function
  const validatePasswordStrength = (password) => {
    const feedback = [];
    let score = 0;
    
    // Length check
    if (password.length >= 8) {
      score += 1;
    } else {
      feedback.push('At least 8 characters');
    }
    
    // Uppercase letter
    if (/[A-Z]/.test(password)) {
      score += 1;
    } else {
      feedback.push('One uppercase letter');
    }
    
    // Lowercase letter
    if (/[a-z]/.test(password)) {
      score += 1;
    } else {
      feedback.push('One lowercase letter');
    }
    
    // Number
    if (/[0-9]/.test(password)) {
      score += 1;
    } else {
      feedback.push('One number');
    }
    
    // Special character
    if (/[^A-Za-z0-9]/.test(password)) {
      score += 1;
    } else {
      feedback.push('One special character');
    }
    
    // Common patterns check
    if (password.length > 0) {
      const commonPatterns = ['123', 'password', 'admin', 'user', 'qwerty'];
      if (commonPatterns.some(pattern => password.toLowerCase().includes(pattern))) {
        feedback.push('Avoid common patterns');
        score = Math.max(0, score - 1);
      }
    }
    
    const strengthLevels = {
      0: { label: 'Very Weak', color: 'text-red-600', bgColor: 'bg-red-500' },
      1: { label: 'Weak', color: 'text-red-500', bgColor: 'bg-red-400' },
      2: { label: 'Fair', color: 'text-yellow-500', bgColor: 'bg-yellow-400' },
      3: { label: 'Good', color: 'text-blue-500', bgColor: 'bg-blue-400' },
      4: { label: 'Strong', color: 'text-green-500', bgColor: 'bg-green-400' },
      5: { label: 'Very Strong', color: 'text-green-600', bgColor: 'bg-green-500' }
    };
    
    return {
      score,
      feedback,
      isValid: score >= 3, // Require at least "Good" strength
      strength: strengthLevels[score] || strengthLevels[0],
      percentage: (score / 5) * 100
    };
  };

  const handleInputChange = (field, value) => {
    setFormData(prev => ({ ...prev, [field]: value }));
    
    // Real-time password strength validation
    if (field === 'password') {
      const strength = validatePasswordStrength(value);
      setPasswordStrength(strength);
    }
    
    // Clear error when user starts typing
    if (errorMessage) setErrorMessage('');
  };

  const validateStep = (step) => {
    switch (step) {
      case 0:
        if (!role) {
          setErrorMessage('Please select your account type.');
          return false;
        }
        break;
      case 1:
        if (!formData.firstName || !formData.lastName || !formData.email) {
          setErrorMessage('Please fill in all required fields for Step 1.');
          return false;
        }
        if (!/\S+@\S+\.\S+/.test(formData.email)) {
          setErrorMessage('Please enter a valid email address.');
          return false;
        }
        break;
      case 2:
        if (!formData.password || !formData.confirmPassword) {
          setErrorMessage('Please fill in all required fields for Step 2.');
          return false;
        }
        if (formData.password !== formData.confirmPassword) {
          setErrorMessage('Passwords do not match.');
          return false;
        }
        if (!passwordStrength.isValid) {
          setErrorMessage('Password does not meet strength requirements. Please create a stronger password.');
          return false;
        }
        break;
      case 3:
        if (!agreeToTerms) {
          setErrorMessage('Please agree to the Terms and Conditions.');
          return false;
        }
        break;
      default:
        setErrorMessage('Invalid step.');
        return false;
    }
    setErrorMessage('');
    return true;
  };

  const handleNext = () => {
    if (validateStep(currentStep)) {
      setCurrentStep(currentStep + 1);
    }
  };

  const handlePrevious = () => {
    setCurrentStep(currentStep - 1);
    setErrorMessage('');
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    
    if (!validateStep(3)) return;

    setErrorMessage('');
    setIsSubmitting(true);

    try {
      // Prepare data for backend API
      const registrationData = {
        email: formData.email,
        password: formData.password,
        first_name: formData.firstName,
        last_name: formData.lastName,
        role: role.toLowerCase(), // Backend expects tenant, manager, admin
        phone_number: formData.phone || undefined,
        date_of_birth: formData.dateOfBirth || undefined
      };

      // Make API call using ApiService
      const data = await ApiService.register(registrationData);

      // Registration successful
      console.log('Registration successful:', data);
      
      // Call the success callback
      if (typeof onSignUpSuccess === 'function') {
        onSignUpSuccess({ 
          ...formData, 
          role,
          agreeToTerms,
          userId: data.user?.id,
          message: data.message
        });
      }
    } catch (error) {
      console.error('Registration error:', error);
      
      let errorMsg = 'Registration failed. Please try again.';
      
      if (error.isNetworkError) {
        errorMsg = 'Unable to connect to server. Please check your internet connection and try again.';
      } else if (error.status === 400) {
        if (error.message.includes('Email already exists')) {
          errorMsg = 'An account with this email already exists. Please use a different email or try logging in.';
        } else if (error.message.includes('Weak password')) {
          errorMsg = `Password is too weak. Please use a stronger password with letters, numbers, and special characters.`;
        } else if (error.message.includes('Missing required fields')) {
          errorMsg = 'Please fill in all required fields.';
        } else {
          errorMsg = error.message;
        }
      } else if (error.status === 429) {
        errorMsg = 'Too many registration attempts. Please wait a moment and try again.';
      } else if (error.message) {
        errorMsg = error.message;
      }
      
      setErrorMessage(errorMsg);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleBackToLogin = () => {
    if (typeof onBackToLogin === 'function') {
      onBackToLogin();
    }
  };

  const renderStepIndicator = () => (
    <div className="flex items-center justify-center mb-8">
      {[0, 1, 2, 3].map((step) => (
        <div key={step} className="flex items-center">
          <div 
            className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold transition-all duration-300 ${
              step <= currentStep 
                ? 'bg-black text-white scale-110' 
                : 'bg-gray-200 text-gray-500'
            }`}
          >
            {step < currentStep ? (
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
            ) : (
              step + 1
            )}
          </div>
          {step < 3 && (
            <div 
              className={`w-12 h-0.5 mx-2 transition-all duration-300 ${
                step < currentStep ? 'bg-black' : 'bg-gray-200'
              }`}
            />
          )}
        </div>
      ))}
    </div>
  );

  const renderStep0 = () => (
    <div 
      className={`space-y-6 transform transition-all duration-800 ease-out ${
        currentStep === 0 ? 'translate-x-0 opacity-100' : 'translate-x-8 opacity-0 absolute'
      }`}
    >
      <div className="text-center">
        <h3 className="text-xl font-bold text-gray-900 mb-2">Choose Your Account Type</h3>
        <p className="text-gray-600 text-sm">Select the option that best describes you</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Tenant Option */}
        <div 
          onClick={() => {
            setRole('tenant');
            setErrorMessage('');
          }}
          className={`relative p-4 border-2 rounded-xl cursor-pointer transition-all duration-300 transform hover:scale-105 hover:shadow-lg ${
            role === 'tenant' 
              ? 'border-black bg-black text-white shadow-xl scale-105' 
              : 'border-gray-300 bg-white text-gray-900 hover:border-gray-400'
          }`}
        >
          <div className="text-center">
            <div className={`w-12 h-12 mx-auto mb-3 rounded-full flex items-center justify-center ${
              role === 'tenant' ? 'bg-white text-black' : 'bg-gray-100 text-gray-600'
            }`}>
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
              </svg>
            </div>
            <h4 className="text-lg font-bold">I'm a Tenant</h4>
          </div>
          {role === 'tenant' && (
            <div className="absolute top-2 right-2">
              <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
            </div>
          )}
        </div>

        {/* Manager Option */}
        <div 
          onClick={() => {
            setRole('manager');
            setErrorMessage('');
          }}
          className={`relative p-4 border-2 rounded-xl cursor-pointer transition-all duration-300 transform hover:scale-105 hover:shadow-lg ${
            role === 'manager' 
              ? 'border-black bg-black text-white shadow-xl scale-105' 
              : 'border-gray-300 bg-white text-gray-900 hover:border-gray-400'
          }`}
        >
          <div className="text-center">
            <div className={`w-12 h-12 mx-auto mb-3 rounded-full flex items-center justify-center ${
              role === 'manager' ? 'bg-white text-black' : 'bg-gray-100 text-gray-600'
            }`}>
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
              </svg>
            </div>
            <h4 className="text-lg font-bold">I'm a Property Manager</h4>
          </div>
          {role === 'manager' && (
            <div className="absolute top-2 right-2">
              <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
            </div>
          )}
        </div>
      </div>

    </div>
  );

  const renderStep1 = () => (
    <div 
      className={`space-y-6 transform transition-all duration-800 ease-out ${
        currentStep === 1 ? 'translate-x-0 opacity-100' : currentStep > 1 ? '-translate-x-8 opacity-0 absolute' : 'translate-x-8 opacity-0 absolute'
      }`}
    >
      <div className="text-center">
        <h3 className="text-xl font-bold text-gray-900 mb-2">Personal Information</h3>
        <p className="text-gray-600 text-sm">Let's start with your basic details</p>
      </div>

      {/* Name Fields */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-semibold text-gray-700 mb-2">First Name *</label>
          <input
            type="text"
            value={formData.firstName}
            onChange={(e) => handleInputChange('firstName', e.target.value)}
            placeholder="Enter your first name"
            className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-black focus:border-transparent transition-all duration-200 transform focus:scale-105 hover:shadow-md"
          />
        </div>
        <div>
          <label className="block text-sm font-semibold text-gray-700 mb-2">Last Name *</label>
          <input
            type="text"
            value={formData.lastName}
            onChange={(e) => handleInputChange('lastName', e.target.value)}
            placeholder="Enter your last name"
            className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-black focus:border-transparent transition-all duration-200 transform focus:scale-105 hover:shadow-md"
          />
        </div>
      </div>

      {/* Email Field */}
      <div>
        <label className="block text-sm font-semibold text-gray-700 mb-2">Email Address *</label>
        <div className="relative group">
          <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none transition-all duration-200 group-focus-within:text-black">
            <svg className="h-5 w-5 text-gray-400 group-focus-within:text-black transition-colors" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 12a4 4 0 10-8 0 4 4 0 008 0zm0 0v1.5a2.5 2.5 0 005 0V12a9 9 0 10-9 9m4.5-1.206a8.959 8.959 0 01-4.5 1.207" />
            </svg>
          </div>
          <input
            type="email"
            value={formData.email}
            onChange={(e) => handleInputChange('email', e.target.value)}
            placeholder="Enter your email address"
            className="w-full pl-10 pr-4 py-3 border border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-black focus:border-transparent transition-all duration-200 transform focus:scale-105 hover:shadow-md"
          />
        </div>
      </div>

      {/* Phone Field */}
      <div>
        <label className="block text-sm font-semibold text-gray-700 mb-2">Phone Number</label>
        <div className="relative group">
          <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none transition-all duration-200 group-focus-within:text-black">
            <svg className="h-5 w-5 text-gray-400 group-focus-within:text-black transition-colors" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" />
            </svg>
          </div>
          <input
            type="tel"
            value={formData.phone}
            onChange={(e) => handleInputChange('phone', e.target.value)}
            placeholder="Enter your phone number"
            className="w-full pl-10 pr-4 py-3 border border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-black focus:border-transparent transition-all duration-200 transform focus:scale-105 hover:shadow-md"
          />
        </div>
      </div>
    </div>
  );

  const renderStep2 = () => (
    <div 
      className={`space-y-6 transform transition-all duration-800 ease-out ${
        currentStep === 2 ? 'translate-x-0 opacity-100' : currentStep > 2 ? '-translate-x-8 opacity-0 absolute' : 'translate-x-8 opacity-0 absolute'
      }`}
    >
      <div className="text-center">
        <h3 className="text-xl font-bold text-gray-900 mb-2">Account Setup</h3>
        <p className="text-gray-600 text-sm">Create your login credentials</p>
      </div>


      {/* Password Field */}
      <div>
        <label className="block text-sm font-semibold text-gray-700 mb-2">Password *</label>
        <div className="relative group">
          <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none transition-all duration-200 group-focus-within:text-black">
            <svg className="h-5 w-5 text-gray-400 group-focus-within:text-black transition-colors" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
            </svg>
          </div>
          <input
            type={showPassword ? 'text' : 'password'}
            value={formData.password}
            onChange={(e) => handleInputChange('password', e.target.value)}
            placeholder="Create a password"
            className="w-full pl-10 pr-12 py-3 border border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-black focus:border-transparent transition-all duration-200 transform focus:scale-105 hover:shadow-md"
          />
          <button
            type="button"
            onClick={() => setShowPassword(!showPassword)}
            className="absolute inset-y-0 right-0 pr-3 flex items-center text-gray-400 hover:text-gray-600 transition-all duration-200 transform hover:scale-110"
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

      {/* Confirm Password Field */}
      <div>
        <label className="block text-sm font-semibold text-gray-700 mb-2">Confirm Password *</label>
        <div className="relative group">
          <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none transition-all duration-200 group-focus-within:text-black">
            <svg className="h-5 w-5 text-gray-400 group-focus-within:text-black transition-colors" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          </div>
          <input
            type={showConfirmPassword ? 'text' : 'password'}
            value={formData.confirmPassword}
            onChange={(e) => handleInputChange('confirmPassword', e.target.value)}
            placeholder="Confirm your password"
            className="w-full pl-10 pr-12 py-3 border border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-black focus:border-transparent transition-all duration-200 transform focus:scale-105 hover:shadow-md"
          />
          <button
            type="button"
            onClick={() => setShowConfirmPassword(!showConfirmPassword)}
            className="absolute inset-y-0 right-0 pr-3 flex items-center text-gray-400 hover:text-gray-600 transition-all duration-200 transform hover:scale-110"
          >
            {showConfirmPassword ? (
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

      {/* Additional Info */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-semibold text-gray-700 mb-2">Date of Birth</label>
          <input
            type="date"
            value={formData.dateOfBirth}
            onChange={(e) => handleInputChange('dateOfBirth', e.target.value)}
            className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-black focus:border-transparent transition-all duration-200 transform focus:scale-105 hover:shadow-md"
          />
        </div>
        <div>
          <label className="block text-sm font-semibold text-gray-700 mb-2">Address</label>
          <input
            type="text"
            value={formData.address}
            onChange={(e) => handleInputChange('address', e.target.value)}
            placeholder="Enter your address"
            className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-black focus:border-transparent transition-all duration-200 transform focus:scale-105 hover:shadow-md"
          />
        </div>
      </div>
    </div>
  );

  const renderStep3 = () => (
    <div 
      className={`space-y-6 transform transition-all duration-800 ease-out ${
        currentStep === 3 ? 'translate-x-0 opacity-100' : '-translate-x-8 opacity-0 absolute'
      }`}
    >
      <div className="text-center">
        <h3 className="text-xl font-bold text-gray-900 mb-2">Terms & Conditions</h3>
        <p className="text-gray-600 text-sm">Review and agree to our terms to complete registration</p>
      </div>


      {/* Terms and Conditions */}
      <div className="space-y-4">
        <label className="flex items-start space-x-3 cursor-pointer group">
          <input
            type="checkbox"
            checked={agreeToTerms}
            onChange={(e) => setAgreeToTerms(e.target.checked)}
            className="w-4 h-4 text-black border-gray-300 rounded focus:ring-black transition-all duration-200 transform group-hover:scale-110 mt-0.5"
          />
          <span className="text-sm text-gray-700 leading-relaxed group-hover:text-black transition-colors">
            I agree to the{' '}
            <button type="button" className="font-semibold text-black hover:text-gray-700 transition-colors">
              Terms and Conditions
            </button>
            {' '}and{' '}
            <button type="button" className="font-semibold text-black hover:text-gray-700 transition-colors">
              Privacy Policy
            </button>
            . I understand that JACS will use my information to provide property management services.
          </span>
        </label>
      </div>

      {/* Summary */}
      <div className="bg-gray-50 rounded-xl p-4 space-y-2">
        <h4 className="font-semibold text-gray-900 text-sm">Account Summary:</h4>
        <div className="text-sm text-gray-600 space-y-1">
          <p><span className="font-medium">Name:</span> {formData.firstName} {formData.lastName}</p>
          <p><span className="font-medium">Email:</span> {formData.email}</p>
          <p><span className="font-medium">Role:</span> {role.charAt(0).toUpperCase() + role.slice(1)}</p>
        </div>
      </div>
    </div>
  );

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 via-white to-gray-100 flex items-center justify-center p-4">
      {/* Back Button */}
      <button
        onClick={handleBackToLogin}
        className={`fixed top-6 left-6 z-50 flex items-center space-x-2 px-4 py-2 bg-white/90 backdrop-blur-sm rounded-xl border border-gray-200 text-gray-700 hover:bg-white hover:text-black transition-all duration-300 transform hover:scale-105 hover:-translate-y-1 hover:shadow-lg group ${
          isLoaded ? 'translate-x-0 opacity-100' : '-translate-x-8 opacity-0'
        }`}
        style={{ transitionDelay: '200ms' }}
      >
        <svg className="w-4 h-4 transition-transform duration-200 group-hover:-translate-x-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
        </svg>
        <span className="text-sm font-medium">Back to Login</span>
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
                  "url('https://images.unsplash.com/photo-1556761175-b413da4baf72?ixlib=rb-4.0.3&ixid=M3wxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8fA%3D%3D&auto=format&fit=crop&w=1000&q=80')",
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
              <div className="w-10 h-10 bg-white/20 backdrop-blur-sm rounded-xl flex items-center justify-center transform transition-transform duration-300 hover:scale-110 hover:rotate-6">
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
                </svg>
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
                  Join Our Community
                </h2>
                <p className="text-lg text-gray-300 leading-relaxed">
                  Create your account and become part of the JACS Property Management family. Start your journey with us today.
                </p>
              </div>
              
              {/* Features */}
              <div className="space-y-4">
                {[
                  { text: "Fast and secure registration", delay: "delay-500" },
                  { text: "Access to premium features", delay: "delay-700" },
                  { text: "24/7 support and assistance", delay: "delay-900" }
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
                  Create Account
                </h2>
                <p className="text-gray-600">Join thousands who trust JACS for property management</p>
              </div>

              {/* Step Indicator */}
              <div 
                className={`transform transition-all duration-800 delay-400 ease-out ${
                  isLoaded ? 'translate-y-0 opacity-100' : 'translate-y-4 opacity-0'
                }`}
              >
                {renderStepIndicator()}
              </div>

              {/* Form Steps */}
              <div className="relative min-h-[400px]">
                {currentStep === 0 && renderStep0()}
                {currentStep === 1 && renderStep1()}
                {currentStep === 2 && renderStep2()}
                {currentStep === 3 && renderStep3()}
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

              {/* Navigation Buttons */}
              <div className="flex space-x-4">
                {currentStep > 0 && (
                  <button
                    type="button"
                    onClick={handlePrevious}
                    className="flex-1 bg-gray-100 text-gray-700 py-3 px-4 rounded-xl font-semibold hover:bg-gray-200 transition-all duration-300 transform hover:scale-105"
                  >
                    Previous
                  </button>
                )}
                
                {currentStep < 3 ? (
                  <button
                    type="button"
                    onClick={handleNext}
                    className="flex-1 bg-gradient-to-r from-black to-gray-800 text-white py-3 px-4 rounded-xl font-semibold hover:from-gray-800 hover:to-black transition-all duration-300 transform hover:scale-105 hover:-translate-y-1 hover:shadow-xl active:scale-95"
                  >
                    {currentStep === 0 ? 'Continue' : 'Next Step'}
                  </button>
                ) : (
                  <button
                    type="submit"
                    disabled={isSubmitting}
                    className={`flex-1 py-3 px-4 rounded-xl font-semibold transition-all duration-300 transform hover:scale-105 hover:-translate-y-1 hover:shadow-xl active:scale-95 ${
                      isSubmitting 
                        ? 'bg-gray-400 text-gray-600 cursor-not-allowed' 
                        : 'bg-gradient-to-r from-black to-gray-800 text-white hover:from-gray-800 hover:to-black'
                    }`}
                  >
                    {isSubmitting ? 'Creating Account...' : 'Create Account'}
                  </button>
                )}
              </div>

              {/* Login Link */}
              <div className="text-center">
                <p className="text-sm text-gray-600">
                  Already have an account?{' '}
                  <button 
                    type="button" 
                    onClick={handleBackToLogin}
                    className="font-semibold text-black hover:text-gray-700 transition-all duration-200 transform hover:scale-105"
                  >
                    Sign in here
                  </button>
                </p>
              </div>
            </form>
          </div>
        </div>
      </div>
    </div>
  );
};

export default SignUp; 