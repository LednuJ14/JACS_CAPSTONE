import React, { createContext, useContext, useEffect, useMemo, useState } from 'react';
import { apiService } from '../../services/api';

const Ctx = createContext({ property: null, loading: true, error: null, refresh: async () => {} });

export const PropertyProvider = ({ children }) => {
  const [property, setProperty] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const load = async () => {
    try {
      setLoading(true);
      setError(null);
      const cached = sessionStorage.getItem('property_context');
      if (cached) {
        const parsed = JSON.parse(cached);
        setProperty(parsed.property || null);
        setLoading(false);
        return;
      }
      const ctx = await apiService.getDashboardContext();
      setProperty(ctx?.property || null);
      sessionStorage.setItem('property_context', JSON.stringify(ctx));
    } catch (e) {
      setError(e?.message || 'Failed to resolve property context');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  const value = useMemo(() => ({ property, loading, error, refresh: load }), [property, loading, error]);
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
};

export const useProperty = () => useContext(Ctx);


