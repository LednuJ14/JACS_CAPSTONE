import React, { useState } from 'react';
import defaultUnit from '../../assets/images/default_unit.png';

const PropertyCard = ({ images, location, price, imageAlt, onCardClick, bedrooms, bathrooms, area, propertyType, street, barangay, city, province }) => {
  const [currentImageIndex, setCurrentImageIndex] = useState(0);

  const nextImage = () => {
    setCurrentImageIndex((prevIndex) => 
      prevIndex === images.length - 1 ? 0 : prevIndex + 1
    );
  };

  const prevImage = () => {
    setCurrentImageIndex((prevIndex) => 
      prevIndex === 0 ? images.length - 1 : prevIndex - 1
    );
  };

  const goToImage = (index) => {
    setCurrentImageIndex(index);
  };

  const handleCardClick = (e) => {
    // Prevent click when clicking on navigation elements
    if (e.target.closest('button') || e.target.closest('svg')) {
      return;
    }
    onCardClick();
  };

  return (
    <div 
      className="bg-white rounded-lg border border-gray-200 overflow-hidden hover:shadow-md transition-shadow cursor-pointer"
      onClick={handleCardClick}
    >
      <div className="relative h-60 bg-gray-200 flex items-center justify-center group">
        {/* Main Image */}
        <img 
          src={images && images.length > 0 ? images[currentImageIndex] : defaultUnit} 
          alt={images && images.length > 0 ? `${imageAlt} - Image ${currentImageIndex + 1}` : 'Default Unit Image'}
          className="w-full h-full object-cover rounded-lg"
          onError={(e) => { e.target.src = defaultUnit; }}
        />
        
        {/* Navigation Arrows */}
        {images && images.length > 1 && (
          <>
            {/* Previous Button */}
            <button 
              onClick={prevImage}
              className="absolute left-2 top-1/2 transform -translate-y-1/2 bg-black bg-opacity-50 text-white p-2 rounded-full opacity-0 group-hover:opacity-100 transition-opacity duration-300 hover:bg-opacity-70"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
              </svg>
            </button>
            
            {/* Next Button */}
            <button 
              onClick={nextImage}
              className="absolute right-2 top-1/2 transform -translate-y-1/2 bg-black bg-opacity-50 text-white p-2 rounded-full opacity-0 group-hover:opacity-100 transition-opacity duration-300 hover:bg-opacity-70"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
              </svg>
            </button>
          </>
        )}

        {/* Image Counter */}
        {images && images.length > 1 && (
          <div className="absolute top-2 left-2 bg-black bg-opacity-50 text-white px-2 py-1 rounded text-xs">
            {currentImageIndex + 1} / {images.length}
          </div>
        )}

        {/* Info Button */}
        <div className="absolute top-2 right-2">
          <button className="bg-white bg-opacity-95 p-2 rounded-full hover:bg-opacity-100 transition-all border border-gray-200">
            <svg className="w-4 h-4 md:w-5 md:h-5 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          </button>
        </div>

        {/* Dots Indicator */}
        {images && images.length > 1 && (
          <div className="absolute bottom-2 left-1/2 transform -translate-x-1/2 flex space-x-1">
            {images.map((_, index) => (
              <button
                key={index}
                onClick={() => goToImage(index)}
                className={`w-2 h-2 rounded-full transition-all duration-300 ${
                  index === currentImageIndex 
                    ? 'bg-white scale-125' 
                    : 'bg-white bg-opacity-50 hover:bg-opacity-75'
                }`}
              />
            ))}
          </div>
        )}
      </div>

      {/* Property Details */}
      <div className="p-4">
        {/* Title and Location */}
        <div className="mb-3">
          <div className="mb-2">
            {street && (
              <div className="flex items-center space-x-2 mb-1">
                <svg className="w-4 h-4 text-gray-500 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                </svg>
                <span className="text-gray-700 text-sm font-medium truncate">{street}</span>
              </div>
            )}
            {barangay && (
              <div className="flex items-center space-x-2 mb-1 ml-6">
                <span className="text-gray-600 text-xs">{barangay}</span>
              </div>
            )}
            <div className="flex items-center space-x-2">
              <svg className="w-4 h-4 text-gray-400 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
              </svg>
              <span className="text-gray-600 text-xs truncate">
                {city && province ? `${city}, ${province}` : city || province || location || 'Location not specified'}
              </span>
            </div>
          </div>
          {propertyType && (
            <span className="inline-block px-2 py-1 text-xs font-medium text-gray-600 bg-gray-100 rounded-md mb-2">
              {propertyType.replace('_', ' ').replace(/\b\w/g, l => l.toUpperCase())}
            </span>
          )}
        </div>

        {/* Property Features */}
        {(bedrooms !== undefined || bathrooms || area) && (
          <div className="flex items-center space-x-4 mb-3 text-xs text-gray-600">
            {bedrooms !== undefined && bedrooms !== null && (
              <div className="flex items-center space-x-1">
                <span>🛏️</span>
                <span>{bedrooms} bed{bedrooms !== 1 ? 's' : ''}</span>
              </div>
            )}
            {bathrooms && (
              <div className="flex items-center space-x-1">
                <span>🛁</span>
                <span>{bathrooms === 'own' ? 'Private' : bathrooms === 'share' ? 'Shared' : bathrooms} bath</span>
              </div>
            )}
            {area && (
              <div className="flex items-center space-x-1">
                <span>📏</span>
                <span>{area}m²</span>
              </div>
            )}
          </div>
        )}

        {/* Price */}
        <div className="flex items-center justify-between pt-2 border-t border-gray-100">
          <span className="text-base md:text-lg font-bold text-black">{price}</span>
        </div>
      </div>
    </div>
  );
};

export default PropertyCard;
