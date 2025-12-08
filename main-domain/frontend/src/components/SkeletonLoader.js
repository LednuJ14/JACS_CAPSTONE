import React from 'react';

/**
 * Skeleton loader component for content placeholders
 */
const SkeletonLoader = ({ 
  type = 'text', 
  count = 1, 
  className = '',
  width = '100%',
  height = '1rem'
}) => {
  const baseClasses = 'animate-pulse bg-gray-200 rounded';
  
  const renderSkeleton = () => {
    switch (type) {
      case 'text':
        return (
          <div
            className={`${baseClasses} ${className}`}
            style={{ width, height }}
          />
        );
      
      case 'circle':
        return (
          <div
            className={`${baseClasses} rounded-full ${className}`}
            style={{ width: height, height }}
          />
        );
      
      case 'rect':
        return (
          <div
            className={`${baseClasses} ${className}`}
            style={{ width, height }}
          />
        );
      
      case 'card':
        return (
          <div className={`${baseClasses} p-4 ${className}`} style={{ width, minHeight: height }}>
            <div className={`${baseClasses} h-4 w-3/4 mb-2`} />
            <div className={`${baseClasses} h-4 w-full mb-2`} />
            <div className={`${baseClasses} h-4 w-5/6`} />
          </div>
        );
      
      default:
        return (
          <div
            className={`${baseClasses} ${className}`}
            style={{ width, height }}
          />
        );
    }
  };

  if (count > 1) {
    return (
      <div>
        {Array.from({ length: count }).map((_, index) => (
          <div key={index} className={index < count - 1 ? 'mb-2' : ''}>
            {renderSkeleton()}
          </div>
        ))}
      </div>
    );
  }

  return renderSkeleton();
};

export default SkeletonLoader;

