/**
 * Centralized logging utility for frontend
 * Replaces console.log with environment-aware logging
 */

const isDevelopment = process.env.NODE_ENV === 'development';

class Logger {
  constructor() {
    this.enabled = isDevelopment;
  }

  /**
   * Log debug information (only in development)
   */
  debug(...args) {
    if (this.enabled) {
      console.log('[DEBUG]', ...args);
    }
  }

  /**
   * Log informational messages (only in development)
   */
  info(...args) {
    if (this.enabled) {
      console.info('[INFO]', ...args);
    }
  }

  /**
   * Log warnings (always logged)
   */
  warn(...args) {
    console.warn('[WARN]', ...args);
  }

  /**
   * Log errors (always logged)
   */
  error(...args) {
    console.error('[ERROR]', ...args);
    // In production, you might want to send errors to an error tracking service
    // Example: Sentry.captureException(new Error(args.join(' ')));
  }

  /**
   * Log API requests (only in development)
   */
  api(method, url, data = null) {
    if (this.enabled) {
      console.log(`[API ${method}]`, url, data ? { data } : '');
    }
  }

  /**
   * Log API responses (only in development)
   */
  apiResponse(method, url, response) {
    if (this.enabled) {
      console.log(`[API ${method} Response]`, url, response);
    }
  }

  /**
   * Log component lifecycle events (only in development)
   */
  component(componentName, event, data = null) {
    if (this.enabled) {
      console.log(`[${componentName}]`, event, data || '');
    }
  }
}

// Export singleton instance
const logger = new Logger();
export default logger;

