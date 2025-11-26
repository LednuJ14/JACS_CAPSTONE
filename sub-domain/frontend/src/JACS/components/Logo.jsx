import React from 'react';

const Logo = ({ variant = 'dark', className = '' }) => {
  return (
    <div className={`font-bold text-2xl ${variant === 'dark' ? 'text-white' : 'text-jacs-dark'} ${className}`}>
      <span className="relative">
        JACS
        <div className="absolute -top-1 -right-2 w-3 h-3 bg-jacs-accent rounded-sm transform rotate-45"></div>
      </span>
    </div>
  );
};

export default Logo;
