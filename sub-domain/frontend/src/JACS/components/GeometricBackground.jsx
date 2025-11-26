import React from 'react';
import geometricBg from '@/assets/geometric-bg.jpg';

const GeometricBackground = () => {
  return (
    <div className="relative w-full h-full bg-black overflow-hidden">
      {/* Background Image */}
      <div
        className="absolute inset-0 bg-cover bg-center bg-no-repeat"
        style={{ backgroundImage: `url(${geometricBg})` }}
      />
    </div>
  );
};

export default GeometricBackground;
