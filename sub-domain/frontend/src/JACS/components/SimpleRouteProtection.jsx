import React from 'react';
import { useNavigate } from 'react-router-dom';
import { apiService } from '../../services/api';

const SimpleRouteProtection = ({ children, allowedUserTypes = ['property_manager', 'manager', 'tenant'] }) => {
  const navigate = useNavigate();

  // Simple check without loading state
  const isAuth = apiService.isAuthenticated();
  const currentUser = apiService.getStoredUser();

  console.log('SimpleRouteProtection: isAuth =', isAuth);
  console.log('SimpleRouteProtection: currentUser =', currentUser);
  console.log('SimpleRouteProtection: allowedUserTypes =', allowedUserTypes);

  if (!isAuth) {
    console.log('SimpleRouteProtection: Not authenticated, redirecting to login');
    navigate('/login');
    return null;
  }

  if (currentUser && !allowedUserTypes.includes(currentUser.user_type)) {
    console.log('SimpleRouteProtection: User type not allowed, redirecting...');
    if (currentUser.user_type === 'tenant') {
      navigate('/tenant');
    } else {
      navigate('/dashboard');
    }
    return null;
  }

  console.log('SimpleRouteProtection: Rendering children');
  return children;
};

export default SimpleRouteProtection;
