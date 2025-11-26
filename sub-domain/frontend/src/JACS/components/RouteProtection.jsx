import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { apiService } from '../../services/api';

const RouteProtection = ({ children, allowedUserTypes = ['property_manager', 'manager', 'tenant'] }) => {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [user, setUser] = useState(null);
  const [debugInfo, setDebugInfo] = useState('');

  useEffect(() => {
    const checkAuth = () => {
      console.log('RouteProtection: Checking authentication...');
      setDebugInfo('Checking authentication...');
      
      const isAuth = apiService.isAuthenticated();
      console.log('RouteProtection: isAuthenticated() =', isAuth);
      setDebugInfo(`isAuthenticated: ${isAuth}`);
      
      if (!isAuth) {
        console.log('RouteProtection: Not authenticated, redirecting to login');
        setDebugInfo('Not authenticated, redirecting to login');
        navigate('/login');
        return;
      }

      const currentUser = apiService.getStoredUser();
      console.log('RouteProtection: Current user:', currentUser);
      console.log('RouteProtection: Allowed user types:', allowedUserTypes);
      setDebugInfo(`User: ${currentUser ? JSON.stringify(currentUser) : 'null'}, Allowed: ${allowedUserTypes.join(', ')}`);
      
      setUser(currentUser);

      if (currentUser && !allowedUserTypes.includes(currentUser.user_type)) {
        console.log('RouteProtection: User type not allowed, redirecting...');
        setDebugInfo(`User type ${currentUser.user_type} not allowed, redirecting...`);
        // Redirect based on user type
        if (currentUser.user_type === 'tenant') {
          navigate('/tenant');
        } else {
          navigate('/dashboard');
        }
        return;
      }

      // If we get here, user is authenticated and has the right user type
      console.log('RouteProtection: Authentication check passed, setting loading to false');
      setDebugInfo('Authentication check passed, setting loading to false');
      setLoading(false);
    };

    // Add a small delay to see the debug info
    setTimeout(checkAuth, 100);
  }, [navigate, allowedUserTypes]);

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="flex flex-col items-center space-y-4">
          <div className="flex items-center space-x-2">
            <div className="w-6 h-6 border-2 border-blue-600 border-t-transparent rounded-full animate-spin"></div>
            <span>Loading...</span>
          </div>
          <div className="text-sm text-gray-600 max-w-md text-center">
            <p>Debug Info:</p>
            <p className="font-mono text-xs">{debugInfo}</p>
          </div>
        </div>
      </div>
    );
  }

  return children;
};

export default RouteProtection;
