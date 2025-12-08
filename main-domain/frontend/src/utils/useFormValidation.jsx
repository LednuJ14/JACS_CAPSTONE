/**
 * React hook for form validation
 */
import { useState } from 'react';
import { validateField as validateFieldUtil, validateForm } from './formValidation';

export function useFormValidation(initialValues = {}, schema = {}) {
  const [values, setValues] = useState(initialValues);
  const [errors, setErrors] = useState({});
  const [touched, setTouched] = useState({});

  const setValue = (name, value) => {
    setValues(prev => ({ ...prev, [name]: value }));
    
    // Clear error when user starts typing
    if (errors[name]) {
      setErrors(prev => {
        const newErrors = { ...prev };
        delete newErrors[name];
        return newErrors;
      });
    }
  };

  const setFieldTouched = (name) => {
    setTouched(prev => ({ ...prev, [name]: true }));
  };

  const validateField = (name) => {
    if (!schema[name]) return true;

    const value = values[name];
    const error = validateFieldUtil(value, schema[name]);
    
    setErrors(prev => ({
      ...prev,
      [name]: error || undefined
    }));

    return !error;
  };

  const validateAll = () => {
    const { isValid, errors: validationErrors } = validateForm(values, schema);
    setErrors(validationErrors);
    
    // Mark all fields as touched
    const allTouched = {};
    Object.keys(schema).forEach(key => {
      allTouched[key] = true;
    });
    setTouched(allTouched);
    
    return isValid;
  };

  const reset = () => {
    setValues(initialValues);
    setErrors({});
    setTouched({});
  };

  return {
    values,
    errors,
    touched,
    setValue,
    setFieldTouched,
    validateField,
    validateAll,
    reset,
    isValid: Object.keys(errors).length === 0 && Object.keys(touched).length > 0
  };
}

