import React, { useState, useEffect } from 'react';
import PropertyCard from './PropertyCard';
import UnitDetails from './UnitDetails';
import Inquiries from './Inquiries';
import Pagination from './Pagination';
import ApiService from '../../services/api';

const PropertyGrid = ({ filters = {} }) => {
  const [selectedProperty, setSelectedProperty] = useState(null);
  const [properties, setProperties] = useState([]);
  const [loading, setLoading] = useState(true); // retained for future spinner, but not used
  const [page, setPage] = useState(1);
  const [perPage] = useState(9);
  const [pagination, setPagination] = useState({ page: 1, per_page: 9, total_pages: 1, total_items: 0 });
  const [showInquiries, setShowInquiries] = useState(false);
  const [inquiryContext, setInquiryContext] = useState(null);

  // Check for pending inquiry after login and restore it
  useEffect(() => {
    try {
      const pendingInquiry = sessionStorage.getItem('pending_inquiry');
      if (pendingInquiry) {
        const accessToken = localStorage.getItem('access_token');
        const userRole = localStorage.getItem('user_role');
        
        // Only restore if user is now logged in
        if (accessToken && userRole) {
          const inquiryData = JSON.parse(pendingInquiry);
          setInquiryContext(inquiryData);
          setShowInquiries(true);
          // Clear pending inquiry after restoring
          sessionStorage.removeItem('pending_inquiry');
        }
      }
    } catch (e) {
      console.warn('Failed to restore pending inquiry:', e);
    }
  }, []); // Run once on mount

  // Fetch properties from API
  useEffect(() => {
    const fetchProperties = async () => {
      try {
        // Prepare API params - pass filters to backend for server-side filtering
        const apiParams = {
          page: page,
          per_page: perPage
        };
        
        // Add filters to API params
        if (filters.type) {
          apiParams.type = filters.type;
        }
        if (filters.min_price) {
          apiParams.min_price = filters.min_price;
        }
        if (filters.max_price) {
          apiParams.max_price = filters.max_price;
        }
        if (filters.bedrooms) {
          apiParams.bedrooms = filters.bedrooms;
        }
        if (filters.search) {
          apiParams.search = filters.search;
        }
        
        // Location filters - prioritize distance-based search if coordinates available
        if (filters.latitude && filters.longitude) {
          apiParams.latitude = filters.latitude;
          apiParams.longitude = filters.longitude;
          apiParams.radius = filters.radius || 100;
        } else if (filters.city || filters.location) {
          // Use text-based location search
          apiParams.city = filters.city || filters.location;
        }
        
        // Use tenant-accessible endpoint to get active properties with filters
        const response = await ApiService.getActiveProperties(apiParams);
        
        // Handle different response formats
        let properties = [];
        if (response?.properties && Array.isArray(response.properties)) {
          properties = response.properties;
        } else if (response?.items && Array.isArray(response.items)) {
          properties = response.items;
        } else if (Array.isArray(response)) {
          properties = response;
        }
        
        // Update pagination from API response
        if (response?.pagination) {
          setPagination({
            page: response.pagination.page || page,
            per_page: response.pagination.per_page || perPage,
            total_pages: response.pagination.pages || response.pagination.total_pages || 1,
            total_items: response.pagination.total_items || response.pagination.total || 0
          });
        }
        
        // All filtering is now done server-side (search, type, price, location, etc.)
        // No client-side filtering needed
        const cards = properties.map((property, index) => {
          const images = Array.isArray(property.images) ? property.images : [];
          // Always use HTTP for localhost backend (backend doesn't support HTTPS)
          const normalizedImages = images.map((img) => {
            if (typeof img === 'string' && img.startsWith('/uploads/')) {
              return `http://localhost:5000${img}`;
            }
            return img;
          });
          const unit = property.unit_details || {};
          const contact = property.contact_info || {};
          const propertyInfo = property.property_info || {};
          const financialInfo = property.financial_info || {};
          const availabilityInfo = property.availability_info || {};
          
          return {
            id: `prop-${property.property_id || property.id}-${index}`,
            unitId: property.id, // Unit ID from backend
            name: property.title,
            images: normalizedImages,
            // Location details - exact location (prioritize street and barangay)
            location: (() => {
              const parts = [];
              if (property.street) parts.push(property.street);
              if (property.barangay) parts.push(property.barangay);
              if (property.city) parts.push(property.city);
              if (property.province && !parts.includes(property.province)) parts.push(property.province);
              return parts.length > 0 ? parts.join(', ') : (property.city && property.province ? `${property.city}, ${property.province}` : property.city || property.province || 'Location not specified');
            })(),
            street: property.street || '',
            barangay: property.barangay || '',
            city: property.city || '',
            province: property.province || '',
            postalCode: property.postal_code || '',
            price: `₱${Number(property.monthly_rent || 0).toLocaleString()}/month`,
            imageAlt: `${property.title} - Property image`,
            // Basic
            description: property.description || propertyInfo.property_description || '',
            propertyType: property.property_type,
            status: property.status || availabilityInfo.unit_status,
            // Unit details
            bedrooms: property.bedrooms,
            bathrooms: property.bathrooms, // 'own' or 'share'
            area: property.floor_area,
            furnished: unit.furnished || false,
            parkingSpaces: unit.parking_spaces || 0,
            floorNumber: unit.floor_number || '',
            unitStatus: unit.unit_status || availabilityInfo.unit_status || property.status,
            unitDetails: unit,
            amenities: unit.amenities || {},
            securityDeposit: Number(financialInfo.security_deposit || unit.security_deposit || 0),
            // Financial
            monthlyRent: Number(property.monthly_rent || financialInfo.monthly_rent || 0),
            // Property Info
            buildingName: propertyInfo.building_name || '',
            address: (() => {
              // Build address from components, fallback to full address string
              const parts = [];
              if (property.street) parts.push(property.street);
              if (property.barangay) parts.push(property.barangay);
              if (property.city) parts.push(property.city);
              if (property.province) parts.push(property.province);
              if (property.postal_code) parts.push(property.postal_code);
              return parts.length > 0 ? parts.join(', ') : (propertyInfo.address || property.address || '');
            })(),
            // Location coordinates
            latitude: propertyInfo.latitude || property.latitude || null,
            longitude: propertyInfo.longitude || property.longitude || null,
            propertyTitle: propertyInfo.property_title || property.title,
            propertyDescription: propertyInfo.property_description || property.description,
            // Contact
            contactEmail: contact.email || property.contact_email || '',
            contactPhone: contact.phone || property.contact_phone || '',
            contactPerson: contact.contact_person || propertyInfo.contact_person || '',
            // Keep for inquiries routing
            managerId: property.owner?.id || null,
            propertyId: property.property_id || property.id,
            // Additional info
            unitName: property.unit_name || '',
            createdAt: property.created_at,
            updatedAt: property.updated_at,
          };
        });

        setProperties(cards);
        // Pagination is already set from API response above (if available)
        // If API didn't return pagination, set default
        if (!response?.pagination) {
          setPagination({ page: 1, per_page: perPage, total_pages: 1, total_items: cards.length });
        }
      } catch (error) {
        console.error('Error fetching properties:', error);
        setProperties([]);
        setPagination({ page: 1, per_page: perPage, total_pages: 1, total_items: 0 });
      } finally {
        setLoading(false);
      }
    };

    fetchProperties();
  }, [filters, page, perPage]);


  const handleCardClick = (property) => {
    setSelectedProperty(property);
  };

  const handleCloseModal = () => {
    setSelectedProperty(null);
  };

  const handleInquireNow = (unit) => {
    // Check if user is authenticated before allowing inquiry
    const accessToken = localStorage.getItem('access_token');
    const userRole = localStorage.getItem('user_role');
    
    // Extract property_id and unit_id correctly
    let numericPropertyId = null;
    let numericUnitId = null;
    
    // Get property ID
    if (unit.propertyId || unit.property_id) {
      numericPropertyId = Number(unit.propertyId || unit.property_id);
    } else if (unit.id) {
      // Extract from ID format "prop-{property_id}-{index}"
      const match = String(unit.id).match(/^prop-(\d+)(?:-\d+)?$/);
      if (match) {
        numericPropertyId = Number(match[1]);
      } else {
        // Fallback: try to extract any number
        const numMatch = String(unit.id).match(/\d+/);
        numericPropertyId = numMatch ? Number(numMatch[0]) : null;
      }
    }
    
    // Get unit ID - unit.unitId is the actual unit_id from backend (property.id = unit_id)
    if (unit.unitId) {
      numericUnitId = Number(unit.unitId);
    }
    
    if (!numericPropertyId) {
      console.error('Could not extract property ID from unit:', unit);
      alert('Error: Could not identify property. Please try again.');
      return;
    }
    
    if (!accessToken || !userRole) {
      // User is not logged in - show alert and store inquiry context for after login
      const inquiryData = {
        managerName: unit.propertyManager || 'Property Manager',
        property: unit.name,
        unitId: numericUnitId, // Use actual unit ID
        propertyId: numericPropertyId, // Use property ID
        managerId: unit.managerId || null
      };
      
      // Store inquiry context in sessionStorage for after login
      try {
        sessionStorage.setItem('pending_inquiry', JSON.stringify(inquiryData));
      } catch (e) {
        console.warn('Failed to store pending inquiry:', e);
      }
      
      // Show user-friendly alert
      alert('Please log in to make an inquiry. You will be redirected to the login page.');
      
      // Redirect to login - trigger a custom event or use window location
      try {
        window.dispatchEvent(new CustomEvent('navigateToLogin', { 
          detail: { returnTo: 'dashboard' } 
        }));
      } catch (e) {
        console.warn('Could not trigger navigation event:', e);
      }
      
      return; // Prevent inquiry from proceeding
    }
    
    // User is authenticated - proceed with inquiry
    setInquiryContext({
      managerName: unit.propertyManager || 'Property Manager',
      property: unit.name,
      unitName: unit.unitName || unit.name,
      unitId: numericUnitId, // Use actual unit ID
      propertyId: numericPropertyId, // Use property ID
      managerId: unit.managerId || null
    });
    setShowInquiries(true);
  };

  return (
    <>
      <div className="mb-8">
        <h2 className="text-xl md:text-2xl font-bold text-black mb-6">RENT SPACE</h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 md:gap-6">
          {properties.map((property) => (
            <PropertyCard
              key={property.id}
              images={property.images}
              location={property.location}
              price={property.price}
              imageAlt={property.imageAlt}
              bedrooms={property.bedrooms}
              bathrooms={property.bathrooms}
              area={property.area}
              propertyType={property.propertyType}
              street={property.street}
              barangay={property.barangay}
              city={property.city}
              province={property.province}
              onCardClick={() => handleCardClick(property)}
            />
          ))}
        </div>
      </div>

      <Pagination 
        currentPage={pagination.page || page}
        totalPages={pagination.total_pages || 1}
        onPageChange={(p) => setPage(p)}
      />

      {/* Unit Details Modal */}
      {selectedProperty && (
        <UnitDetails 
          property={selectedProperty} 
          onClose={handleCloseModal}
          onInquireNow={(propertyData) => {
            // Close the unit details modal and open inquiries
            handleCloseModal();
            handleInquireNow(propertyData || selectedProperty);
          }}
        />
      )}

      {showInquiries && (
        <Inquiries onClose={() => setShowInquiries(false)} initialChat={inquiryContext} />
      )}
    </>
  );
};

export default PropertyGrid;
