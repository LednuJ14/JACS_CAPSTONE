/**
 * Form validation utilities
 * Client-side validation for forms
 */

/**
 * Validation rules
 */
export const validationRules = {
  required: (value) => {
    if (value === null || value === undefined || value === '') {
      return 'This field is required';
    }
    return null;
  },

  email: (value) => {
    if (!value) return null; // Let required handle empty
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(value)) {
      return 'Please enter a valid email address';
    }
    return null;
  },

  minLength: (min) => (value) => {
    if (!value) return null;
    if (value.length < min) {
      return `Must be at least ${min} characters`;
    }
    return null;
  },

  maxLength: (max) => (value) => {
    if (!value) return null;
    if (value.length > max) {
      return `Must be no more than ${max} characters`;
    }
    return null;
  },

  password: (value) => {
    if (!value) return null;
    if (value.length < 8) {
      return 'Password must be at least 8 characters';
    }
    if (!/(?=.*[a-z])/.test(value)) {
      return 'Password must contain at least one lowercase letter';
    }
    if (!/(?=.*[A-Z])/.test(value)) {
      return 'Password must contain at least one uppercase letter';
    }
    if (!/(?=.*\d)/.test(value)) {
      return 'Password must contain at least one number';
    }
    if (!/(?=.*[@$!%*?&])/.test(value)) {
      return 'Password must contain at least one special character (@$!%*?&)';
    }
    return null;
  },

  phone: (value) => {
    if (!value) return null;
    // Basic phone validation (allows +, digits, spaces, hyphens, parentheses)
    const phoneRegex = /^[\d\s\+\-\(\)]{7,15}$/;
    if (!phoneRegex.test(value)) {
      return 'Please enter a valid phone number';
    }
    return null;
  },

  number: (value) => {
    if (!value && value !== 0) return null;
    if (isNaN(value)) {
      return 'Must be a valid number';
    }
    return null;
  },

  min: (min) => (value) => {
    if (value === null || value === undefined || value === '') return null;
    const num = Number(value);
    if (isNaN(num) || num < min) {
      return `Must be at least ${min}`;
    }
    return null;
  },

  max: (max) => (value) => {
    if (value === null || value === undefined || value === '') return null;
    const num = Number(value);
    if (isNaN(num) || num > max) {
      return `Must be no more than ${max}`;
    }
    return null;
  },

  match: (fieldName, getFieldValue) => (value) => {
    const fieldValue = getFieldValue(fieldName);
    if (value !== fieldValue) {
      return `Must match ${fieldName}`;
    }
    return null;
  }
};

/**
 * Validate a single field
 */
export function validateField(value, rules) {
  if (!rules || rules.length === 0) {
    return null;
  }

  for (const rule of rules) {
    let error = null;
    
    if (typeof rule === 'function') {
      error = rule(value);
    } else if (typeof rule === 'object' && rule.validator) {
      error = rule.validator(value);
    }

    if (error) {
      return error;
    }
  }

  return null;
}

/**
 * Validate entire form
 */
export function validateForm(formData, schema) {
  const errors = {};
  let isValid = true;

  for (const [fieldName, rules] of Object.entries(schema)) {
    const value = formData[fieldName];
    const error = validateField(value, rules);
    
    if (error) {
      errors[fieldName] = error;
      isValid = false;
    }
  }

  return { isValid, errors };
}

// Note: React hooks are exported in a separate file (useFormValidation.jsx)
// This file contains only pure validation functions

