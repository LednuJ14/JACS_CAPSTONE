/**
 * API Error Handler Utility
 * Provides consistent error handling for API failures
 */

class ApiError extends Error {
  constructor(message, status, code, details = null) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.code = code;
    this.details = details;
    this.isApiError = true;
  }

  static fromResponse(errorResponse) {
    if (errorResponse?.error) {
      return new ApiError(
        errorResponse.error.message || 'An error occurred',
        errorResponse.error.status_code || 500,
        errorResponse.error.code || 'UNKNOWN_ERROR',
        errorResponse.error.details
      );
    }
    return new ApiError('An unknown error occurred', 500, 'UNKNOWN_ERROR');
  }

  static fromNetworkError() {
    return new ApiError(
      'Network error - unable to connect to server',
      0,
      'NETWORK_ERROR'
    );
  }
}

/**
 * Handle API errors with user-friendly messages
 */
export function handleApiError(error, defaultMessage = 'An error occurred') {
  // If it's already an ApiError, return it
  if (error?.isApiError) {
    return error;
  }

  // If it's a network error
  if (!error.status && (error.message?.includes('Network') || error.message?.includes('Failed to fetch'))) {
    return ApiError.fromNetworkError();
  }

  // If error has response data
  if (error.data?.error) {
    return ApiError.fromResponse(error.data);
  }

  // If error has status
  if (error.status) {
    const statusMessages = {
      400: 'Invalid request. Please check your input.',
      401: 'Authentication required. Please log in.',
      403: 'You do not have permission to perform this action.',
      404: 'The requested resource was not found.',
      409: 'A conflict occurred. The resource may already exist.',
      422: 'Validation failed. Please check your input.',
      429: 'Too many requests. Please try again later.',
      500: 'Server error. Please try again later.',
      503: 'Service unavailable. Please try again later.'
    };

    return new ApiError(
      statusMessages[error.status] || defaultMessage,
      error.status,
      `HTTP_${error.status}`
    );
  }

  // Default error
  return new ApiError(defaultMessage, 500, 'UNKNOWN_ERROR');
}

/**
 * Get user-friendly error message
 */
export function getErrorMessage(error) {
  const apiError = handleApiError(error);
  return apiError.message;
}

/**
 * Check if error is retryable
 */
export function isRetryableError(error) {
  const apiError = handleApiError(error);
  // Retry on network errors, 5xx errors, and 429 (rate limit)
  return apiError.status === 0 || 
         (apiError.status >= 500 && apiError.status < 600) || 
         apiError.status === 429;
}

/**
 * Retry function with exponential backoff
 */
export async function retryWithBackoff(fn, maxRetries = 3, initialDelay = 1000) {
  let lastError;
  
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      return await fn();
    } catch (error) {
      lastError = error;
      
      // Don't retry if error is not retryable
      if (!isRetryableError(error) || attempt === maxRetries) {
        throw error;
      }
      
      // Exponential backoff: 1s, 2s, 4s
      const delay = initialDelay * Math.pow(2, attempt);
      await new Promise(resolve => setTimeout(resolve, delay));
    }
  }
  
  throw lastError;
}

export { ApiError };
export default { handleApiError, getErrorMessage, isRetryableError, retryWithBackoff };

