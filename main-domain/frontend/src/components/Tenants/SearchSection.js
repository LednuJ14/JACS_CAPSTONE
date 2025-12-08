import React, { useEffect, useState, useRef } from 'react';
import { MapContainer, TileLayer, Marker, useMapEvents } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';

// Fix for default marker icons in React-Leaflet
delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon-2x.png',
  iconUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon.png',
  shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-shadow.png',
});

// Map click handler component
const MapClickHandler = ({ onMapClick }) => {
  useMapEvents({
    click: (e) => {
      onMapClick(e.latlng);
    },
  });
  return null;
};

// Map resize handler component
const MapResizeHandler = () => {
  const map = useMapEvents({});
  React.useEffect(() => {
    setTimeout(() => {
      map.invalidateSize();
    }, 100);
  }, [map]);
  return null;
};

// Reverse geocoding using Nominatim (OSM)
const reverseGeocode = async (lat, lng) => {
  try {
    const response = await fetch(
      `https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lng}&addressdetails=1`,
      {
        headers: {
          'User-Agent': 'PropertyRentalApp/1.0'
        }
      }
    );
    const data = await response.json();
    return data;
  } catch (error) {
    console.error('Reverse geocoding error:', error);
    return null;
  }
};

// Forward geocoding (address search) using Nominatim
const forwardGeocode = async (query) => {
  try {
    const response = await fetch(
      `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(query)}&limit=5&addressdetails=1`,
      {
        headers: {
          'User-Agent': 'PropertyRentalApp/1.0'
        }
      }
    );
    const data = await response.json();
    return data;
  } catch (error) {
    console.error('Forward geocoding error:', error);
    return [];
  }
};

const SearchSection = ({ filters = {}, onChange = () => {} }) => {
  const [showClassificationDropdown, setShowClassificationDropdown] = useState(false);
  const [showPriceDropdown, setShowPriceDropdown] = useState(false);
  const [showMapModal, setShowMapModal] = useState(false);
  const [selectedType, setSelectedType] = useState(filters.type || '');
  const [selectedLocation, setSelectedLocation] = useState(filters.city || filters.location || '');
  const [minPrice, setMinPrice] = useState(filters.min_price || '');
  const [maxPrice, setMaxPrice] = useState(filters.max_price || '');
  const [searchQuery, setSearchQuery] = useState(filters.search || '');
  
  // Sync state with filters prop when it changes externally
  useEffect(() => {
    setSelectedType(filters.type || '');
    setSelectedLocation(filters.city || filters.location || '');
    setMinPrice(filters.min_price || '');
    setMaxPrice(filters.max_price || '');
    setSearchQuery(filters.search || '');
  }, [filters.type, filters.city, filters.location, filters.min_price, filters.max_price, filters.search]);
  
  // Map state
  const [mapLocation, setMapLocation] = useState([10.3157, 123.8854]); // Cebu City default
  const [selectedLocationCoords, setSelectedLocationCoords] = useState(null);
  const [addressSearch, setAddressSearch] = useState('');
  const [isGeocoding, setIsGeocoding] = useState(false);
  const [searchResults, setSearchResults] = useState([]);

  // Use backend enum values with human labels
  const classifications = [
    { value: '', label: 'All Types' },
    { value: 'bed_space', label: 'Bed Space' },
    { value: 'dormitory', label: 'Dormitory' },
    { value: 'boarding_house', label: 'Boarding House' },
    { value: 'studio_apartment', label: 'Studio Apartment' },
    { value: 'room_for_rent', label: 'Room for Rent' }
  ];

  // Handle map click for location selection
  const handleMapClick = async (latlng) => {
    setIsGeocoding(true);
    try {
      const result = await reverseGeocode(latlng.lat, latlng.lng);
      if (result && result.address) {
        const addr = result.address;
        
        // Extract detailed location components
        const street = addr.road || addr.street || addr.pedestrian || '';
        const barangay = addr.suburb || addr.neighbourhood || addr.village || addr.quarter || '';
        const city = addr.city || addr.municipality || addr.town || '';
        const province = addr.state || addr.province || '';
        
        // Build specific location name with priority: street > barangay > city
        let locationParts = [];
        if (street) locationParts.push(street);
        if (barangay) locationParts.push(barangay);
        if (city) locationParts.push(city);
        if (province && !locationParts.includes(province)) locationParts.push(province);
        
        const locationName = locationParts.length > 0 
          ? locationParts.join(', ') 
          : 'Selected Location';
        
        setSelectedLocation(locationName);
        setSelectedLocationCoords(latlng);
        setMapLocation([latlng.lat, latlng.lng]);
        
        // Update filters with specific location (prioritize street/barangay, fallback to city)
        const filterLocation = street || barangay || city || '';
        onChange((prevFilters) => ({ 
          ...prevFilters, 
          city: filterLocation, 
          location: locationName,
          latitude: latlng.lat,
          longitude: latlng.lng,
          radius: 100 // 100 meters radius
        }));
      }
    } catch (error) {
      console.error('Error reverse geocoding:', error);
    } finally {
      setIsGeocoding(false);
    }
  };

  // Handle address search
  const handleAddressSearch = async () => {
    if (!addressSearch.trim()) return;
    
    setIsGeocoding(true);
    try {
      const results = await forwardGeocode(addressSearch);
      setSearchResults(results);
      
      // Don't auto-select first result - let user choose from list
    } catch (error) {
      console.error('Error forward geocoding:', error);
    } finally {
      setIsGeocoding(false);
    }
  };

  // Select from search results
  const handleSelectSearchResult = (result) => {
    const lat = parseFloat(result.lat);
    const lng = parseFloat(result.lon);
    
    setMapLocation([lat, lng]);
    setSelectedLocationCoords({ lat, lng });
    
    const addr = result.address || {};
    
    // Extract detailed location components
    const street = addr.road || addr.street || addr.pedestrian || '';
    const barangay = addr.suburb || addr.neighbourhood || addr.village || addr.quarter || '';
    const city = addr.city || addr.municipality || addr.town || '';
    const province = addr.state || addr.province || '';
    
    // Build specific location name with priority: street > barangay > city
    let locationParts = [];
    if (street) locationParts.push(street);
    if (barangay) locationParts.push(barangay);
    if (city) locationParts.push(city);
    if (province && !locationParts.includes(province)) locationParts.push(province);
    
    const locationName = locationParts.length > 0 
      ? locationParts.join(', ') 
      : result.display_name;
    
    setSelectedLocation(locationName);
    setSearchResults([]);
    setAddressSearch('');
    
    // Update filters with specific location (prioritize street/barangay, fallback to city)
    const filterLocation = street || barangay || city || '';
    onChange((prevFilters) => ({ 
      ...prevFilters, 
      city: filterLocation, 
      location: locationName,
      latitude: lat,
      longitude: lng,
      radius: 100 // 100 meters radius
    }));
  };

  // Handle location modal open
  const handleLocationClick = () => {
    setShowMapModal(true);
    setShowClassificationDropdown(false);
    setShowPriceDropdown(false);
  };

  // Apply location from map
  const handleApplyLocation = () => {
    if (selectedLocation) {
      setShowMapModal(false);
    }
  };

  // Clear location
  const handleClearLocation = () => {
    setSelectedLocation('');
    setSelectedLocationCoords(null);
    setAddressSearch('');
    setSearchResults([]);
    onChange((prevFilters) => ({ ...prevFilters, city: '', location: '', latitude: '', longitude: '', radius: '' }));
  };

  const handleSearchChange = (e) => {
    const value = e.target.value;
    setSearchQuery(value);
    // Immediately update for instant feedback, but debounce the API call
  };

  const handleTypeSelect = (type) => {
    setSelectedType(type);
    setShowClassificationDropdown(false);
    // Immediately update filters - use functional update to ensure we have latest filters
    onChange((prevFilters) => ({ ...prevFilters, type: type || '' }));
  };

  const handleApplyPrice = () => {
    // Validate price range
    const min = minPrice ? parseFloat(minPrice) : null;
    const max = maxPrice ? parseFloat(maxPrice) : null;
    
    if (min !== null && isNaN(min)) {
      alert('Please enter a valid minimum price');
      return;
    }
    if (max !== null && isNaN(max)) {
      alert('Please enter a valid maximum price');
      return;
    }
    if (min !== null && max !== null && min > max) {
      alert('Minimum price cannot be greater than maximum price');
      return;
    }
    
    setShowPriceDropdown(false);
    // Update filters with validated prices - use functional update
    onChange((prevFilters) => ({ 
      ...prevFilters, 
      min_price: min !== null ? min.toString() : '', 
      max_price: max !== null ? max.toString() : '' 
    }));
  };

  const handleClearPrice = () => {
    setMinPrice('');
    setMaxPrice('');
    onChange((prevFilters) => ({ ...prevFilters, min_price: '', max_price: '' }));
  };

  // Debounce search changes - only trigger API call after user stops typing
  useEffect(() => {
    const id = setTimeout(() => {
      onChange((prevFilters) => ({ ...prevFilters, search: searchQuery.trim() }));
    }, 300);
    return () => clearTimeout(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchQuery]);

  // Refs for dropdown containers to detect outside clicks
  const classificationDropdownRef = React.useRef(null);
  const priceDropdownRef = React.useRef(null);
  const classificationButtonRef = React.useRef(null);
  const priceButtonRef = React.useRef(null);

  // Close dropdowns when clicking outside
  useEffect(() => {
    const handleClickOutside = (event) => {
      // Check if click is outside both dropdowns and their buttons
      const isOutsideClassification = 
        classificationDropdownRef.current && 
        !classificationDropdownRef.current.contains(event.target) &&
        classificationButtonRef.current &&
        !classificationButtonRef.current.contains(event.target);
      
      const isOutsidePrice = 
        priceDropdownRef.current && 
        !priceDropdownRef.current.contains(event.target) &&
        priceButtonRef.current &&
        !priceButtonRef.current.contains(event.target);

      if (showClassificationDropdown && isOutsideClassification) {
        setShowClassificationDropdown(false);
      }
      
      if (showPriceDropdown && isOutsidePrice) {
        setShowPriceDropdown(false);
      }
    };
    
    if (showClassificationDropdown || showPriceDropdown) {
      document.addEventListener('mousedown', handleClickOutside);
      return () => document.removeEventListener('mousedown', handleClickOutside);
    }
  }, [showClassificationDropdown, showPriceDropdown]);

  const getSelectedTypeLabel = () => {
    const selected = classifications.find(c => c.value === selectedType);
    return selected ? selected.label : 'All Types';
  };

  const getPriceRangeLabel = () => {
    if (minPrice || maxPrice) {
      return `₱${minPrice || '0'} - ₱${maxPrice || '∞'}`;
    }
    return 'Price Range';
  };

  const hasActiveFilters = selectedType || selectedLocation || minPrice || maxPrice || searchQuery;

  return (
    <div className="mb-8">
      {/* Main Search Bar with Filters */}
      <div className="bg-white rounded-2xl shadow-lg border border-gray-200 p-4">
        <div className="flex flex-col lg:flex-row gap-3">
          {/* Search Input - Takes full width on mobile, flex on desktop */}
          <div className="flex-1 relative">
            <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
              <svg className="h-5 w-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
            </div>
            <input
              type="text"
              placeholder="Search properties, locations, amenities..."
              value={searchQuery}
              onChange={handleSearchChange}
              onKeyPress={(e) => {
                if (e.key === 'Enter') {
                  // Trigger search immediately on Enter
                  onChange((prevFilters) => ({ ...prevFilters, search: searchQuery.trim() }));
                }
              }}
              className="block w-full pl-12 pr-12 py-3 border border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-black focus:border-transparent transition-all bg-gray-50 hover:bg-white"
            />
            {searchQuery && (
              <button
                onClick={() => {
                  setSearchQuery('');
                  onChange((prevFilters) => ({ ...prevFilters, search: '' }));
                }}
                className="absolute inset-y-0 right-0 pr-4 flex items-center text-gray-400 hover:text-gray-600 transition-colors"
                type="button"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            )}
          </div>

          {/* Filter Buttons Row */}
          <div className="flex flex-wrap gap-2 lg:flex-nowrap">
            {/* Classification Filter */}
            <div className="relative">
              <button 
                ref={classificationButtonRef}
                onClick={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  setShowClassificationDropdown(!showClassificationDropdown);
                  setShowPriceDropdown(false);
                }}
                className={`flex items-center space-x-2 px-4 py-3 border rounded-xl transition-all font-medium whitespace-nowrap ${
                  selectedType 
                    ? 'border-black bg-black text-white hover:bg-gray-800' 
                    : 'border-gray-300 hover:border-gray-400 bg-white text-gray-700 hover:bg-gray-50'
                }`}
              >
                <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
                </svg>
                <span className="hidden sm:inline">{getSelectedTypeLabel()}</span>
                <svg className={`w-4 h-4 transition-transform ${showClassificationDropdown ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                </svg>
              </button>

              {showClassificationDropdown && (
                <div 
                  ref={classificationDropdownRef}
                  className="absolute top-full left-0 mt-2 w-56 bg-white border border-gray-200 rounded-xl shadow-xl z-50"
                  onClick={(e) => e.stopPropagation()}
                >
                  <div className="p-2">
                    <div className="px-3 py-2 text-xs font-semibold text-gray-500 uppercase tracking-wide">
                      Property Type
                    </div>
                    {classifications.map((c) => (
                      <button
                        key={c.value}
                        onClick={(e) => {
                          e.stopPropagation();
                          handleTypeSelect(c.value);
                        }}
                        className={`w-full text-left px-3 py-2 rounded-lg text-sm font-medium transition-all ${
                          selectedType === c.value
                            ? 'bg-black text-white'
                            : 'text-gray-700 hover:bg-gray-100'
                        }`}
                      >
                        {c.label}
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {/* Location Filter with OSM */}
            <div className="relative flex items-center">
              <button 
                onClick={handleLocationClick}
                className={`flex items-center space-x-2 px-4 py-3 border rounded-xl transition-all font-medium whitespace-nowrap ${
                  selectedLocation 
                    ? 'border-black bg-black text-white hover:bg-gray-800' 
                    : 'border-gray-300 hover:border-gray-400 bg-white text-gray-700 hover:bg-gray-50'
                }`}
              >
                <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                </svg>
                <span className="hidden sm:inline max-w-[120px] truncate">{selectedLocation || 'Location'}</span>
              </button>
              {selectedLocation && (
                <button
                  onClick={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    handleClearLocation();
                  }}
                  className="ml-2 w-8 h-8 flex items-center justify-center hover:bg-gray-100 rounded-full transition-colors"
                  title="Clear location"
                >
                  <svg className="w-4 h-4 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              )}
            </div>

            {/* Price Range Filter */}
            <div className="relative">
              <button 
                ref={priceButtonRef}
                onClick={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  setShowPriceDropdown(!showPriceDropdown);
                  setShowClassificationDropdown(false);
                }}
                className={`flex items-center space-x-2 px-4 py-3 border rounded-xl transition-all font-medium whitespace-nowrap ${
                  (minPrice || maxPrice)
                    ? 'border-black bg-black text-white hover:bg-gray-800' 
                    : 'border-gray-300 hover:border-gray-400 bg-white text-gray-700 hover:bg-gray-50'
                }`}
              >
                <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1" />
                </svg>
                <span className="hidden sm:inline">{getPriceRangeLabel()}</span>
                <svg className={`w-4 h-4 transition-transform ${showPriceDropdown ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                </svg>
              </button>

              {showPriceDropdown && (
                <div 
                  ref={priceDropdownRef}
                  className="absolute top-full right-0 mt-2 w-80 bg-white border border-gray-200 rounded-xl shadow-xl z-50"
                  onClick={(e) => e.stopPropagation()}
                >
                  <div className="p-4">
                    <div className="flex items-center justify-between mb-4">
                      <div className="text-sm font-semibold text-gray-700 uppercase tracking-wide">
                        Price Range (₱)
                      </div>
                      {(minPrice || maxPrice) && (
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            handleClearPrice();
                          }}
                          className="text-xs text-gray-500 hover:text-gray-700"
                        >
                          Clear
                        </button>
                      )}
                    </div>
                    
                    <div className="space-y-3">
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">
                          Minimum Price (₱)
                        </label>
                        <input
                          type="number"
                          min="0"
                          step="100"
                          value={minPrice}
                          onChange={(e) => {
                            e.stopPropagation();
                            const value = e.target.value;
                            // Allow empty string or valid number
                            if (value === '' || (!isNaN(value) && parseFloat(value) >= 0)) {
                              setMinPrice(value);
                            }
                          }}
                          onClick={(e) => e.stopPropagation()}
                          placeholder="0"
                          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-black focus:border-transparent"
                        />
                      </div>

                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">
                          Maximum Price (₱)
                        </label>
                        <input
                          type="number"
                          min="0"
                          step="100"
                          value={maxPrice}
                          onChange={(e) => {
                            e.stopPropagation();
                            const value = e.target.value;
                            // Allow empty string or valid number
                            if (value === '' || (!isNaN(value) && parseFloat(value) >= 0)) {
                              setMaxPrice(value);
                            }
                          }}
                          onClick={(e) => e.stopPropagation()}
                          placeholder="No limit"
                          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-black focus:border-transparent"
                        />
                      </div>
                      
                      {/* Price validation message */}
                      {minPrice && maxPrice && parseFloat(minPrice) > parseFloat(maxPrice) && (
                        <div className="text-xs text-red-600 bg-red-50 p-2 rounded">
                          Minimum price cannot be greater than maximum price
                        </div>
                      )}

                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          handleApplyPrice();
                        }}
                        disabled={minPrice && maxPrice && parseFloat(minPrice) > parseFloat(maxPrice)}
                        className="w-full bg-black text-white py-2 px-4 rounded-lg font-medium hover:bg-gray-800 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                        Apply Price Range
                      </button>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Active Filters Display */}
        {hasActiveFilters && (
          <div className="mt-4 pt-4 border-t border-gray-200 flex flex-wrap items-center gap-2">
            <span className="text-sm font-medium text-gray-600">Active filters:</span>
            {selectedType && (
              <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-medium bg-black text-white">
                {getSelectedTypeLabel()}
                <button
                  onClick={() => handleTypeSelect('')}
                  className="ml-2 hover:bg-white/20 rounded-full"
                >
                  <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </span>
            )}
            {selectedLocation && (
              <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-medium bg-black text-white">
                {selectedLocation}
                <button
                  onClick={handleClearLocation}
                  className="ml-2 hover:bg-white/20 rounded-full"
                >
                  <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </span>
            )}
            {(minPrice || maxPrice) && (
              <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-medium bg-black text-white">
                {getPriceRangeLabel()}
                <button
                  onClick={handleClearPrice}
                  className="ml-2 hover:bg-white/20 rounded-full"
                >
                  <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </span>
            )}
            {searchQuery && (
              <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-medium bg-gray-200 text-gray-800">
                Search: {searchQuery}
                <button
                  onClick={() => setSearchQuery('')}
                  className="ml-2 hover:bg-gray-300 rounded-full"
                >
                  <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </span>
            )}
            <button
              onClick={() => {
                setSelectedType('');
                setSelectedLocation('');
                setSelectedLocationCoords(null);
                setMinPrice('');
                setMaxPrice('');
                setSearchQuery('');
                onChange(() => ({ type: '', city: '', location: '', latitude: '', longitude: '', radius: '', min_price: '', max_price: '', search: '' }));
              }}
              className="ml-auto text-sm font-medium text-gray-600 hover:text-black"
            >
              Clear All
            </button>
          </div>
        )}
      </div>

      {/* OSM Map Modal for Location Selection */}
      {showMapModal && (
        <div className="fixed inset-0 bg-black bg-opacity-60 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl w-full max-w-4xl max-h-[90vh] overflow-hidden shadow-2xl">
            {/* Modal Header */}
            <div className="flex items-center justify-between p-6 border-b border-gray-200 bg-gradient-to-r from-gray-50 to-white">
              <div>
                <h3 className="text-xl font-bold text-gray-900">Select Location</h3>
                <p className="text-sm text-gray-500 mt-1">Click on the map or search for an address</p>
              </div>
              <button
                onClick={() => {
                  setShowMapModal(false);
                  setSearchResults([]);
                  setAddressSearch('');
                }}
                className="w-10 h-10 bg-gray-100 hover:bg-gray-200 rounded-full flex items-center justify-center transition-colors"
              >
                <svg className="h-5 w-5 text-gray-700" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            {/* Modal Content */}
            <div className="p-6">
              {/* Address Search */}
              <div className="mb-4">
                <div className="flex gap-2">
                  <div className="flex-1 relative">
                    <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                      <svg className="h-5 w-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                      </svg>
                    </div>
                    <input
                      type="text"
                      value={addressSearch}
                      onChange={(e) => setAddressSearch(e.target.value)}
                      onKeyPress={(e) => {
                        if (e.key === 'Enter') {
                          handleAddressSearch();
                        }
                      }}
                      placeholder="Search for an address or location..."
                      className="block w-full pl-10 pr-4 py-3 border border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-black focus:border-transparent"
                    />
                  </div>
                  <button
                    onClick={handleAddressSearch}
                    disabled={isGeocoding}
                    className="px-6 py-3 bg-black text-white rounded-xl font-medium hover:bg-gray-800 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {isGeocoding ? 'Searching...' : 'Search'}
                  </button>
                </div>

                {/* Search Results */}
                {searchResults.length > 0 && (
                  <div className="mt-3 bg-white border border-gray-200 rounded-xl shadow-lg max-h-64 overflow-y-auto">
                    {searchResults.map((result, index) => {
                      const addr = result.address || {};
                      const street = addr.road || addr.street || addr.pedestrian || '';
                      const barangay = addr.suburb || addr.neighbourhood || addr.village || addr.quarter || '';
                      const city = addr.city || addr.municipality || addr.town || '';
                      
                      // Build display text prioritizing specific location
                      let displayText = '';
                      if (street && barangay) {
                        displayText = `${street}, ${barangay}${city ? `, ${city}` : ''}`;
                      } else if (street) {
                        displayText = `${street}${city ? `, ${city}` : ''}`;
                      } else if (barangay) {
                        displayText = `${barangay}${city ? `, ${city}` : ''}`;
                      } else {
                        displayText = result.display_name;
                      }
                      
                      return (
                        <button
                          key={index}
                          onClick={() => handleSelectSearchResult(result)}
                          className="w-full text-left px-4 py-3 hover:bg-gray-50 border-b border-gray-100 last:border-b-0 transition-colors"
                        >
                          <div className="font-medium text-gray-900">{displayText}</div>
                          {result.display_name !== displayText && (
                            <div className="text-xs text-gray-500 mt-1 truncate">{result.display_name}</div>
                          )}
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>

              {/* Map Container */}
              <div className="relative h-96 rounded-xl overflow-hidden border border-gray-200">
                <MapContainer
                  center={mapLocation}
                  zoom={13}
                  style={{ height: '100%', width: '100%' }}
                  key={mapLocation.join(',')}
                >
                  <TileLayer
                    url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                    attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
                  />
                  <MapClickHandler onMapClick={handleMapClick} />
                  <MapResizeHandler />
                  {selectedLocationCoords && (
                    <Marker position={[selectedLocationCoords.lat, selectedLocationCoords.lng]} />
                  )}
                </MapContainer>
                {isGeocoding && (
                  <div className="absolute inset-0 bg-black bg-opacity-30 flex items-center justify-center z-10">
                    <div className="bg-white rounded-lg px-4 py-2 shadow-lg">
                      <div className="flex items-center space-x-2">
                        <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-black"></div>
                        <span className="text-sm font-medium">Processing...</span>
                      </div>
                    </div>
                  </div>
                )}
              </div>

              {/* Selected Location Display */}
              {selectedLocation && (
                <div className="mt-4 p-4 bg-green-50 border border-green-200 rounded-xl">
                  <div className="flex items-center justify-between">
                    <div>
                      <div className="text-sm font-medium text-green-800">Selected Location:</div>
                      <div className="text-base font-semibold text-green-900">{selectedLocation}</div>
                    </div>
                    <button
                      onClick={handleClearLocation}
                      className="text-green-600 hover:text-green-800"
                    >
                      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                      </svg>
                    </button>
                  </div>
                </div>
              )}
            </div>

            {/* Modal Footer */}
            <div className="flex items-center justify-end gap-3 p-6 border-t border-gray-200 bg-gray-50">
              <button
                onClick={() => {
                  setShowMapModal(false);
                  setSearchResults([]);
                  setAddressSearch('');
                }}
                className="px-6 py-2 border border-gray-300 rounded-xl font-medium text-gray-700 hover:bg-gray-100 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleApplyLocation}
                disabled={!selectedLocation}
                className="px-6 py-2 bg-black text-white rounded-xl font-medium hover:bg-gray-800 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Apply Location
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default SearchSection;
