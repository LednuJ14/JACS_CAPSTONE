import React, { createContext, useContext, useEffect, useMemo, useState } from 'react';
import { apiService } from '../../services/api';

const Ctx = createContext({ property: null, loading: true, error: null, refresh: async () => {} });

export const PropertyProvider = ({ children }) => {
  const [property, setProperty] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const load = async (forceRefresh = false) => {
    try {
      setLoading(true);
      setError(null);
      
      // Only use cache if not forcing refresh and hostname hasn't changed
      if (!forceRefresh) {
        const currentHostname = typeof window !== 'undefined' ? window.location.hostname : '';
        const cachedHostname = sessionStorage.getItem('last_hostname');
        
        // Only use cache if hostname matches (same subdomain)
        if (cachedHostname === currentHostname) {
          const cached = sessionStorage.getItem('property_context');
          if (cached) {
            try {
              const parsed = JSON.parse(cached);
              if (parsed?.property?.id) {
                setProperty(parsed.property || null);
                setLoading(false);
                // Still fetch fresh data in background
                fetchFreshData();
                return;
              }
            } catch (e) {
              console.warn('Failed to parse cached property context:', e);
            }
          }
        } else if (cachedHostname) {
          // Hostname changed - clear stale cache
          try {
            sessionStorage.removeItem('property_context');
          } catch (e) {
            console.warn('Failed to clear stale cache:', e);
          }
        }
      }
      
      // Fetch fresh data
      await fetchFreshData();
    } catch (e) {
      setError(e?.message || 'Failed to resolve property context');
      setLoading(false);
    }
  };

  const fetchFreshData = async () => {
    try {
      let propertyData = null;
      
      // Check if user is authenticated (has token)
      const token = apiService.token || localStorage.getItem('access_token');
      
      // Always try subdomain-based lookup first to ensure we get the correct property
      // This is critical for multi-property managers who might access different subdomains
      // Subdomain lookup works for both authenticated and unauthenticated users
      propertyData = await fetchPropertyBySubdomain();
      
      // CRITICAL: Do NOT use dashboard context as fallback for property managers
      // Dashboard context might return the first property they own, not the current subdomain
      // Only use subdomain-based lookup to ensure correct property isolation
      // If subdomain lookup fails, return null rather than using wrong property
      if (!propertyData?.id && token) {
        console.warn('Subdomain property lookup failed. Not using dashboard context fallback to prevent property mismatch.');
        // Don't use dashboard context - it might return wrong property
        // Return null so app can handle missing property gracefully
      }
      
      // Only try to load display_settings if user is authenticated and is a property manager/owner
      // Display settings endpoint requires owner permissions, so tenants/staff will get 403
      if (propertyData?.id) {
        try {
          // Only try to load display settings if authenticated
          if (token) {
            // Check if user is a property manager before attempting to load display settings
            // This prevents 403 errors for tenants/staff who don't have permission
            const currentUser = apiService.getStoredUser();
            const isPropertyManager = currentUser && (
              currentUser.role === 'property_manager' || 
              currentUser.user_type === 'property_manager' ||
              currentUser.role === 'manager' ||
              currentUser.user_type === 'manager'
            );
            
            if (isPropertyManager) {
              try {
                const displaySettings = await apiService.getDisplaySettings(propertyData.id);
                if (displaySettings) {
                  propertyData.display_settings = displaySettings;
                } else if (!propertyData.display_settings) {
                  propertyData.display_settings = {};
                }
              } catch (displayError) {
                // Silently handle 403 errors (expected for non-owners)
                // Only log other errors
                if (displayError?.message && !displayError.message.includes('403') && !displayError.message.includes('FORBIDDEN') && !displayError.message.includes('Unauthorized')) {
                  console.warn('Failed to load display settings:', displayError);
                }
                if (!propertyData.display_settings) {
                  propertyData.display_settings = {};
                }
              }
            } else {
              // For non-property managers, just set empty display settings
              if (!propertyData.display_settings) {
                propertyData.display_settings = {};
              }
            }
          } else if (propertyData.display_settings) {
            // If display_settings came from public endpoint, use it
            // Already set from public endpoint response
          } else {
            propertyData.display_settings = {};
          }
        } catch (e) {
          // Silently handle errors - display settings are optional
          if (!propertyData.display_settings) {
            propertyData.display_settings = {};
          }
        }
      }
      
      setProperty(propertyData);
      sessionStorage.setItem('property_context', JSON.stringify({ property: propertyData }));
    } catch (e) {
      console.error('Failed to fetch property context:', e);
      // Don't throw - set property to null so app can still function
      setProperty(null);
    } finally {
      setLoading(false);
    }
  };

  const fetchPropertyBySubdomain = async () => {
    try {
      const hostname = typeof window !== 'undefined' ? window.location.hostname : '';
      const subdomain = hostname.split('.')[0];
      
      if (subdomain && subdomain.toLowerCase() !== 'localhost') {
        const property = await apiService.getPropertyBySubdomain(subdomain);
        return property;
      }
      return null;
    } catch (error) {
      // Silently handle connection errors (backend not running)
      const isConnectionError = error?.message?.includes('Failed to fetch') || 
                                error?.message?.includes('ERR_CONNECTION_REFUSED') ||
                                error?.name === 'TypeError';
      
      // Only log non-connection errors
      if (!isConnectionError) {
        console.warn('Failed to fetch property by subdomain:', error);
      }
      return null;
    }
  };

  useEffect(() => {
    // CRITICAL: Check if hostname changed (subdomain switch) and clear cache
    const currentHostname = typeof window !== 'undefined' ? window.location.hostname : '';
    const cachedHostname = sessionStorage.getItem('last_hostname');
    
    if (cachedHostname && cachedHostname !== currentHostname) {
      // Subdomain changed - clear cache to prevent using wrong property
      console.log('Subdomain changed, clearing property context cache');
      try {
        sessionStorage.removeItem('property_context');
      } catch (e) {
        console.warn('Failed to clear property context cache:', e);
      }
    }
    
    // Store current hostname for next check
    if (currentHostname) {
      try {
        sessionStorage.setItem('last_hostname', currentHostname);
      } catch (e) {
        console.warn('Failed to store hostname:', e);
      }
    }
    
    load();
    
    // Listen for refresh events (e.g., when display settings are updated)
    const handleRefresh = () => {
      // Force refresh by clearing cache and reloading
      try {
        sessionStorage.removeItem('property_context');
      } catch (e) {
        console.warn('Failed to clear property context cache:', e);
      }
      load(true); // Force refresh
    };
    window.addEventListener('propertyContextRefresh', handleRefresh);
    
    return () => {
      window.removeEventListener('propertyContextRefresh', handleRefresh);
    };
  }, []);

  const value = useMemo(() => ({ property, loading, error, refresh: load }), [property, loading, error]);
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
};

export const useProperty = () => useContext(Ctx);


