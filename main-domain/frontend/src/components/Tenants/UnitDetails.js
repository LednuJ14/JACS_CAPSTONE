import React, { useState, useEffect } from 'react';
import { MapContainer, TileLayer, Marker, Popup, useMap } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import defaultUnit from '../../assets/images/default_unit.png';

// Fix for default marker icon in Leaflet
delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon-2x.png',
  iconUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon.png',
  shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-shadow.png',
});

// Component to handle map zoom when coordinates change
function MapZoom({ center, zoom }) {
  const map = useMap();
  useEffect(() => {
    map.setView(center, zoom);
  }, [map, center, zoom]);
  return null;
}

const UnitDetails = ({ property, onClose, onInquireNow = () => {} }) => {
  const [currentImageIndex, setCurrentImageIndex] = useState(0);
  const [showRatingModal, setShowRatingModal] = useState(false);
  const [newRating, setNewRating] = useState(0);
  const [newComment, setNewComment] = useState('');
  const [reviewerName, setReviewerName] = useState('');
  const [geocodedCoords, setGeocodedCoords] = useState(null);
  const [isGeocoding, setIsGeocoding] = useState(false);

  // Geocode address if coordinates are not available
  useEffect(() => {
    if (!property) return;
    
    const geocodeAddress = async () => {
      // Check if we already have coordinates
      const lat = property.latitude || property.lat;
      const lon = property.longitude || property.lng || property.lon;
      
      if (lat && lon) {
        // Already have coordinates, no need to geocode
        return;
      }

      // Build address string for geocoding
      const addressParts = [];
      if (property.buildingName) addressParts.push(property.buildingName);
      if (property.street) addressParts.push(property.street);
      if (property.barangay) addressParts.push(property.barangay);
      if (property.city) addressParts.push(property.city);
      if (property.province) addressParts.push(property.province);
      
      const address = addressParts.length > 0 
        ? addressParts.join(', ')
        : property.address;

      if (!address || address === 'Address not available') {
        return;
      }

      try {
        setIsGeocoding(true);
        // Use Nominatim (OpenStreetMap's geocoding service)
        const encodedAddress = encodeURIComponent(address);
        const response = await fetch(
          `https://nominatim.openstreetmap.org/search?format=json&q=${encodedAddress}&limit=1`,
          {
            headers: {
              'User-Agent': 'JACS Property Platform'
            }
          }
        );
        
        if (response.ok) {
          const data = await response.json();
          if (data && data.length > 0) {
            const { lat, lon } = data[0];
            setGeocodedCoords({ lat: parseFloat(lat), lon: parseFloat(lon) });
          }
        }
      } catch (error) {
        console.error('Geocoding error:', error);
      } finally {
        setIsGeocoding(false);
      }
    };

    geocodeAddress();
  }, [property]);

  if (!property) return null;

  // Normalize images and provide a reliable placeholder
  const images = Array.isArray(property.images) && property.images.length > 0
    ? property.images.filter(Boolean)
    : [defaultUnit];

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

  const handleInquiry = () => {
    onInquireNow(property);
  };

  const handleSubmitRating = () => {
    if (newRating === 0) {
      alert('Please select a rating before submitting.');
      return;
    }
    if (!reviewerName.trim()) {
      alert('Please enter your name.');
      return;
    }
    if (!newComment.trim()) {
      alert('Please write a comment.');
      return;
    }

    alert('Thank you for your feedback! Your review has been submitted.');
    setNewRating(0);
    setNewComment('');
    setReviewerName('');
    setShowRatingModal(false);
  };

  const getStatusColor = (status) => {
    const statusLower = (status || '').toLowerCase();
    switch (statusLower) {
      case 'available':
      case 'vacant': return 'bg-green-100 text-green-800 border-green-200';
      case 'occupied': return 'bg-red-100 text-red-800 border-red-200';
      case 'rented': return 'bg-blue-100 text-blue-800 border-blue-200';
      case 'reserved': return 'bg-yellow-100 text-yellow-800 border-yellow-200';
      case 'maintenance': return 'bg-orange-100 text-orange-800 border-orange-200';
      default: return 'bg-gray-100 text-gray-800 border-gray-200';
    }
  };

  const getBathroomLabel = (bathrooms) => {
    if (!bathrooms) return 'N/A';
    if (bathrooms === 'own') return 'Private Bathroom';
    if (bathrooms === 'share') return 'Shared Bathroom';
    return bathrooms;
  };

  const getAmenityIcon = (amenity) => {
    switch (amenity) {
      case 'balcony': return '🏠';
      case 'air_conditioning': return '❄️';
      case 'wifi': return '📶';
      case 'security': return '🔒';
      case 'furnished': return '🛋️';
      case 'parking': return '🚗';
      default: return '✓';
    }
  };

  const getAmenityLabel = (amenity) => {
    switch (amenity) {
      case 'air_conditioning': return 'Air Conditioning';
      case 'balcony': return 'Balcony';
      case 'wifi': return 'WiFi';
      case 'security': return 'Security';
      case 'furnished': return 'Furnished';
      case 'parking': return 'Parking';
      default: return amenity.charAt(0).toUpperCase() + amenity.slice(1).replace(/_/g, ' ');
    }
  };

  // Get amenities from unit_details or directly from property
  const unitAmenities = property.unitDetails?.amenities || property.amenities || {};
  const selectedAmenities = Object.entries(unitAmenities).filter(([_, available]) => available);

  return (
    <>
      <div className="fixed inset-0 bg-black bg-opacity-60 flex items-center justify-center p-3 z-50 overflow-y-auto">
        <div className="bg-white rounded-2xl w-full max-w-6xl my-8 shadow-2xl overflow-hidden">
          {/* Header - Sticky */}
          <div className="sticky top-0 z-10 bg-white border-b border-gray-200 px-6 py-4 flex items-center justify-between">
            <div className="flex items-center space-x-4">
              <button
                onClick={onClose}
                className="w-10 h-10 bg-gray-100 hover:bg-gray-200 rounded-full flex items-center justify-center transition-colors"
              >
                <svg className="w-5 h-5 text-gray-700" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
              <div>
                <h1 className="text-2xl font-bold text-gray-900">{property.name || 'Unit Details'}</h1>
                <div className="text-sm text-gray-500">
                  {property.street && (
                    <p className="font-medium text-gray-700">{property.street}</p>
                  )}
                  {property.barangay && (
                    <p className="text-gray-600">{property.barangay}</p>
                  )}
                  <p className="text-gray-500">
                    {property.city && property.province ? `${property.city}, ${property.province}` : property.city || property.province || property.location || 'Location not specified'}
                  </p>
                </div>
              </div>
            </div>
            <div className={`px-3 py-1 rounded-full text-xs font-semibold border ${getStatusColor(property.unitStatus || property.status)}`}>
              {(property.unitStatus || property.status || 'Available').toUpperCase()}
            </div>
          </div>

          {/* Content - Scrollable */}
          <div className="overflow-y-auto max-h-[calc(100vh-200px)]">
            {/* Hero Section - Image Gallery & Key Info */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 p-6 bg-gradient-to-br from-gray-50 to-white">
              {/* Image Gallery */}
              <div className="relative">
                <div className="relative h-80 lg:h-96 bg-gray-200 rounded-xl overflow-hidden">
                  <img
                    src={images[currentImageIndex] || defaultUnit}
                    alt={`${property.imageAlt || 'Unit'} - Image ${currentImageIndex + 1}`}
                    className="w-full h-full object-cover"
                    onError={(e) => { if (e.currentTarget.src !== defaultUnit) e.currentTarget.src = defaultUnit; }}
                  />

                  {images.length > 1 && (
                    <>
                      <button
                        onClick={prevImage}
                        className="absolute left-3 top-1/2 -translate-y-1/2 bg-black bg-opacity-60 hover:bg-opacity-80 text-white p-2 rounded-full transition-all"
                      >
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                        </svg>
                      </button>
                      <button
                        onClick={nextImage}
                        className="absolute right-3 top-1/2 -translate-y-1/2 bg-black bg-opacity-60 hover:bg-opacity-80 text-white p-2 rounded-full transition-all"
                      >
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                        </svg>
                      </button>

                      <div className="absolute top-3 left-3 bg-black bg-opacity-70 text-white text-xs px-2 py-1 rounded-md">
                        {currentImageIndex + 1} / {images.length}
                      </div>

                      <div className="absolute bottom-3 left-1/2 -translate-x-1/2 flex space-x-2">
                        {images.map((_, index) => (
                          <button
                            key={index}
                            onClick={() => goToImage(index)}
                            className={`w-2 h-2 rounded-full transition-all ${
                              index === currentImageIndex ? 'bg-white scale-125' : 'bg-white/60 hover:bg-white/80'
                            }`}
                          />
                        ))}
                      </div>
                    </>
                  )}
                </div>

                {/* Thumbnail Grid */}
                {images.length > 1 && images.length <= 5 && (
                  <div className="grid grid-cols-4 gap-2 mt-3">
                    {images.slice(0, 4).map((img, index) => (
                      <button
                        key={index}
                        onClick={() => goToImage(index)}
                        className={`relative h-20 rounded-lg overflow-hidden border-2 transition-all ${
                          index === currentImageIndex ? 'border-black' : 'border-transparent hover:border-gray-300'
                        }`}
                      >
                        <img src={img || defaultUnit} alt={`Thumbnail ${index + 1}`} className="w-full h-full object-cover" />
                      </button>
                    ))}
                  </div>
                )}
              </div>

              {/* Key Information */}
              <div className="space-y-6">
                {/* Price & Quick Stats */}
                <div className="bg-white rounded-xl p-6 border border-gray-200 shadow-sm">
                  <div className="mb-4">
                    <div className="text-3xl font-bold text-gray-900 mb-1">
                      {property.price || `₱${Number(property.monthlyRent || 0).toLocaleString()}/month`}
                    </div>
                    <p className="text-sm text-gray-500">Monthly Rent</p>
                  </div>

                  <div className="grid grid-cols-2 gap-4 pt-4 border-t border-gray-100">
                    {property.bedrooms !== undefined && property.bedrooms !== null && (
                      <div className="text-center p-3 bg-gray-50 rounded-lg">
                        <div className="text-2xl mb-1">🛏️</div>
                        <div className="text-sm font-semibold text-gray-800">{property.bedrooms}</div>
                        <div className="text-xs text-gray-500">Bedroom{property.bedrooms !== 1 ? 's' : ''}</div>
                      </div>
                    )}
                    {property.bathrooms && (
                      <div className="text-center p-3 bg-gray-50 rounded-lg">
                        <div className="text-2xl mb-1">🛁</div>
                        <div className="text-sm font-semibold text-gray-800">{getBathroomLabel(property.bathrooms)}</div>
                        <div className="text-xs text-gray-500">Bathroom</div>
                      </div>
                    )}
                    {property.area && (
                      <div className="text-center p-3 bg-gray-50 rounded-lg">
                        <div className="text-2xl mb-1">📏</div>
                        <div className="text-sm font-semibold text-gray-800">{property.area}m²</div>
                        <div className="text-xs text-gray-500">Floor Area</div>
                      </div>
                    )}
                    {property.parkingSpaces !== undefined && (
                      <div className="text-center p-3 bg-gray-50 rounded-lg">
                        <div className="text-2xl mb-1">🚗</div>
                        <div className="text-sm font-semibold text-gray-800">{property.parkingSpaces || 0}</div>
                        <div className="text-xs text-gray-500">Parking</div>
                      </div>
                    )}
                  </div>
                </div>

                {/* Financial Summary */}
                <div className="bg-gradient-to-br from-blue-50 to-indigo-50 rounded-xl p-6 border border-blue-200">
                  <h3 className="text-lg font-bold text-gray-900 mb-4">Rental Fees</h3>
                  <div className="space-y-3">
                    <div className="flex justify-between items-center">
                      <span className="text-sm text-gray-600">Monthly Rent</span>
                      <span className="text-lg font-bold text-gray-900">
                        ₱{Number(property.monthlyRent || 0).toLocaleString()}
                      </span>
                    </div>
                    {property.securityDeposit > 0 && (
                      <div className="flex justify-between items-center">
                        <span className="text-sm text-gray-600">Security Deposit</span>
                        <span className="text-lg font-bold text-gray-900">
                          ₱{Number(property.securityDeposit || 0).toLocaleString()}
                        </span>
                      </div>
                    )}
                    {property.floorNumber && (
                      <div className="flex justify-between items-center pt-3 border-t border-blue-200">
                        <span className="text-sm text-gray-600">Floor Number</span>
                        <span className="text-sm font-semibold text-gray-800">{property.floorNumber}</span>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </div>

            {/* Details Sections */}
            <div className="px-6 pb-6 space-y-6">
              {/* Description */}
              {property.description && (
                <div className="bg-white rounded-xl p-6 border border-gray-200 shadow-sm">
                  <h3 className="text-lg font-bold text-gray-900 mb-3 flex items-center">
                    <span className="w-1 h-5 bg-black rounded-full mr-3"></span>
                    Description
                  </h3>
                  <p className="text-gray-700 leading-relaxed">{property.description}</p>
                </div>
              )}

              {/* Unit Amenities */}
              {(selectedAmenities.length > 0 || property.furnished) && (
                <div className="bg-white rounded-xl p-6 border border-gray-200 shadow-sm">
                  <h3 className="text-lg font-bold text-gray-900 mb-4 flex items-center">
                    <span className="w-1 h-5 bg-black rounded-full mr-3"></span>
                    Unit Amenities
                  </h3>
                  <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
                    {selectedAmenities.map(([amenity, _]) => (
                      <div key={amenity} className="flex items-center space-x-2 p-3 rounded-lg bg-green-50 border border-green-200">
                        <span className="text-xl">{getAmenityIcon(amenity)}</span>
                        <span className="text-sm font-medium text-green-800">{getAmenityLabel(amenity)}</span>
                      </div>
                    ))}
                    {property.furnished && (
                      <div className="flex items-center space-x-2 p-3 rounded-lg bg-green-50 border border-green-200">
                        <span className="text-xl">🛋️</span>
                        <span className="text-sm font-medium text-green-800">Furnished</span>
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* Address */}
              {(property.buildingName || property.street || property.barangay || property.city || property.address) && (
                <div className="bg-white rounded-xl p-6 border border-gray-200 shadow-sm">
                  <h3 className="text-lg font-bold text-gray-900 mb-4 flex items-center">
                    <span className="w-1 h-5 bg-black rounded-full mr-3"></span>
                    Address
                  </h3>
                  <div className="space-y-4">
                    {/* Construct OSM-formatted address */}
                    {(() => {
                      const addressParts = [];
                      if (property.buildingName) addressParts.push(property.buildingName);
                      if (property.street) addressParts.push(property.street);
                      if (property.barangay) addressParts.push(property.barangay);
                      if (property.city) addressParts.push(property.city);
                      if (property.province) addressParts.push(property.province);
                      if (property.postalCode || property.postal_code) addressParts.push(property.postalCode || property.postal_code);
                      
                      const osmAddress = addressParts.length > 0 
                        ? addressParts.join(', ')
                        : property.address || 'Address not available';
                      
                      // Get coordinates for the map - prioritize property coordinates, then geocoded
                      const lat = property.latitude || property.lat || (geocodedCoords?.lat);
                      const lon = property.longitude || property.lng || property.lon || (geocodedCoords?.lon);
                      
                      // Default to Cebu City center if no coordinates available
                      const defaultLat = 10.3157;
                      const defaultLon = 123.8854;
                      
                      const mapLat = lat ? parseFloat(lat) : defaultLat;
                      const mapLon = lon ? parseFloat(lon) : defaultLon;
                      const hasCoordinates = lat && lon;
                      const mapZoom = hasCoordinates ? 16 : 13; // Zoom in more when we have exact coordinates
                      
                      return (
                        <>
                          <div className="flex items-start">
                            <div className="flex-1">
                              <p className="text-sm text-gray-800 leading-relaxed font-medium">{osmAddress}</p>
                              {isGeocoding && (
                                <p className="text-xs text-gray-500 mt-1">Locating address...</p>
                              )}
                              {!hasCoordinates && !isGeocoding && (
                                <p className="text-xs text-gray-500 mt-1">Map shows approximate location</p>
                              )}
                            </div>
                          </div>
                          {/* Leaflet OpenStreetMap with Marker */}
                          <div className="w-full h-64 rounded-lg overflow-hidden border border-gray-200">
                            <MapContainer
                              key={`${mapLat}-${mapLon}`} // Force re-render when coordinates change
                              center={[mapLat, mapLon]}
                              zoom={mapZoom}
                              style={{ height: '100%', width: '100%', zIndex: 0 }}
                              scrollWheelZoom={true}
                              whenReady={(map) => {
                                // Ensure map is properly initialized
                                map.target.invalidateSize();
                              }}
                            >
                              <TileLayer
                                attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
                                url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                              />
                              <MapZoom center={[mapLat, mapLon]} zoom={mapZoom} />
                              {/* Always show marker if we have coordinates */}
                              {hasCoordinates && (
                                <Marker 
                                  position={[mapLat, mapLon]}
                                  icon={L.icon({
                                    iconUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon.png',
                                    iconRetinaUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon-2x.png',
                                    shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-shadow.png',
                                    iconSize: [25, 41],
                                    iconAnchor: [12, 41],
                                    popupAnchor: [1, -34],
                                    shadowSize: [41, 41]
                                  })}
                                >
                                  <Popup>
                                    <div className="text-sm">
                                      <strong>Property Location</strong>
                                      <br />
                                      {osmAddress}
                                    </div>
                                  </Popup>
                                </Marker>
                              )}
                            </MapContainer>
                          </div>
                        </>
                      );
                    })()}
                  </div>
                </div>
              )}

              {/* Contact Information */}
              {(property.contactEmail || property.contactPhone || property.contactPerson) && (
                <div className="bg-white rounded-xl p-6 border border-gray-200 shadow-sm">
                  <h3 className="text-lg font-bold text-gray-900 mb-4 flex items-center">
                    <span className="w-1 h-5 bg-black rounded-full mr-3"></span>
                    Contact Information
                  </h3>
                  <div className="space-y-4">
                    {property.contactEmail && (
                      <div className="flex items-center space-x-3">
                        <div className="w-10 h-10 bg-purple-100 rounded-full flex items-center justify-center flex-shrink-0">
                          <svg className="w-5 h-5 text-purple-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 4.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                          </svg>
                        </div>
                        <div>
                          <p className="text-xs text-gray-500">Email</p>
                          <p className="text-sm font-semibold text-gray-800">{property.contactEmail}</p>
                        </div>
                      </div>
                    )}
                    {property.contactPhone && (
                      <div className="flex items-center space-x-3">
                        <div className="w-10 h-10 bg-orange-100 rounded-full flex items-center justify-center flex-shrink-0">
                          <svg className="w-5 h-5 text-orange-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" />
                          </svg>
                        </div>
                        <div>
                          <p className="text-xs text-gray-500">Phone</p>
                          <p className="text-sm font-semibold text-gray-800">{property.contactPhone}</p>
                        </div>
                      </div>
                    )}
                    {property.contactPerson && (
                      <div className="flex items-center space-x-3">
                        <div className="w-10 h-10 bg-green-100 rounded-full flex items-center justify-center flex-shrink-0">
                          <svg className="w-5 h-5 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                          </svg>
                        </div>
                        <div>
                          <p className="text-xs text-gray-500">Contact Person</p>
                          <p className="text-sm font-semibold text-gray-800">{property.contactPerson}</p>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Sticky Footer Actions */}
          <div className="sticky bottom-0 bg-white border-t border-gray-200 px-6 py-4 shadow-lg">
            <div className="flex flex-col sm:flex-row gap-3">
              <button
                onClick={handleInquiry}
                className="flex-1 bg-black hover:bg-gray-800 text-white py-3 px-6 rounded-xl font-bold text-sm transition-all shadow-md"
              >
                INQUIRE NOW
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Rating Modal */}
      {showRatingModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-60 p-4">
          <div className="bg-white rounded-xl w-full max-w-md shadow-2xl">
            <div className="p-6">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-bold text-gray-900">Rate & Review Property</h3>
                <button
                  onClick={() => setShowRatingModal(false)}
                  className="text-gray-400 hover:text-gray-600"
                >
                  <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>

              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Your Rating</label>
                  <div className="flex space-x-1">
                    {[1, 2, 3, 4, 5].map((star) => (
                      <button
                        key={star}
                        onClick={() => setNewRating(star)}
                        className={`w-8 h-8 ${
                          star <= newRating ? 'text-yellow-400' : 'text-gray-300'
                        } hover:text-yellow-400 transition-colors`}
                      >
                        <svg className="w-full h-full" fill="currentColor" viewBox="0 0 20 20">
                          <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
                        </svg>
                      </button>
                    ))}
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Your Name</label>
                  <input
                    type="text"
                    value={reviewerName}
                    onChange={(e) => setReviewerName(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-black focus:border-transparent"
                    placeholder="Enter your name"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Your Review</label>
                  <textarea
                    value={newComment}
                    onChange={(e) => setNewComment(e.target.value)}
                    rows={4}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-black focus:border-transparent"
                    placeholder="Share your experience with this property..."
                  />
                </div>

                <div className="flex space-x-3 pt-4">
                  <button
                    onClick={() => setShowRatingModal(false)}
                    className="flex-1 bg-gray-100 text-gray-700 py-2 px-4 rounded-lg font-medium hover:bg-gray-200 transition-colors"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={handleSubmitRating}
                    className="flex-1 bg-black text-white py-2 px-4 rounded-lg font-medium hover:bg-gray-800 transition-colors"
                  >
                    Submit Review
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
};

export default UnitDetails;
