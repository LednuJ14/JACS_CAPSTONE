/**
 * Custom hook for API requests with loading states, error handling, and cancellation
 */
import { useState, useEffect, useRef, useCallback } from 'react';
import { handleApiError, isRetryableError } from './apiErrorHandler';
import logger from './logger';

export function useApiRequest(apiFunction, options = {}) {
  const {
    immediate = false,
    onSuccess = null,
    onError = null,
    retryOnError = false,
    maxRetries = 3
  } = options;

  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(immediate);
  const [error, setError] = useState(null);
  const abortControllerRef = useRef(null);
  const mountedRef = useRef(true);

  const execute = useCallback(async (...args) => {
    // Cancel previous request if any
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }

    // Create new AbortController
    abortControllerRef.current = new AbortController();
    const signal = abortControllerRef.current.signal;

    setLoading(true);
    setError(null);

    try {
      let result;
      let attempts = 0;

      const makeRequest = async () => {
        attempts++;
        try {
          // Pass signal to API function if it supports it
          if (typeof apiFunction === 'function') {
            result = await apiFunction(...args);
          } else {
            result = await apiFunction;
          }
          return result;
        } catch (err) {
          // Don't retry if aborted
          if (signal.aborted) {
            throw new Error('Request cancelled');
          }

          // Retry on retryable errors
          if (retryOnError && isRetryableError(err) && attempts < maxRetries) {
            const delay = 1000 * Math.pow(2, attempts - 1); // Exponential backoff
            logger.debug(`Retrying request (attempt ${attempts}/${maxRetries}) after ${delay}ms`);
            await new Promise(resolve => setTimeout(resolve, delay));
            return makeRequest();
          }
          throw err;
        }
      };

      result = await makeRequest();

      // Check if component is still mounted
      if (!mountedRef.current || signal.aborted) {
        return;
      }

      setData(result);
      setError(null);
      
      if (onSuccess) {
        onSuccess(result);
      }

      return result;
    } catch (err) {
      // Don't set error if request was cancelled
      if (signal.aborted || !mountedRef.current) {
        return;
      }

      const apiError = handleApiError(err);
      setError(apiError);
      
      if (onError) {
        onError(apiError);
      } else {
        logger.error('API request failed:', apiError);
      }
    } finally {
      if (!signal.aborted && mountedRef.current) {
        setLoading(false);
      }
    }
  }, [apiFunction, onSuccess, onError, retryOnError, maxRetries]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      mountedRef.current = false;
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }
    };
  }, []);

  // Execute immediately if requested
  useEffect(() => {
    if (immediate) {
      execute();
    }
  }, [immediate, execute]);

  const reset = useCallback(() => {
    setData(null);
    setError(null);
    setLoading(false);
  }, []);

  return {
    data,
    loading,
    error,
    execute,
    reset
  };
}

/**
 * Hook for API requests with optimistic updates
 */
export function useOptimisticApiRequest(apiFunction, options = {}) {
  const {
    optimisticUpdate = null,
    onSuccess = null,
    onError = null,
    rollbackOnError = true
  } = options;

  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const previousDataRef = useRef(null);

  const execute = useCallback(async (...args) => {
    // Store previous data for rollback
    previousDataRef.current = data;

    // Apply optimistic update
    if (optimisticUpdate) {
      const optimisticData = typeof optimisticUpdate === 'function' 
        ? optimisticUpdate(data, ...args)
        : optimisticUpdate;
      setData(optimisticData);
    }

    setLoading(true);
    setError(null);

    try {
      const result = await apiFunction(...args);
      setData(result);
      setError(null);
      
      if (onSuccess) {
        onSuccess(result);
      }

      return result;
    } catch (err) {
      const apiError = handleApiError(err);
      
      // Rollback on error
      if (rollbackOnError && previousDataRef.current !== null) {
        setData(previousDataRef.current);
      }

      setError(apiError);
      
      if (onError) {
        onError(apiError, previousDataRef.current);
      }

      throw apiError;
    } finally {
      setLoading(false);
    }
  }, [apiFunction, data, optimisticUpdate, onSuccess, onError, rollbackOnError]);

  return {
    data,
    loading,
    error,
    execute
  };
}

