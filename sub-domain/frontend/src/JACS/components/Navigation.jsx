import React from 'react';
import { useNavigate, useLocation } from 'react-router-dom';

const Navigation = ({ className = '' }) => {
  const navigate = useNavigate();
  const location = useLocation();

  const isActive = (path) => {
    return location.pathname === path;
  };

  return (
    <div className={`flex space-x-4 ${className}`}>
      <button
        onClick={() => navigate('/login')}
        className={`px-4 py-2 rounded-md transition-colors ${
          isActive('/login')
            ? 'bg-blue-100 text-blue-700 font-medium'
            : 'text-gray-600 hover:text-gray-900 hover:bg-gray-100'
        }`}
      >
        Login
      </button>
      <button
        onClick={() => navigate('/dashboard')}
        className={`px-4 py-2 rounded-md transition-colors ${
          isActive('/dashboard')
            ? 'bg-blue-100 text-blue-700 font-medium'
            : 'text-gray-600 hover:text-gray-900 hover:bg-gray-100'
        }`}
      >
        Dashboard
      </button>
    </div>
  );
};

export default Navigation;
