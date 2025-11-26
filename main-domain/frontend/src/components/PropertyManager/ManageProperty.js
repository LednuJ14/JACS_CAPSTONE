import React, { useEffect, useMemo, useState, useRef } from 'react';
import { MapContainer, TileLayer, Marker, useMapEvents } from 'react-leaflet';
import L from 'leaflet';
import api from '../../services/api';
import defaultProperty from '../../assets/images/default_property.png';
import 'leaflet/dist/leaflet.css';

// Fix for default marker icons in React-Leaflet
delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon-2x.png',
  iconUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon.png',
  shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-shadow.png',
});

const API_BASE_URL = process.env.REACT_APP_API_URL || 'http://localhost:5000/api';
const MEDIA_BASE_URL = (process.env.REACT_APP_MEDIA_BASE_URL || API_BASE_URL.replace(/\/api$/, '')).replace(/\/$/, '');

const getImageSrc = (path) => {
  if (!path) return defaultProperty;
  if (path === defaultProperty) return path;
  if (typeof path !== 'string') return defaultProperty;
  const safePath = path.trim();
  if (
    safePath.startsWith('http://') ||
    safePath.startsWith('https://') ||
    safePath.startsWith('data:') ||
    safePath.startsWith('blob:') ||
    safePath.startsWith('/static/')
  ) {
    return safePath;
  }
  const normalized = safePath.startsWith('/') ? safePath : `/${safePath}`;
  return `${MEDIA_BASE_URL}${normalized}`;
};

const statusToBadgeClass = {
  pending_approval: 'bg-yellow-100 text-yellow-800 border-yellow-200',
  pending: 'bg-yellow-100 text-yellow-800 border-yellow-200',
  active: 'bg-green-100 text-green-800 border-green-200',
  approved: 'bg-green-100 text-green-800 border-green-200',
  inactive: 'bg-gray-100 text-gray-700 border-gray-200',
  rejected: 'bg-red-100 text-red-800 border-red-200'
};

const getStatusBadgeClass = (status) => {
  const normalizedStatus = (status || '').toLowerCase();
  return statusToBadgeClass[normalizedStatus] || 'bg-gray-100 text-gray-700 border-gray-200';
};

const formatStatusDisplay = (status) => {
  const normalizedStatus = (status || '').toLowerCase();
  const statusMap = {
    'pending_approval': 'Pending Approval',
    'pending': 'Pending',
    'active': 'Active',
    'approved': 'Approved',
    'inactive': 'Inactive',
    'rejected': 'Rejected'
  };
  return statusMap[normalizedStatus] || status || 'Unknown';
};

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
      `https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lng}&zoom=18&addressdetails=1`,
      {
        headers: {
          'User-Agent': 'JACS Property Management System'
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
      `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(query)}&limit=5&addressdetails=1&countrycodes=ph`,
      {
        headers: {
          'User-Agent': 'JACS Property Management System'
        }
      }
    );
    const data = await response.json();
    return data;
  } catch (error) {
    console.error('Geocoding error:', error);
    return [];
  }
};

const STORAGE_KEY = 'pm_buildings_v1';

const ManageProperty = ({ onOpenManageUnits = () => {} }) => {

  const [buildings, setBuildings] = useState([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('All');
  const [sortBy, setSortBy] = useState('Recent');
  const sortOrder = 'desc';
  const [selectedIds, setSelectedIds] = useState(new Set());
  const [page, setPage] = useState(1);
  const [showAddModal, setShowAddModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [editingBuilding, setEditingBuilding] = useState(null);
  const [showDetailsModal, setShowDetailsModal] = useState(false);
  const [detailsBuilding, setDetailsBuilding] = useState(null);
  const [loading, setLoading] = useState(false);
  const [mapLocation, setMapLocation] = useState([10.3157, 123.8854]); // Default: Cebu City coordinates
  const [selectedLocation, setSelectedLocation] = useState(null);
  const [isGeocoding, setIsGeocoding] = useState(false);
  const [addressSearch, setAddressSearch] = useState('');
  
  // Edit modal map state
  const [editMapLocation, setEditMapLocation] = useState([10.3157, 123.8854]);
  const [editSelectedLocation, setEditSelectedLocation] = useState(null);
  const [editIsGeocoding, setEditIsGeocoding] = useState(false);
  const [editAddressSearch, setEditAddressSearch] = useState('');
  
  const [newProperty, setNewProperty] = useState({
    buildingName: '',
    subdomain: '',
    address: {
      street: '',
      barangay: '',
      city: 'Cebu City',
      province: 'Cebu',
      postalCode: ''
    },
    totalUnits: '',
    propertyType: '',
    yearBuilt: '',
    floorCount: '',
    parkingSpaces: '',
    contactPerson: '',
    contactPosition: '',
    contactEmail: '',
    contactPhone: '',
    businessRegNumber: '',
    tin: '',
    businessPermitNumber: '',
    businessPermitExpiry: '',
    fireSafetyCert: null,
    buildingPermit: null,
    occupancyPermit: null,
    electricalCert: null,
    amenities: [],
    customAmenity: '',
    additionalNotes: '',
    averageRent: '',
    furnishing: '',
    images: [],
    legalDocs: []
  });
  const itemsPerPage = 6;

  // Normalize subdomain value coming from backend (strip trailing -<id>)
  const normalizeSubdomain = (value) => {
    if (!value) return 'no-subdomain';
    const base = String(value).trim().toLowerCase();
    return base.replace(/-\d+$/, '');
  };

  const parseArrayField = (value) => {
    if (!value) return [];
    if (Array.isArray(value)) return value.filter((entry) => entry !== null && entry !== undefined && entry !== '');
    if (typeof value === 'string') {
      try {
        const parsed = JSON.parse(value);
        if (Array.isArray(parsed)) return parsed.filter((entry) => entry !== null && entry !== undefined && entry !== '');
      } catch {
        return value ? [value] : [];
      }
    }
    return [];
  };

  // Helper to parse address string into object
  const parseAddress = (addressStr) => {
    if (!addressStr || typeof addressStr !== 'string') {
      return { street: '', barangay: '', city: 'Cebu City', province: 'Cebu', postalCode: '' };
    }
    
    // Try to parse if it's already an object
    if (typeof addressStr === 'object') {
      return {
        street: addressStr.street || addressStr.address_line1 || '',
        barangay: addressStr.barangay || addressStr.address_line2 || '',
        city: addressStr.city || 'Cebu City',
        province: addressStr.province || 'Cebu',
        postalCode: addressStr.postalCode || addressStr.postal_code || ''
      };
    }
    
    // For now, just return the string as street and use defaults for others
    // In a real implementation, you might want to parse the string more intelligently
    return {
      street: addressStr,
      barangay: '',
      city: 'Cebu City',
      province: 'Cebu',
      postalCode: ''
    };
  };

  // Helper to format address object into string
  const formatAddressString = (addressObj) => {
    if (!addressObj) return '';
    if (typeof addressObj === 'string') return addressObj;
    
    const parts = [];
    if (addressObj.street) parts.push(addressObj.street);
    if (addressObj.barangay) parts.push(addressObj.barangay);
    if (addressObj.city) parts.push(addressObj.city);
    if (addressObj.province) parts.push(addressObj.province);
    if (addressObj.postalCode) parts.push(addressObj.postalCode);
    
    return parts.join(', ') || '';
  };

  const mapPropertyFromApi = (property) => {
    if (!property) return null;
    const images = parseArrayField(property.images);
    const legalDocs = parseArrayField(property.legal_documents || property.legalDocs);
    const amenities = parseArrayField(property.amenities);
    const totalUnitsRaw = property.total_units ?? property.totalUnits ?? property?.unit_counts?.total_units;
    const occupiedUnitsRaw = property.occupied_units ?? property.occupiedUnits ?? property?.unit_counts?.occupied_units;
    let vacantUnitsRaw = property.vacant_units ?? property.vacantUnits ?? property?.unit_counts?.vacant_units;
    const totalUnits = Number(totalUnitsRaw ?? 0) || 0;
    const occupiedUnits = Number(occupiedUnitsRaw ?? 0) || 0;
    if (vacantUnitsRaw === undefined || vacantUnitsRaw === null) {
      vacantUnitsRaw = totalUnits - occupiedUnits;
    }
    let vacantUnits = Number(vacantUnitsRaw ?? 0);
    if (vacantUnits < 0) vacantUnits = 0;
    
    // Handle address - can be string or object
    let addressObj = parseAddress(property.address);
    // Use street and barangay from backend if available
    if (property.street) addressObj.street = property.street;
    if (property.barangay) addressObj.barangay = property.barangay;
    if (property.postal_code) addressObj.postalCode = property.postal_code;
    
    if (property.address && typeof property.address === 'object') {
      addressObj = {
        street: property.street || property.address.street || property.address.full || property.address.address_line1 || '',
        barangay: property.barangay || property.address.barangay || property.address.address_line2 || '',
        city: property.address.city || property.city || 'Cebu City',
        province: property.address.province || property.province || 'Cebu',
        postalCode: property.postal_code || property.address.postalCode || property.address.postal_code || ''
      };
    } else if (property.city || property.province) {
      addressObj.city = property.city || addressObj.city;
      addressObj.province = property.province || addressObj.province;
    }
    
    const addressString = formatAddressString(addressObj);
    
    return {
      id: property.id,
      ownerId: property.owner_id,
      buildingName: property.building_name || property.title || 'Unnamed Property',
      subdomain: normalizeSubdomain(property.subdomain || property.portal_subdomain || 'no-subdomain'),
      address: addressString,
      addressObj: addressObj, // Store parsed address object for editing
      totalUnits,
      occupiedUnits,
      vacantUnits,
      status: (property.status || 'pending_approval').toLowerCase(),
      adminApproval: property.status === 'approved' || property.status === 'active' ? 'Approved' : property.status === 'rejected' ? 'Rejected' : 'Pending',
      registrationDate: property.created_at,
      approvalDate: property.approval_date || null,
      lastUpdated: property.updated_at,
      monthlyRevenue: property.pricing?.monthly_rent || property.monthly_rent || 0,
      averageRent: property.pricing?.monthly_rent || property.monthly_rent || 0,
      contactPerson: property.contact_person || 'No Contact',
      contactEmail: property.contact_email || 'No Email',
      contactPhone: property.contact_phone || 'No Phone',
      furnishing: property.furnishing || 'Not Specified',
      propertyType: property.property_type || 'Not Specified',
      image: Array.isArray(images) && images.length > 0 ? (typeof images[0] === 'object' ? images[0].url : images[0]) : '',
      images: Array.isArray(images) ? images.map(img => typeof img === 'object' ? img.url : img) : [],
      legalDocs,
      amenities,
      additionalNotes: property.description || property.additional_notes || '',
      city: addressObj.city || property.city || 'Cebu City',
      province: addressObj.province || property.province || 'Cebu'
    };
  };

  // Fetch companies for dropdown (only manager's companies)
  // Function to fetch properties from database
  const fetchPropertiesFromDB = async () => {
    setLoading(true);
    try {
      // Clear localStorage to force fresh API call
      localStorage.removeItem(STORAGE_KEY);
      
      // Ensure we read the same key that login writes
      const currentUserIdRaw = localStorage.getItem('user_id') || localStorage.getItem('owner_id');
      const currentUserId = currentUserIdRaw ? parseInt(currentUserIdRaw, 10) : null;
      console.log('Fetching properties for user ID:', currentUserId);
      const res = await api.getMyProperties(currentUserId ? { owner_id: currentUserId } : {});
      console.log('API Response:', res); // Debug log
      
      // Handle different response formats
      let properties = [];
      if (res && Array.isArray(res.items)) {
        properties = res.items;
      } else if (res && Array.isArray(res.properties)) {
        properties = res.properties;
      } else if (res && Array.isArray(res)) {
        properties = res;
      }
      
      if (properties.length > 0) {
        const mapped = properties
          .map(mapPropertyFromApi)
          .filter(Boolean);
        setBuildings(mapped);
        return;
      } else {
        console.log('No properties found in API response');
      }
    } catch (error) {
      console.error('Error fetching properties from API:', error);
      alert('Failed to load properties from database. Please refresh the page.');
      setBuildings([]);
    } finally {
      setLoading(false);
    }
  };

  // Load buildings from database on mount
  useEffect(() => {
    fetchPropertiesFromDB();
  }, []);

  // Prefill contact info from manager profile (owner/user) if available
  useEffect(() => {
    (async () => {
      try {
        const res = await api.getManagerProfile();
        const info = res?.profile?.personalInfo || {};
        setNewProperty(prev => ({
          ...prev,
          contactPerson: prev.contactPerson || info.name || '',
          contactEmail: prev.contactEmail || info.email || '',
          contactPhone: prev.contactPhone || info.phone || ''
        }));
      } catch (_) {
        // ignore; leave fields empty if profile not available
      }
    })();
  }, []);

  // Reset map location when modal opens
  useEffect(() => {
    if (showAddModal) {
      setMapLocation([10.3157, 123.8854]); // Cebu City
      setSelectedLocation(null);
      setAddressSearch('');
    }
  }, [showAddModal]);

  // Initialize edit modal map location when editing building
  useEffect(() => {
    if (showEditModal && editingBuilding) {
      // Try to geocode the address to set map location
      const addressString = editingBuilding.address || '';
      if (addressString) {
        // Use forward geocoding to find location
        forwardGeocode(`${addressString}, ${editingBuilding.city || 'Cebu City'}, ${editingBuilding.province || 'Cebu'}`)
          .then(results => {
            if (results && results.length > 0) {
              const firstResult = results[0];
              const lat = parseFloat(firstResult.lat);
              const lng = parseFloat(firstResult.lon);
              setEditMapLocation([lat, lng]);
              setEditSelectedLocation({ lat, lng });
            } else {
              // Default to Cebu City if geocoding fails
              setEditMapLocation([10.3157, 123.8854]);
              setEditSelectedLocation(null);
            }
          })
          .catch(() => {
            setEditMapLocation([10.3157, 123.8854]);
            setEditSelectedLocation(null);
          });
      } else {
        setEditMapLocation([10.3157, 123.8854]);
        setEditSelectedLocation(null);
      }
      setEditAddressSearch('');
    }
  }, [showEditModal, editingBuilding]);

  // Save buildings to localStorage
  // Removed localStorage persistence - data comes from database

  // Reset pagination when filters/search change
  useEffect(() => {
    setPage(1);
  }, [searchTerm, statusFilter, sortBy, sortOrder]);

  const filteredBuildings = useMemo(() => {
    const term = (searchTerm || '').trim().toLowerCase();
    return buildings.filter(building => {
      // Search across multiple fields
      const haystacks = [
        building.buildingName,
        building.subdomain,
        building.address,
        building.contactPerson,
        building.contactEmail,
        building.contactPhone
      ].filter(Boolean).map(v => String(v).toLowerCase());
      const matchesSearch = term.length === 0 || haystacks.some(v => v.includes(term));

      // Status matching - handle case-insensitive and normalized values
      const buildingStatus = (building.status || '').toLowerCase();
      const filterStatus = statusFilter.toLowerCase();
      const matchesStatus = statusFilter === 'All' || 
        buildingStatus === filterStatus ||
        (filterStatus === 'active' && (buildingStatus === 'active' || buildingStatus === 'approved')) ||
        (filterStatus === 'approved' && (buildingStatus === 'active' || buildingStatus === 'approved')) ||
        (filterStatus === 'pending' && buildingStatus === 'pending_approval');
      
      return matchesSearch && matchesStatus;
    });
  }, [buildings, searchTerm, statusFilter]);

  const sortedBuildings = useMemo(() => {
    const toDate = (val) => {
      if (!val) return new Date(0);
      const d = typeof val === 'string' ? new Date(val) : val;
      return isNaN(d?.getTime?.()) ? new Date(0) : d;
    };
    const sorted = [...filteredBuildings].sort((a, b) => {
      let comparison = 0;
      switch (sortBy) {
        case 'Recent': {
          const dateA = toDate(a.lastUpdated || a.registrationDate);
          const dateB = toDate(b.lastUpdated || b.registrationDate);
          comparison = dateA - dateB;
          break;
        }
        case 'Revenue':
          comparison = (a.monthlyRevenue || 0) - (b.monthlyRevenue || 0);
          break;
        case 'Units':
          comparison = (a.totalUnits || 0) - (b.totalUnits || 0);
          break;
        case 'Name':
          comparison = (a.buildingName || '').localeCompare(b.buildingName || '');
          break;
        default:
          comparison = 0;
      }
      return sortOrder === 'desc' ? -comparison : comparison;
    });
    return sorted;
  }, [filteredBuildings, sortBy, sortOrder]);

  const currentPageItems = useMemo(() => {
    const startIndex = (page - 1) * itemsPerPage;
    return sortedBuildings.slice(startIndex, startIndex + itemsPerPage);
  }, [sortedBuildings, page]);

  const totalPages = Math.ceil(sortedBuildings.length / itemsPerPage);

  const formatDate = (date) => {
    if (!date) return 'N/A';
    // Convert string to Date object if needed
    const dateObj = typeof date === 'string' ? new Date(date) : date;
    if (isNaN(dateObj.getTime())) return 'N/A';
    return dateObj.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric'
    });
  };

  const formatCurrency = (amount) => {
    return new Intl.NumberFormat('en-PH', {
      style: 'currency',
      currency: 'PHP',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0
    }).format(amount);
  };

  const getFileTypeIcon = (fileType) => {
    if (!fileType) return 'document';
    
    if (fileType.startsWith('image/')) return 'image';
    if (fileType.includes('pdf')) return 'pdf';
    if (fileType.includes('word') || fileType.includes('document')) return 'word';
    if (fileType.includes('text')) return 'text';
    return 'document';
  };


  const getSubdomainUrl = (subdomain) => {
    // Build a correct portal URL for both local dev and production
    const host = window.location.hostname || '';
    const clean = normalizeSubdomain(subdomain);
    // For localhost we want to open the dedicated sub-domain app (default 8080)
    if (host.includes('localhost')) {
      const devPort = process.env.REACT_APP_SUBDOMAIN_PORT || '8080';
      return `http://${clean}.localhost:${devPort}`;
    }
    // Production: use configurable base domain and protocol
    const baseDomain = process.env.REACT_APP_PORTAL_BASE_DOMAIN || 'jacs.com';
    const protocol = process.env.REACT_APP_PORTAL_PROTOCOL || 'https';
    return `${protocol}://${clean}.${baseDomain}`;
  };

  const getSubdomainDisplay = (subdomain) => {
    if (!subdomain || subdomain === 'no-subdomain' || subdomain === '') {
      return 'No subdomain';
    }
    const host = window.location.hostname || '';
    const clean = normalizeSubdomain(subdomain);
    if (host.includes('localhost')) {
      const devPort = process.env.REACT_APP_SUBDOMAIN_PORT || '8080';
      return `${clean}.localhost:${devPort}`;
    }
    const baseDomain = process.env.REACT_APP_PORTAL_BASE_DOMAIN || 'jacs.com';
    return `${clean}.${baseDomain}`;
  };

  const handleEditClick = async (building) => {
    try {
      setLoading(true);
      
      // Fetch the latest property data from the database
      const response = await fetch(`/api/manager/properties/property/${building.id}`, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('access_token') || localStorage.getItem('token')}`
        }
      });
      
      if (response.ok) {
        const responseData = await response.json();
        const propertyData = responseData.property || responseData;
        console.log('Fetched property data for editing:', propertyData);
        
        // Parse address from property data
        const addressObj = parseAddress(propertyData.address);
        if (propertyData.street) addressObj.street = propertyData.street;
        if (propertyData.barangay) addressObj.barangay = propertyData.barangay;
        if (propertyData.city) addressObj.city = propertyData.city;
        if (propertyData.province) addressObj.province = propertyData.province;
        if (propertyData.postal_code) addressObj.postalCode = propertyData.postal_code;
        
        // Map the API response to our editing format
        const mappedProperty = {
          id: propertyData.id,
          buildingName: propertyData.building_name || propertyData.title || 'Unnamed Property',
          subdomain: normalizeSubdomain(propertyData.subdomain || propertyData.portal_subdomain || 'no-subdomain'),
          address: formatAddressString(addressObj),
          addressObj: addressObj, // Store parsed address for editing
          totalUnits: propertyData.total_units || 0,
          occupiedUnits: propertyData.occupied_units || propertyData.unit_counts?.occupied_units || 0,
          vacantUnits: propertyData.vacant_units || propertyData.unit_counts?.vacant_units || (propertyData.total_units || 0),
          status: (propertyData.status || 'pending_approval').toLowerCase(),
          adminApproval: propertyData.status === 'approved' || propertyData.status === 'active' ? 'Approved' : propertyData.status === 'rejected' ? 'Rejected' : 'Pending',
          registrationDate: propertyData.created_at,
          approvalDate: propertyData.approval_date || null,
          lastUpdated: propertyData.updated_at,
          monthlyRevenue: propertyData.pricing?.monthly_rent || propertyData.monthly_rent || 0,
          averageRent: propertyData.pricing?.monthly_rent || propertyData.monthly_rent || 0,
          contactPerson: propertyData.contact_person || 'No Contact',
          contactEmail: propertyData.contact_email || 'No Email',
          contactPhone: propertyData.contact_phone || 'No Phone',
          furnishing: propertyData.furnishing || 'Not Specified',
          propertyType: propertyData.property_type || 'Not Specified',
          image: propertyData.images ? (Array.isArray(propertyData.images) ? (propertyData.images[0]?.url || propertyData.images[0] || '') : parseArrayField(propertyData.images)[0] || '') : '',
          images: Array.isArray(propertyData.images) ? propertyData.images.map(img => typeof img === 'object' ? img.url : img) : parseArrayField(propertyData.images),
          legalDocs: parseArrayField(propertyData.legal_documents),
          amenities: parseArrayField(propertyData.amenities),
          additionalNotes: propertyData.description || propertyData.additional_notes || '',
          city: addressObj.city || propertyData.city || 'Cebu City',
          province: addressObj.province || propertyData.province || 'Cebu',
          latitude: propertyData.latitude || null,
          longitude: propertyData.longitude || null
        };
        
        setEditingBuilding(mappedProperty);
        setShowEditModal(true);
      } else {
        const errorData = await response.json().catch(() => ({}));
        console.error('Failed to fetch property details:', response.status, errorData);
        alert(`Failed to fetch property details: ${errorData.message || 'Server error'}`);
        // Fallback to local data if API fails
        setEditingBuilding({ 
          ...building,
          images: building.images || [],
          legalDocs: building.legalDocs || [],
          amenities: building.amenities || [],
          customAmenity: '',
          additionalNotes: building.additionalNotes || ''
        });
        setShowEditModal(true);
      }
    } catch (error) {
      console.error('Error fetching property details:', error);
      alert(`Error fetching property details: ${error.message || 'Network error'}`);
      // Fallback to local data if API fails
      setEditingBuilding({ 
        ...building,
        images: building.images || [],
        legalDocs: building.legalDocs || [],
        amenities: building.amenities || [],
        customAmenity: '',
        additionalNotes: building.additionalNotes || ''
      });
      setShowEditModal(true);
    } finally {
      setLoading(false);
    }
  };

  const handleSaveEdit = async () => {
    if (!editingBuilding) return;
    
    try {
      setLoading(true);
      
      // Format address from addressObj if available, otherwise use address string
      const addressString = editingBuilding.addressObj ? formatAddressString(editingBuilding.addressObj) : editingBuilding.address;
      const addressObj = editingBuilding.addressObj || parseAddress(editingBuilding.address);
      
      // Prepare the data for API call
      const updateData = {
        title: editingBuilding.buildingName,
        building_name: editingBuilding.buildingName,
        description: editingBuilding.additionalNotes || '',
        property_type: editingBuilding.propertyType,
        address: addressString,
        street: addressObj.street || '',
        barangay: addressObj.barangay || '',
        city: addressObj.city || editingBuilding.city || 'Cebu City',
        province: addressObj.province || editingBuilding.province || 'Cebu',
        postal_code: addressObj.postalCode || '',
        latitude: editingBuilding.latitude || null,
        longitude: editingBuilding.longitude || null,
        total_units: parseInt(editingBuilding.totalUnits) || 1,
        contact_person: editingBuilding.contactPerson,
        contact_email: editingBuilding.contactEmail,
        contact_phone: editingBuilding.contactPhone,
        monthly_rent: parseFloat(editingBuilding.averageRent) || 0,
        furnishing: editingBuilding.furnishing,
        status: editingBuilding.status,
        images: JSON.stringify(editingBuilding.images || []),
        legal_documents: JSON.stringify(editingBuilding.legalDocs || []),
        amenities: JSON.stringify(editingBuilding.amenities || [])
      };
      
      console.log('Updating property with data:', updateData);
      
      // Make API call to update property
      const response = await fetch(`/api/manager/properties/property/${editingBuilding.id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('access_token') || localStorage.getItem('token')}`
        },
        body: JSON.stringify(updateData)
      });
      
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || 'Failed to update property');
      }
      
      const result = await response.json();
      console.log('Property updated successfully:', result);
      
      // Update local state with the updated property
    const original = buildings.find(b => b.id === editingBuilding.id);
      const updated = { 
        ...editingBuilding, 
        lastUpdated: new Date(),
        // Set main image from first image in images array
        image: editingBuilding.images && editingBuilding.images.length > 0 
          ? editingBuilding.images[0] 
          : editingBuilding.image || 'data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iNjAwIiBoZWlnaHQ9IjQwMCIgdmlld0JveD0iMCAwIDYwMCA0MDAiIGZpbGw9Im5vbmUiIHhtbG5zPSJodHRwOi8vd3d3LnczLm9yZy8yMDAwL3N2ZyI+CjxyZWN0IHdpZHRoPSI2MDAiIGhlaWdodD0iNDAwIiBmaWxsPSIjRjNGNEY2Ii8+CjxwYXRoIGQ9Ik0yNzUgMTUwSDMyNVYyNTBIMjc1VjE1MFoiIGZpbGw9IiM5Q0EzQUYiLz4KPHBhdGggZD0iTTI1MCAyMDBIMzUwVjIyMEgyNTBWMjAwWiIgZmlsbD0iIzlDQTNBRiIvPgo8dGV4dCB4PSIzMDAiIHk9IjMwMCIgZm9udC1mYW1pbHk9IkFyaWFsLCBzYW5zLXNlcmlmIiBmb250LXNpemU9IjE4IiBmaWxsPSIjNkI3MjgwIiB0ZXh0LWFuY2hvcj0ibWlkZGxlIj5Qcm9wZXJ0eSBJbWFnZTwvdGV4dD4KPC9zdmc+',
        // Ensure arrays are properly initialized
        images: editingBuilding.images || [],
        legalDocs: editingBuilding.legalDocs || [],
        amenities: editingBuilding.amenities || []
      };
      
      // Handle status changes and approval dates
      if (original && original.status !== editingBuilding.status) {
        // If status changed from pending_approval to active, set approval date
        if (original.status === 'pending_approval' && editingBuilding.status === 'active') {
      updated.approvalDate = new Date();
      }
        // If status changed to rejected, clear approval date
        if (editingBuilding.status === 'rejected') {
          updated.approvalDate = null;
    }
      }
      
    setBuildings(prev => prev.map(b => (b.id === updated.id ? updated : b)));
    setShowEditModal(false);
    setEditingBuilding(null);
      
      // Show success message
      alert('Property updated successfully!');
      
      // Refresh the properties list to get the latest data
      await fetchPropertiesFromDB();
      
    } catch (error) {
      console.error('Error updating property:', error);
      alert(`Failed to update property: ${error.message}`);
    } finally {
      setLoading(false);
    }
  };

  const handleViewDetails = (building) => {
    setDetailsBuilding(building);
    setShowDetailsModal(true);
  };

  const handleInputChange = (field, value) => {
    setNewProperty(prev => ({
      ...prev,
      [field]: value
    }));
  };

  // Handle map click - reverse geocode the clicked location
  const handleMapClick = async (latlng) => {
    setSelectedLocation(latlng);
    setMapLocation([latlng.lat, latlng.lng]);
    setIsGeocoding(true);
    
    try {
      const geocodeData = await reverseGeocode(latlng.lat, latlng.lng);
      if (geocodeData && geocodeData.address) {
        const addr = geocodeData.address;
        setNewProperty(prev => ({
          ...prev,
          address: {
            street: addr.road || addr.house_number ? `${addr.house_number || ''} ${addr.road || ''}`.trim() : prev.address.street,
            barangay: addr.suburb || addr.neighbourhood || addr.village || prev.address.barangay,
            city: addr.city || addr.town || addr.municipality || prev.address.city,
            province: addr.state || addr.province || prev.address.province,
            postalCode: addr.postcode || prev.address.postalCode
          },
          latitude: latlng.lat,
          longitude: latlng.lng
        }));
      } else {
        // Still save coordinates even if geocoding fails
        setNewProperty(prev => ({
          ...prev,
          latitude: latlng.lat,
          longitude: latlng.lng
        }));
      }
    } catch (error) {
      console.error('Error reverse geocoding:', error);
      // Still save coordinates even if geocoding fails
      setNewProperty(prev => ({
        ...prev,
        latitude: latlng.lat,
        longitude: latlng.lng
      }));
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
      if (results && results.length > 0) {
        const firstResult = results[0];
        const lat = parseFloat(firstResult.lat);
        const lng = parseFloat(firstResult.lon);
        
        setMapLocation([lat, lng]);
        setSelectedLocation({ lat, lng });
        
        // Update address fields from search result
        if (firstResult.address) {
          const addr = firstResult.address;
          setNewProperty(prev => ({
            ...prev,
            address: {
              street: addr.road || addr.house_number ? `${addr.house_number || ''} ${addr.road || ''}`.trim() : prev.address.street,
              barangay: addr.suburb || addr.neighbourhood || addr.village || prev.address.barangay,
              city: addr.city || addr.town || addr.municipality || prev.address.city || 'Cebu City',
              province: addr.state || addr.province || prev.address.province || 'Cebu',
              postalCode: addr.postcode || prev.address.postalCode
            },
            latitude: lat,
            longitude: lng
          }));
        } else {
          // Still save coordinates even if address parsing fails
          setNewProperty(prev => ({
            ...prev,
            latitude: lat,
            longitude: lng
          }));
        }
        setAddressSearch('');
      } else {
        alert('No results found for this address. Please try a different search term.');
      }
    } catch (error) {
      console.error('Error searching address:', error);
      alert('Error searching address. Please try again.');
    } finally {
      setIsGeocoding(false);
    }
  };

  // Handle edit modal map click
  const handleEditMapClick = async (latlng) => {
    setEditSelectedLocation(latlng);
    setEditMapLocation([latlng.lat, latlng.lng]);
    setEditIsGeocoding(true);
    
    try {
      const geocodeData = await reverseGeocode(latlng.lat, latlng.lng);
      if (geocodeData && geocodeData.address) {
        const addr = geocodeData.address;
        setEditingBuilding(prev => ({
          ...prev,
          addressObj: {
            street: addr.road || addr.house_number ? `${addr.house_number || ''} ${addr.road || ''}`.trim() : (prev.addressObj?.street || ''),
            barangay: addr.suburb || addr.neighbourhood || addr.village || (prev.addressObj?.barangay || ''),
            city: addr.city || addr.town || addr.municipality || (prev.addressObj?.city || prev.city || 'Cebu City'),
            province: addr.state || addr.province || (prev.addressObj?.province || prev.province || 'Cebu'),
            postalCode: addr.postcode || (prev.addressObj?.postalCode || '')
          },
          city: addr.city || addr.town || addr.municipality || prev.city || 'Cebu City',
          province: addr.state || addr.province || prev.province || 'Cebu',
          latitude: latlng.lat,
          longitude: latlng.lng
        }));
      } else {
        // Still save coordinates even if geocoding fails
        setEditingBuilding(prev => ({
          ...prev,
          latitude: latlng.lat,
          longitude: latlng.lng
        }));
      }
    } catch (error) {
      console.error('Error reverse geocoding:', error);
      // Still save coordinates even if geocoding fails
      setEditingBuilding(prev => ({
        ...prev,
        latitude: latlng.lat,
        longitude: latlng.lng
      }));
    } finally {
      setEditIsGeocoding(false);
    }
  };

  // Handle edit modal address search
  const handleEditAddressSearch = async () => {
    if (!editAddressSearch.trim()) return;
    
    setEditIsGeocoding(true);
    try {
      const results = await forwardGeocode(editAddressSearch);
      if (results && results.length > 0) {
        const firstResult = results[0];
        const lat = parseFloat(firstResult.lat);
        const lng = parseFloat(firstResult.lon);
        
        setEditMapLocation([lat, lng]);
        setEditSelectedLocation({ lat, lng });
        
        // Update address fields from search result
        if (firstResult.address) {
          const addr = firstResult.address;
          setEditingBuilding(prev => ({
            ...prev,
            addressObj: {
              street: addr.road || addr.house_number ? `${addr.house_number || ''} ${addr.road || ''}`.trim() : (prev.addressObj?.street || ''),
              barangay: addr.suburb || addr.neighbourhood || addr.village || (prev.addressObj?.barangay || ''),
              city: addr.city || addr.town || addr.municipality || (prev.addressObj?.city || prev.city || 'Cebu City'),
              province: addr.state || addr.province || (prev.addressObj?.province || prev.province || 'Cebu'),
              postalCode: addr.postcode || (prev.addressObj?.postalCode || '')
            },
            city: addr.city || addr.town || addr.municipality || prev.city || 'Cebu City',
            province: addr.state || addr.province || prev.province || 'Cebu',
            latitude: lat,
            longitude: lng
          }));
        } else {
          // Still save coordinates even if address parsing fails
          setEditingBuilding(prev => ({
            ...prev,
            latitude: lat,
            longitude: lng
          }));
        }
        setEditAddressSearch('');
      } else {
        alert('No results found for this address. Please try a different search term.');
      }
    } catch (error) {
      console.error('Error searching address:', error);
      alert('Error searching address. Please try again.');
    } finally {
      setEditIsGeocoding(false);
    }
  };


  const handleLegalUpload = (event) => {
    const files = Array.from(event.target.files);
    if (files.length === 0) return;
    
    const newDocs = files.map(file => ({
      type: 'legal_document',
      filename: file.name,
      size: `${(file.size / 1024 / 1024).toFixed(2)} MB`,
      path: URL.createObjectURL(file), // This will be a blob URL for now
      status: 'pending',
      uploaded_at: new Date().toISOString(),
      fileType: file.type,
      file: file // Store the actual file object for later upload
    }));
    setNewProperty(prev => ({
      ...prev,
      legalDocs: [...prev.legalDocs, ...newDocs]
    }));
    
    // Clear the input so the same file can be selected again
    event.target.value = '';
  };

  const removeLegalDoc = (index) => {
    setNewProperty(prev => ({
      ...prev,
      legalDocs: prev.legalDocs.filter((_, i) => i !== index)
    }));
  };

  // Upload new property images to backend and store URLs
  const handlePropertyImageUpload = async (event) => {
    const files = Array.from(event.target.files);
    if (files.length === 0) return;
    // Prevent exceeding 10-image limit
    setNewProperty((prev) => {
      if ((prev.images?.length || 0) >= 10) return prev;
      return prev;
    });
    let uploading = false;
    try {
      uploading = true;
      const uploadedUrls = [];
      for (let i = 0; i < files.length; i++) {
        const file = files[i];
        // Call backend API
        const res = await api.uploadPropertyImage(file);
        if (res?.url) {
          uploadedUrls.push(res.url);
        }
      }
      setNewProperty((prev) => ({
        ...prev,
        images: [...(prev.images || []), ...uploadedUrls].slice(0, 10)
      }));
    } catch (error) {
      alert('Image upload failed: ' + (error.message || 'Unknown error'));
    } finally {
      uploading = false;
      event.target.value = '';
    }
  };

  const removePropertyImage = (index) => {
    setNewProperty(prev => ({
      ...prev,
      images: prev.images.filter((_, i) => i !== index)
    }));
  };

  // Edit modal handler: like above, but for editingBuilding
  const handleEditPropertyImageUpload = async (event) => {
    const files = Array.from(event.target.files);
    if (files.length === 0) return;
    let uploading = false;
    try {
      uploading = true;
      const uploadedUrls = [];
      for (let i = 0; i < files.length; i++) {
        const file = files[i];
        // Call backend API
        const res = await api.uploadPropertyImage(file);
        if (res?.url) {
          uploadedUrls.push(res.url);
        }
      }
      setEditingBuilding((prev) => ({
        ...prev,
        images: [...(prev.images || []), ...uploadedUrls].slice(0, 10)
      }));
    } catch (error) {
      alert('Image upload failed: ' + (error.message || 'Unknown error'));
    } finally {
      uploading = false;
      event.target.value = '';
    }
  };

  const removeEditPropertyImage = (index) => {
    setEditingBuilding(prev => ({
      ...prev,
      images: prev.images.filter((_, i) => i !== index)
    }));
  };

  const handleEditLegalUpload = (event) => {
    const files = Array.from(event.target.files);
    if (files.length === 0) return;
    
    const newDocs = files.map(file => ({
      type: 'legal_document',
      filename: file.name,
      size: `${(file.size / 1024 / 1024).toFixed(2)} MB`,
      path: URL.createObjectURL(file),
      status: 'pending',
      uploaded_at: new Date().toISOString(),
      fileType: file.type,
      file: file // Store the actual file object for later upload
    }));
    setEditingBuilding(prev => ({
      ...prev,
      legalDocs: [...(prev.legalDocs || []), ...newDocs]
    }));
    
    // Clear the input so the same file can be selected again
    event.target.value = '';
  };

  const removeEditLegalDoc = (index) => {
    setEditingBuilding(prev => ({
      ...prev,
      legalDocs: prev.legalDocs.filter((_, i) => i !== index)
    }));
  };


  const handleSubmit = (e) => {
    e.preventDefault();
    
    // Validate required fields
    if (!newProperty.buildingName.trim()) {
      alert('Property name is required');
      return;
    }
    if (!newProperty.subdomain.trim()) {
      alert('Property subdomain is required');
      return;
    }
    if (!newProperty.address.street?.trim()) {
      alert('Street address is required');
      return;
    }
    if (!newProperty.address.city?.trim()) {
      alert('City is required');
      return;
    }
    if (!newProperty.address.province?.trim()) {
      alert('Province is required');
      return;
    }
    if (!newProperty.contactPerson.trim()) {
      alert('Contact person is required');
      return;
    }
    if (!newProperty.contactEmail.trim()) {
      alert('Contact email is required');
      return;
    }
    if (!newProperty.contactPhone.trim()) {
      alert('Contact phone is required');
      return;
    }
    
    // Create new building entry with defaults
    const now = new Date();
    const averageRent = parseInt(newProperty.averageRent || '0', 10) || 0;
    const totalUnitsNum = parseInt(newProperty.totalUnits || '0', 10) || 0;
    
    // Format address string from address object
    const addressString = formatAddressString(newProperty.address);
    
    const newBuilding = {
      id: Date.now(),
      buildingName: newProperty.buildingName.trim(),
      subdomain: newProperty.subdomain.trim().toLowerCase(),
      address: addressString,
      totalUnits: totalUnitsNum,
      occupiedUnits: 0,
      vacantUnits: totalUnitsNum,
      status: 'pending_approval',
      adminApproval: 'Pending',
      registrationDate: now,
      approvalDate: null,
      lastUpdated: now,
      monthlyRevenue: 0,
      averageRent,
      propertyType: newProperty.propertyType || '',
      contactPerson: newProperty.contactPerson.trim(),
      contactEmail: newProperty.contactEmail.trim(),
      contactPhone: newProperty.contactPhone.trim(),
      furnishing: newProperty.furnishing || '',
      image: newProperty.images && newProperty.images.length > 0 ? newProperty.images[0] : defaultProperty,
      legalDocs: newProperty.legalDocs || []
    };
    // Don't add to local state - let API call refresh the data
    // Fire-and-forget API persist; on success, replace temp ID with DB ID
    (async () => {
      try {
        const currentUserIdRawCreate = localStorage.getItem('user_id');
        const payload = {
          building_name: newBuilding.buildingName,
          subdomain: newBuilding.subdomain,
          address: addressString, // Combined address string
          street: newProperty.address.street || '',
          barangay: newProperty.address.barangay || '',
          city: newProperty.address.city || 'Cebu City',
          province: newProperty.address.province || 'Cebu',
          postal_code: newProperty.address.postalCode || '',
          latitude: newProperty.latitude || null,
          longitude: newProperty.longitude || null,
          total_units: newBuilding.totalUnits,
          monthly_rent: newProperty.averageRent || null,
          property_type: newProperty.propertyType || 'bed_space',
          furnishing: newProperty.furnishing || 'UNFURNISHED',
          contact_person: newBuilding.contactPerson,
          contact_email: newBuilding.contactEmail,
          contact_phone: newBuilding.contactPhone,
          amenities: JSON.stringify(newProperty.amenities || []),
          images: JSON.stringify(newProperty.images || []),
          additional_notes: newProperty.additionalNotes || '',
          legal_documents: JSON.stringify(newProperty.legalDocs || []),
          owner_id: currentUserIdRawCreate ? parseInt(currentUserIdRawCreate, 10) : undefined
        };
        console.log('Sending payload:', payload);
        const res = await api.addProperty(payload);
        console.log('API response:', res);
              if (res && res.item && res.item.id) {
                console.log('Property created successfully with ID:', res.item.id);
                // Refresh the entire list from API
                const refreshRes = await api.getMyProperties({ owner_id: currentUserIdRawCreate ? parseInt(currentUserIdRawCreate, 10) : null });
                let refreshedList = [];
                if (refreshRes && Array.isArray(refreshRes.properties)) {
                  refreshedList = refreshRes.properties;
                } else if (Array.isArray(refreshRes?.items)) {
                  refreshedList = refreshRes.items;
                } else if (Array.isArray(refreshRes)) {
                  refreshedList = refreshRes;
                }
                if (refreshedList.length) {
                  setBuildings(refreshedList.map(mapPropertyFromApi).filter(Boolean));
                }
              } else {
                console.error('Unexpected API response format:', res);
              }
      } catch (err) {
        console.error('Failed to persist managed property:', err);
        alert(`Failed to create property: ${err.message || 'Unknown error'}`);
      }
    })();
    setShowAddModal(false);
    // Reset form
    setMapLocation([10.3157, 123.8854]); // Reset to Cebu City
    setSelectedLocation(null);
    setAddressSearch('');
    setNewProperty({
      buildingName: '',
      subdomain: '',
      address: {
        street: '',
        barangay: '',
        city: 'Cebu City',
        province: 'Cebu',
        postalCode: ''
      },
      latitude: null,
      longitude: null,
      totalUnits: '',
      propertyType: '',
      yearBuilt: '',
      floorCount: '',
      parkingSpaces: '',
      contactPerson: '',
      contactPosition: '',
      contactEmail: '',
      contactPhone: '',
      businessRegNumber: '',
      tin: '',
      businessPermitNumber: '',
      businessPermitExpiry: '',
      fireSafetyCert: null,
      buildingPermit: null,
      occupancyPermit: null,
      electricalCert: null,
      amenities: [],
      customAmenity: '',
      additionalNotes: '',
      images: [],
      averageRent: '',
      furnishing: '',
      legalDocs: []
    });
  };

  // Helper for details modal: get images array from detailsBuilding
  function getDetailsImages(building) {
    if (!building) return [];
    const sourceImages = Array.isArray(building.images) ? building.images : parseArrayField(building.images);
    return sourceImages.filter(Boolean).map((img) => getImageSrc(img));
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Hero Header */}
        <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-gray-800 via-gray-900 to-black text-white mb-8">
          <div className="absolute inset-0 bg-black/20"></div>
          <div className="relative p-8">
            <div className="flex flex-col lg:flex-row items-start lg:items-center justify-between space-y-4 lg:space-y-0">
              <div>
                <h1 className="text-3xl font-bold mb-2">Property Management</h1>
                <p className="text-gray-300 text-lg">Manage your property and subdomains</p>
                <div className="flex items-center space-x-6 mt-4">
                  <div className="flex items-center space-x-2">
                    <div className="w-3 h-3 bg-green-400 rounded-full"></div>
                    <span className="text-sm">{buildings.filter(b => (b.status || '').toLowerCase() === 'active' || (b.status || '').toLowerCase() === 'approved').length} Active</span>
                  </div>
                  <div className="flex items-center space-x-2">
                    <div className="w-3 h-3 bg-yellow-400 rounded-full"></div>
                    <span className="text-sm">{buildings.filter(b => (b.status || '').toLowerCase() === 'pending_approval').length} Pending</span>
                  </div>
                  <div className="flex items-center space-x-2">
                    <div className="w-3 h-3 bg-gray-400 rounded-full"></div>
                    <span className="text-sm">{buildings.filter(b => (b.status || '').toLowerCase() === 'inactive').length} Inactive</span>
                  </div>
                </div>
              </div>
              <div className="flex space-x-3">
                <button 
                  onClick={fetchPropertiesFromDB}
                  disabled={loading}
                  className="bg-white/10 backdrop-blur-sm border border-white/20 text-white px-4 py-3 rounded-xl hover:bg-white/20 transition-all duration-200 font-medium disabled:opacity-50"
                >
                  {loading ? (
                    <div className="flex items-center">
                      <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                      Loading...
                    </div>
                  ) : (
                    <div className="flex items-center">
                      <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                      </svg>
                      Refresh
                    </div>
                  )}
                </button>
                <button 
                  onClick={() => setShowAddModal(true)}
                  className="bg-white/10 backdrop-blur-sm border border-white/20 text-white px-6 py-3 rounded-xl hover:bg-white/20 transition-all duration-200 font-medium"
                >
                  Add New Property
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* Filters and Search */}
        <div className="bg-white rounded-2xl shadow-lg border border-gray-100 p-6 mb-8">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-bold text-gray-900 flex items-center">
              <svg className="w-5 h-5 mr-2 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 4a1 1 0 011-1h16a1 1 0 011 1v2.586a1 1 0 01-.293.707l-6.414 6.414a1 1 0 00-.293.707V17l-4 4v-6.586a1 1 0 00-.293-.707L3.293 7.293A1 1 0 013 6.586V4z" />
              </svg>
              Filters & Search
            </h2>
            {(searchTerm || statusFilter !== 'All') && (
              <button
                onClick={() => {
                  setSearchTerm('');
                  setStatusFilter('All');
                  setSortBy('Recent');
                }}
                className="text-sm text-blue-600 hover:text-blue-800 font-medium flex items-center transition-colors"
              >
                <svg className="w-4 h-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
                Clear Filters
              </button>
            )}
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {/* Search Input */}
            <div className="lg:col-span-1">
              <label className="block text-sm font-semibold text-gray-700 mb-2 flex items-center">
                <svg className="w-4 h-4 mr-1.5 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                </svg>
                Search Properties
              </label>
              <div className="relative">
              <input
                type="text"
                  placeholder="Search by name, address, contact..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                  className="w-full pl-10 pr-4 py-3 border border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all duration-200"
              />
                <svg className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                </svg>
                {searchTerm && (
                  <button
                    onClick={() => setSearchTerm('')}
                    className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-gray-600"
                  >
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </button>
                )}
            </div>
              {searchTerm && (
                <p className="text-xs text-gray-500 mt-1">
                  {filteredBuildings.length} {filteredBuildings.length === 1 ? 'property' : 'properties'} found
                </p>
              )}
            </div>

            {/* Status Filter */}
            <div className="lg:col-span-1">
              <label className="block text-sm font-semibold text-gray-700 mb-2 flex items-center">
                <svg className="w-4 h-4 mr-1.5 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                Filter by Status
              </label>
              <div className="relative">
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                  className="w-full pl-10 pr-10 py-3 border border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all duration-200 appearance-none bg-white cursor-pointer"
              >
                <option value="All">All Status</option>
                  <option value="pending_approval">Pending Approval</option>
                  <option value="active">Active</option>
                  <option value="approved">Approved</option>
                  <option value="inactive">Inactive</option>
                  <option value="rejected">Rejected</option>
              </select>
                <div className="absolute left-3 top-1/2 transform -translate-y-1/2 pointer-events-none">
                  <svg className="w-5 h-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
            </div>
                <div className="absolute right-3 top-1/2 transform -translate-y-1/2 pointer-events-none">
                  <svg className="w-5 h-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                  </svg>
                </div>
              </div>
              {statusFilter !== 'All' && (
                <p className="text-xs text-gray-500 mt-1">
                  {buildings.filter(b => {
                    const buildingStatus = (b.status || '').toLowerCase();
                    const filterStatus = statusFilter.toLowerCase();
                    return buildingStatus === filterStatus ||
                      (filterStatus === 'active' && (buildingStatus === 'active' || buildingStatus === 'approved')) ||
                      (filterStatus === 'approved' && (buildingStatus === 'active' || buildingStatus === 'approved')) ||
                      (filterStatus === 'pending' && buildingStatus === 'pending_approval');
                  }).length} {statusFilter === 'pending_approval' ? 'pending' : statusFilter} {buildings.filter(b => {
                    const buildingStatus = (b.status || '').toLowerCase();
                    const filterStatus = statusFilter.toLowerCase();
                    return buildingStatus === filterStatus ||
                      (filterStatus === 'active' && (buildingStatus === 'active' || buildingStatus === 'approved')) ||
                      (filterStatus === 'approved' && (buildingStatus === 'active' || buildingStatus === 'approved')) ||
                      (filterStatus === 'pending' && buildingStatus === 'pending_approval');
                  }).length === 1 ? 'property' : 'properties'}
                </p>
              )}
            </div>

            {/* Sort By */}
            <div className="lg:col-span-1">
              <label className="block text-sm font-semibold text-gray-700 mb-2 flex items-center">
                <svg className="w-4 h-4 mr-1.5 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 4h13M3 8h9m-9 4h6m4 0l4-4m0 0l4 4m-4-4v12" />
                </svg>
                Sort By
              </label>
              <div className="relative">
              <select
                value={sortBy}
                onChange={(e) => setSortBy(e.target.value)}
                  className="w-full pl-10 pr-10 py-3 border border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all duration-200 appearance-none bg-white cursor-pointer"
              >
                  <option value="Recent">Most Recent</option>
                  <option value="Revenue">Highest Revenue</option>
                  <option value="Units">Most Units</option>
                  <option value="Name">Name (A-Z)</option>
              </select>
                <div className="absolute left-3 top-1/2 transform -translate-y-1/2 pointer-events-none">
                  <svg className="w-5 h-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 4h13M3 8h9m-9 4h6m4 0l4-4m0 0l4 4m-4-4v12" />
                  </svg>
            </div>
                <div className="absolute right-3 top-1/2 transform -translate-y-1/2 pointer-events-none">
                  <svg className="w-5 h-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                  </svg>
                </div>
              </div>
              <p className="text-xs text-gray-500 mt-1">
                Showing {currentPageItems.length} of {sortedBuildings.length} properties
              </p>
          </div>
          </div>

          {/* Active Filters Badge */}
          {(searchTerm || statusFilter !== 'All') && (
            <div className="mt-4 pt-4 border-t border-gray-200">
              <div className="flex items-center flex-wrap gap-2">
                <span className="text-xs font-medium text-gray-600">Active filters:</span>
                {searchTerm && (
                  <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
                    Search: "{searchTerm}"
                    <button
                      onClick={() => setSearchTerm('')}
                      className="ml-2 hover:text-blue-600"
                    >
                      <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                      </svg>
                    </button>
                  </span>
                )}
                {statusFilter !== 'All' && (
                  <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-medium bg-purple-100 text-purple-800">
                    Status: {formatStatusDisplay(statusFilter)}
                    <button
                      onClick={() => setStatusFilter('All')}
                      className="ml-2 hover:text-purple-600"
                    >
                      <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                      </svg>
                    </button>
                  </span>
                )}
              </div>
            </div>
          )}
        </div>

        {/* Buildings Grid */}
        {currentPageItems.length === 0 ? (
          <div className="bg-white rounded-2xl shadow-lg border border-gray-100 p-12 text-center">
            {buildings.length === 0 ? (
              <div>
                <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4">
                  <svg className="w-8 h-8 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
                  </svg>
                </div>
                <h3 className="text-lg font-semibold text-gray-900 mb-2">No Property available</h3>
                <p className="text-gray-600 mb-4">Get started by adding your first property</p>
                <button 
                  onClick={() => setShowAddModal(true)}
                  className="bg-black text-white px-6 py-3 rounded-xl hover:bg-gray-800 transition-colors"
                >
                  Add New Property
                </button>
              </div>
            ) : (
              <div>
                <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4">
                  <svg className="w-8 h-8 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                  </svg>
                </div>
                <h3 className="text-lg font-semibold text-gray-900 mb-2">No property match your filters</h3>
                <p className="text-gray-600">Try adjusting your search criteria</p>
              </div>
            )}
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {currentPageItems.map((building) => (
              <div key={building.id} className="bg-white rounded-2xl shadow-lg border border-gray-100 overflow-hidden hover:shadow-xl transition-all duration-300">
                {/* Building Image */}
                <div className="relative h-60 bg-gray-200 flex items-center justify-center">
                  <img
                    src={getImageSrc(building.image)}
                    alt={building.buildingName}
                    className="w-full object-cover rounded-lg"
                    onError={(e) => { e.target.src = defaultProperty; }}
                  />
                  <div className="absolute top-3 left-3">
                    <input
                      type="checkbox"
                      checked={selectedIds.has(building.id)}
                      onChange={(e) => {
                        const newSelected = new Set(selectedIds);
                        if (e.target.checked) {
                          newSelected.add(building.id);
                        } else {
                          newSelected.delete(building.id);
                        }
                        setSelectedIds(newSelected);
                      }}
                      className="w-5 h-5 text-black border-gray-300 rounded focus:ring-black"
                    />
                  </div>
                  <div className="absolute top-3 right-3">
                    <span className={`px-3 py-1 rounded-full text-xs font-semibold border ${getStatusBadgeClass(building.status)}`}>
                      {formatStatusDisplay(building.status)}
                    </span>
                  </div>
                  <div className="absolute bottom-3 left-3">
                    <span className="px-2 py-1 rounded text-xs font-semibold bg-white bg-opacity-90 text-gray-700 border border-gray-200">
                      {building.totalUnits} units
                    </span>
                  </div>
                </div>

                {/* Building Details */}
                <div className="p-6">
                  <div className="flex items-start justify-between mb-3">
                    <div>
                      <h3 className="font-bold text-gray-900 text-lg mb-1">{building.buildingName}</h3>
                      <p className="text-gray-500 text-xs capitalize">{building.propertyType}</p>
                    </div>
                    <div className="text-right">
                      <p className="text-lg font-bold text-black">{formatCurrency(building.monthlyRevenue)}</p>
                      <p className="text-gray-500 text-sm">monthly revenue</p>
                    </div>
                  </div>

                  {/* Subdomain */}
                  <div className="mb-4">
                    <div className="flex items-center justify-between">
                      <span className="text-sm text-gray-500">Subdomain:</span>
                      {building.status === 'pending_approval' ? (
                        <span className="text-sm font-medium text-gray-400 cursor-not-allowed">
                          {getSubdomainDisplay(building.subdomain)} (Pending Approval)
                        </span>
                      ) : (
                      <a 
                        href={getSubdomainUrl(building.subdomain)}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-sm font-medium text-blue-600 hover:text-blue-800"
                      >
                        {getSubdomainDisplay(building.subdomain)}
                      </a>
                      )}
                    </div>
                  </div>

                  {/* Building Stats */}
                  <div className="grid grid-cols-3 gap-4 mb-4">
                    <div className="text-center">
                      <p className="text-sm text-gray-500">Total Units</p>
                      <p className="font-semibold text-gray-900">{building.totalUnits}</p>
                    </div>
                    <div className="text-center">
                      <p className="text-sm text-gray-500">Occupied</p>
                      <p className="font-semibold text-green-600">{building.occupiedUnits}</p>
                    </div>
                    <div className="text-center">
                      <p className="text-sm text-gray-500">Vacant</p>
                      <p className="font-semibold text-orange-600">{building.vacantUnits}</p>
                    </div>
                  </div>

                  {/* Contact Info */}
                  <div className="mb-4 text-sm text-gray-600">
                    <p><span className="font-medium">Contact:</span> {building.contactPerson}</p>
                    <p><span className="font-medium">Email:</span> {building.contactEmail}</p>
                  </div>

                  {/* Registration and Last Updated */}
                  <div className="flex items-center justify-between mb-4 text-sm text-gray-500">
                    <span>Registered: {formatDate(building.registrationDate)}</span>
                    <span>Updated: {formatDate(building.lastUpdated)}</span>
                  </div>

                  {/* Action Buttons */}
                  <div className="flex space-x-2">
                    <button 
                      onClick={() => handleEditClick(building)} 
                      disabled={loading}
                      className={`flex-1 py-2 px-4 rounded-lg transition-colors text-sm font-medium ${
                        loading 
                          ? 'bg-gray-300 text-gray-500 cursor-not-allowed' 
                          : 'bg-black text-white hover:bg-gray-800'
                      }`}
                    >
                      {loading ? (
                        <div className="flex items-center justify-center">
                          <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-gray-500 mr-2"></div>
                          Loading...
                        </div>
                      ) : (
                        'Edit'
                      )}
                    </button>
                    <button onClick={() => handleViewDetails(building)} className="flex-1 bg-gray-100 text-gray-700 py-2 px-4 rounded-lg hover:bg-gray-200 transition-colors text-sm font-medium">
                      View Details
                    </button>
                    <button onClick={() => onOpenManageUnits(building)} disabled={building.adminApproval !== 'Approved'} className={`flex-1 py-2 px-4 rounded-lg text-sm font-medium transition-colors ${building.adminApproval !== 'Approved' ? 'bg-gray-100 text-gray-400 cursor-not-allowed' : 'bg-blue-100 text-blue-700 hover:bg-blue-200'}`}>
                      {building.adminApproval !== 'Approved' ? 'Awaiting Approval' : 'Manage Units'}
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="flex items-center justify-between mt-8">
            <div className="flex items-center space-x-2">
              <button
                onClick={() => setPage(Math.max(1, page - 1))}
                disabled={page === 1}
                className="px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                Prev
              </button>
              <span className="text-gray-600">
                Page {page} of {totalPages}
              </span>
              <button
                onClick={() => setPage(Math.min(totalPages, page + 1))}
                disabled={page === totalPages}
                className="px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                Next
              </button>
            </div>
            
          </div>
        )}
      </div>

      {/* Add Building Modal */}
      {showAddModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl p-6 w-full max-w-4xl max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-2xl font-bold text-gray-900">Add New Property</h2>
              <button
                onClick={() => setShowAddModal(false)}
                className="text-gray-400 hover:text-gray-600"
              >
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            <form className="space-y-6" onSubmit={handleSubmit}>
              {/* Step 1: Basic Information */}
              <div className="bg-white p-6 rounded-xl border border-gray-200 shadow-sm">
                <div className="flex items-center mb-6">
                  <div className="flex items-center justify-center w-8 h-8 bg-blue-100 text-blue-600 rounded-full text-sm font-semibold mr-3">1</div>
                  <h3 className="text-xl font-semibold text-gray-900">Basic Information</h3>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-3">Property Name *</label>
                    <input
                      type="text"
                      placeholder="Enter property name"
                      value={newProperty.buildingName}
                      onChange={(e) => handleInputChange('buildingName', e.target.value)}
                      className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-colors"
                      required
                    />
                  </div>
                </div>


                <div className="space-y-6 mt-6">
                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-3">Property Subdomain *</label>
                  <div className="flex items-center">
                    <input
                      type="text"
                      placeholder="subdomain"
                      value={newProperty.subdomain}
                      onChange={(e) => handleInputChange('subdomain', e.target.value)}
                        className="flex-1 px-4 py-3 border border-gray-300 rounded-l-xl focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-colors"
                      required
                    />
                      <span className="px-4 py-3 bg-gray-100 border border-l-0 border-gray-300 rounded-r-xl text-gray-600 font-medium">.jacs.com</span>
                  </div>
                    <p className="text-xs text-gray-500 mt-1">This will be your property's website URL</p>
                </div>

                  <div className="space-y-4">
                    <label className="block text-sm font-semibold text-gray-700 mb-3">Complete Address *</label>
                    
                    {/* Address Search */}
                    <div>
                      <label className="block text-xs font-medium text-gray-600 mb-2">Search Address on Map</label>
                      <div className="flex gap-2">
                        <input
                          type="text"
                          placeholder="e.g., Cebu City, IT Park, or specific address"
                          value={addressSearch}
                          onChange={(e) => setAddressSearch(e.target.value)}
                          onKeyPress={(e) => {
                            if (e.key === 'Enter') {
                              e.preventDefault();
                              handleAddressSearch();
                            }
                          }}
                          className="flex-1 px-4 py-3 border border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-colors"
                        />
                        <button
                          type="button"
                          onClick={handleAddressSearch}
                          disabled={isGeocoding || !addressSearch.trim()}
                          className="px-6 py-3 bg-blue-600 text-white rounded-xl hover:bg-blue-700 transition-colors font-medium disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                          {isGeocoding ? 'Searching...' : 'Search'}
                        </button>
                      </div>
                      <p className="text-xs text-gray-500 mt-1">Search for an address or click on the map to set location</p>
                    </div>

                    {/* OSM Map */}
                    <div className="w-full h-64 rounded-xl overflow-hidden border border-gray-300 shadow-sm relative">
                      <MapContainer
                        center={mapLocation}
                        zoom={13}
                        style={{ height: '100%', width: '100%', zIndex: 0 }}
                        scrollWheelZoom={true}
                        key={showAddModal ? 'map-open' : 'map-closed'} // Force re-render when modal opens
                      >
                        <TileLayer
                          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
                          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                        />
                        <MapClickHandler onMapClick={handleMapClick} />
                        <MapResizeHandler />
                        {selectedLocation && (
                          <Marker position={[selectedLocation.lat, selectedLocation.lng]} />
                        )}
                      </MapContainer>
                      <div className="absolute top-2 left-2 bg-white bg-opacity-90 px-3 py-1 rounded-lg text-xs text-gray-700 shadow-md z-10">
                        Click on map to set location
                      </div>
                    </div>
                    {isGeocoding && (
                      <div className="text-sm text-blue-600 flex items-center">
                        <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-blue-600 mr-2"></div>
                        Getting address details...
                      </div>
                    )}
                    
                    <div>
                      <label className="block text-xs font-medium text-gray-600 mb-2">Street Address *</label>
                      <input
                        type="text"
                        placeholder="e.g., 123 Main Street, Building Name"
                        value={newProperty.address.street || ''}
                        onChange={(e) => setNewProperty(prev => ({
                          ...prev,
                          address: { ...prev.address, street: e.target.value }
                        }))}
                        className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-colors"
                    required
                      />
                  </div>
                    
                    <div>
                      <label className="block text-xs font-medium text-gray-600 mb-2">Barangay</label>
                      <input
                        type="text"
                        placeholder="e.g., Barangay Name"
                        value={newProperty.address.barangay || ''}
                        onChange={(e) => setNewProperty(prev => ({
                          ...prev,
                          address: { ...prev.address, barangay: e.target.value }
                        }))}
                        className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-colors"
                      />
                    </div>
                    
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label className="block text-xs font-medium text-gray-600 mb-2">City *</label>
                        <input
                          type="text"
                          placeholder="e.g., Cebu City"
                          value={newProperty.address.city || ''}
                          onChange={(e) => setNewProperty(prev => ({
                            ...prev,
                            address: { ...prev.address, city: e.target.value }
                          }))}
                          className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-colors"
                          required
                        />
                      </div>
                      
                      <div>
                        <label className="block text-xs font-medium text-gray-600 mb-2">Province *</label>
                        <input
                          type="text"
                          placeholder="e.g., Cebu"
                          value={newProperty.address.province || ''}
                          onChange={(e) => setNewProperty(prev => ({
                            ...prev,
                            address: { ...prev.address, province: e.target.value }
                          }))}
                          className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-colors"
                          required
                        />
                      </div>
                    </div>
                    
                    <div>
                      <label className="block text-xs font-medium text-gray-600 mb-2">Postal Code</label>
                      <input
                        type="text"
                        placeholder="e.g., 6000"
                        value={newProperty.address.postalCode || ''}
                        onChange={(e) => setNewProperty(prev => ({
                          ...prev,
                          address: { ...prev.address, postalCode: e.target.value }
                        }))}
                        className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-colors"
                      />
                    </div>
                  </div>
                </div>
              </div>

              {/* Step 2: Property Details */}
              <div className="bg-white p-6 rounded-xl border border-gray-200 shadow-sm">
                <div className="flex items-center mb-6">
                  <div className="flex items-center justify-center w-8 h-8 bg-green-100 text-green-600 rounded-full text-sm font-semibold mr-3">2</div>
                  <h3 className="text-xl font-semibold text-gray-900">Property Details</h3>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div className="md:col-span-1">
                    <label className="block text-sm font-semibold text-gray-700 mb-2">Total Units *</label>
                    <input
                      type="number"
                      placeholder="0"
                      min="1"
                      value={newProperty.totalUnits}
                      onChange={(e) => handleInputChange('totalUnits', e.target.value)}
                      className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-black focus:border-transparent"
                      required
                    />
                  </div>
                  <div className="md:col-span-2">
                    <label className="block text-sm font-semibold text-gray-700 mb-2">Notes (optional)</label>
                    <input
                      type="text"
                      placeholder="Brief description or notes"
                      value={newProperty.additionalNotes}
                      onChange={(e) => handleInputChange('additionalNotes', e.target.value)}
                      className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-black focus:border-transparent"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-4">
                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-2">Average Monthly Rent (₱)</label>
                    <input
                      type="number"
                      min="0"
                      placeholder="e.g., 15000"
                      value={newProperty.averageRent}
                      onChange={(e) => handleInputChange('averageRent', e.target.value)}
                      className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-black focus:border-transparent"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-2">Furnishing</label>
                    <select
                      value={newProperty.furnishing}
                      onChange={(e) => handleInputChange('furnishing', e.target.value)}
                      className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-colors"
                    >
                      <option value="">Select furnishing level</option>
                      <option value="UNFURNISHED">Unfurnished</option>
                      <option value="SEMI_FURNISHED">Semi-furnished</option>
                      <option value="FURNISHED">Fully furnished</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-2">Property Type</label>
                    <select
                      value={newProperty.propertyType}
                      onChange={(e) => handleInputChange('propertyType', e.target.value)}
                      className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-colors"
                    >
                      <option value="">Select property type</option>
                      <option value="bed_space">Bed Space</option>
                      <option value="dormitory">Dormitory</option>
                      <option value="boarding_house">Boarding House</option>
                      <option value="studio_apartment">Studio Apartment</option>
                      <option value="room_for_rent">Room for Rent</option>
                    </select>
                  </div>
                </div>
              </div>

              {/* Step 3: Contact Information */}
              <div className="bg-white p-6 rounded-xl border border-gray-200 shadow-sm">
                <div className="flex items-center mb-6">
                  <div className="flex items-center justify-center w-8 h-8 bg-purple-100 text-purple-600 rounded-full text-sm font-semibold mr-3">3</div>
                  <h3 className="text-xl font-semibold text-gray-900">Contact Information</h3>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-2">Contact Person *</label>
                    <input
                      type="text"
                      placeholder="Full name"
                      value={newProperty.contactPerson}
                      onChange={(e) => handleInputChange('contactPerson', e.target.value)}
                      className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-black focus:border-transparent"
                      required
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-2">Email *</label>
                    <input
                      type="email"
                      placeholder="email@example.com"
                      value={newProperty.contactEmail}
                      onChange={(e) => handleInputChange('contactEmail', e.target.value)}
                      className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-black focus-border-transparent"
                      required
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-2">Phone *</label>
                    <input
                      type="tel"
                      placeholder="+63 912 345 6789"
                      value={newProperty.contactPhone}
                      onChange={(e) => handleInputChange('contactPhone', e.target.value)}
                      className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-black focus-border-transparent"
                      required
                    />
                  </div>
                </div>
              </div>

              {/* Step 4: Media & Documents */}
              <div className="bg-white p-6 rounded-xl border border-gray-200 shadow-sm">
                <div className="flex items-center mb-6">
                  <div className="flex items-center justify-center w-8 h-8 bg-orange-100 text-orange-600 rounded-full text-sm font-semibold mr-3">4</div>
                  <h3 className="text-xl font-semibold text-gray-900">Media & Documents</h3>
                </div>
                
                <div className="space-y-8">
                  {/* Property Images */}
              <div>
                    <h4 className="text-lg font-medium text-gray-800 mb-4 flex items-center">
                      <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                      </svg>
                      Property Images
                    </h4>
                    <div className="space-y-4">
                      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                        {newProperty.images && newProperty.images.map((image, index) => (
                          <div key={index} className="relative group">
                            <img src={getImageSrc(image)} alt={`Property ${index + 1}`} className="w-full h-32 object-cover rounded-lg border border-gray-200 shadow-sm" />
                            <button
                              type="button"
                              onClick={() => removePropertyImage(index)}
                              className="absolute -top-2 -right-2 bg-red-500 text-white rounded-full w-6 h-6 flex items-center justify-center text-xs hover:bg-red-600 transition-colors"
                            >
                              <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                              </svg>
                            </button>
                          </div>
                        ))}
                        {(!newProperty.images || newProperty.images.length < 10) && (
                          <label htmlFor="property-images-upload" className="w-full h-32 border-2 border-dashed border-gray-300 rounded-lg flex flex-col items-center justify-center cursor-pointer hover:border-blue-400 hover:bg-blue-50 transition-colors bg-gray-50">
                            <input type="file" id="property-images-upload" multiple accept="image/*" onChange={handlePropertyImageUpload} className="hidden" />
                            <svg className="w-8 h-8 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                            </svg>
                            <p className="mt-2 text-sm text-gray-600 font-medium">Add Images</p>
                            <p className="text-xs text-gray-500">{(newProperty.images?.length || 0)}/10 uploaded</p>
                          </label>
                        )}
                      </div>
                      <p className="text-sm text-gray-600 bg-blue-50 p-3 rounded-lg">
                        📸 Upload photos of the property exterior, common areas, lobby, amenities, and key features. Maximum 10 images allowed.
                      </p>
                    </div>
                  </div>

                  {/* Legal Documents */}
                <div>
                    <h4 className="text-lg font-medium text-gray-800 mb-4 flex items-center">
                      <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                      </svg>
                      Legal Documents
                    </h4>
                    <div className="space-y-4">
                      <div className="flex flex-wrap items-center gap-4">
                    {newProperty.legalDocs.map((doc, index) => (
                          <div key={index} className="relative w-32 h-32 rounded-lg overflow-hidden border border-gray-200 shadow-sm">
                        {doc.fileType && doc.fileType.startsWith('image/') ? (
                          <img src={getImageSrc(doc.path || doc)} alt={doc.filename || `Document ${index + 1}`} className="w-full h-full object-cover" />
                        ) : (
                          <div className="w-full h-full bg-gray-100 flex items-center justify-center">
                            <div className="text-center">
                              {getFileTypeIcon(doc.fileType) === 'pdf' ? (
                                <svg className="w-8 h-8 text-red-500 mx-auto mb-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                                </svg>
                              ) : getFileTypeIcon(doc.fileType) === 'word' ? (
                                <svg className="w-8 h-8 text-blue-500 mx-auto mb-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                                </svg>
                              ) : (
                                <svg className="w-8 h-8 text-gray-400 mx-auto mb-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                                </svg>
                              )}
                              <p className="text-xs text-gray-500 font-medium capitalize">{getFileTypeIcon(doc.fileType)}</p>
                            </div>
                          </div>
                        )}
                        <div className="absolute bottom-0 left-0 right-0 bg-black bg-opacity-50 text-white text-xs p-1 truncate">
                          {doc.filename || `Document ${index + 1}`}
                        </div>
                        <button
                          type="button"
                          onClick={() => removeLegalDoc(index)}
                          className="absolute top-1 right-1 bg-red-500 text-white rounded-full p-1 flex items-center justify-center hover:bg-red-600 transition-colors"
                        >
                          <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                          </svg>
                        </button>
                      </div>
                    ))}
                        <label htmlFor="legal-docs-upload" className="w-32 h-32 border-2 border-dashed border-gray-300 rounded-lg flex flex-col items-center justify-center cursor-pointer hover:border-blue-400 hover:bg-blue-50 transition-colors bg-gray-50">
                      <input type="file" id="legal-docs-upload" multiple accept="image/*,.pdf,.doc,.docx,.txt,.rtf" onChange={handleLegalUpload} className="hidden" />
                      <svg className="w-6 h-6 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                      </svg>
                          <p className="mt-1 text-xs text-gray-600 text-center">Upload<br/>Documents</p>
                    </label>
                  </div>
                      <p className="text-sm text-gray-600 bg-orange-50 p-3 rounded-lg">
                        📄 Upload photos, PDFs, or text files of permits, title deeds, tax declarations, occupancy permits, electrical certificates, and other legal documents. Supported formats: Images (JPG, PNG), PDF, Word docs, and text files.
                      </p>
                    </div>
                  </div>
                </div>
              </div>

              {/* Step 5: Property Amenities */}
              <div className="bg-white p-6 rounded-xl border border-gray-200 shadow-sm">
                <div className="flex items-center mb-6">
                  <div className="flex items-center justify-center w-8 h-8 bg-teal-100 text-teal-600 rounded-full text-sm font-semibold mr-3">5</div>
                  <h3 className="text-xl font-semibold text-gray-900">Property Amenities</h3>
                </div>
                
                <div className="space-y-6">
                  <div>
                    <h4 className="text-lg font-medium text-gray-800 mb-4">Available Amenities</h4>
                    <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                      {[
                        'Swimming Pool', 'Gym/Fitness Center', 'Parking', 'Security Guard', 'Elevator', 'Garden/Green Space',
                        'Children Playground', 'WiFi/Internet', 'Air Conditioning', 'Heating', 'Balcony/Terrace', 'Laundry Room',
                        'Storage Unit', 'Pet Friendly', 'Wheelchair Accessible', '24/7 Security', 'CCTV Surveillance', 'Generator'
                      ].map((amenity) => (
                        <label key={amenity} className="flex items-center space-x-3 cursor-pointer p-3 hover:bg-gray-50 rounded-lg transition-colors">
                          <input
                            type="checkbox"
                            checked={newProperty.amenities.includes(amenity)}
                            onChange={(e) => {
                              if (e.target.checked) {
                                setNewProperty(prev => ({
                                  ...prev,
                                  amenities: [...prev.amenities, amenity]
                                }));
                              } else {
                                setNewProperty(prev => ({
                                  ...prev,
                                  amenities: prev.amenities.filter(a => a !== amenity)
                                }));
                              }
                            }}
                            className="rounded border-gray-300 text-blue-600 focus:ring-blue-500 focus:ring-2"
                          />
                          <span className="text-sm text-gray-700 font-medium">{amenity}</span>
                        </label>
                      ))}
                    </div>
                  </div>
                  
                  {/* Custom Amenity Input */}
                  <div className="border-t pt-6">
                    <h4 className="text-lg font-medium text-gray-800 mb-4">Add Custom Amenity</h4>
                    <div className="flex space-x-3">
                      <input
                        type="text"
                        placeholder="Enter custom amenity name..."
                        value={newProperty.customAmenity || ''}
                        onChange={(e) => setNewProperty(prev => ({ ...prev, customAmenity: e.target.value }))}
                        onKeyPress={(e) => {
                          if (e.key === 'Enter' && newProperty.customAmenity.trim()) {
                            e.preventDefault();
                            if (!newProperty.amenities.includes(newProperty.customAmenity.trim())) {
                              setNewProperty(prev => ({
                                ...prev,
                                amenities: [...prev.amenities, prev.customAmenity.trim()],
                                customAmenity: ''
                              }));
                            }
                          }
                        }}
                        className="flex-1 px-4 py-3 border border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-colors"
                      />
                      <button
                        type="button"
                        onClick={() => {
                          if (newProperty.customAmenity.trim() && !newProperty.amenities.includes(newProperty.customAmenity.trim())) {
                            setNewProperty(prev => ({
                              ...prev,
                              amenities: [...prev.amenities, prev.customAmenity.trim()],
                              customAmenity: ''
                            }));
                          }
                        }}
                        className="px-6 py-3 bg-blue-600 text-white rounded-xl hover:bg-blue-700 transition-colors font-medium"
                      >
                        Add Amenity
                      </button>
                    </div>
                  </div>

                  {/* Selected Amenities Display */}
                  {newProperty.amenities.length > 0 && (
                    <div className="border-t pt-6">
                      <h4 className="text-lg font-medium text-gray-800 mb-4">
                        Selected Amenities 
                        <span className="ml-2 px-2 py-1 bg-blue-100 text-blue-800 rounded-full text-sm font-medium">
                          {newProperty.amenities.length}
                        </span>
                      </h4>
                      <div className="flex flex-wrap gap-2">
                        {newProperty.amenities.map((amenity, index) => (
                          <span
                            key={index}
                            className="inline-flex items-center px-4 py-2 rounded-full text-sm bg-blue-100 text-blue-800 font-medium"
                          >
                            {amenity}
                            <button
                              type="button"
                              onClick={() => {
                                setNewProperty(prev => ({
                                  ...prev,
                                  amenities: prev.amenities.filter((_, i) => i !== index)
                                }));
                              }}
                              className="ml-2 text-blue-600 hover:text-red-500 transition-colors"
                            >
                              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                              </svg>
                            </button>
                          </span>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              </div>

              {/* Form Submit Buttons */}
              <div className="bg-white p-6 rounded-xl border border-gray-200 shadow-sm">
                <div className="flex space-x-4">
                <button
                  type="button"
                  onClick={() => setShowAddModal(false)}
                    className="flex-1 px-8 py-4 border border-gray-300 text-gray-700 rounded-xl hover:bg-gray-50 transition-colors font-medium"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                    className="flex-1 px-8 py-4 bg-blue-600 text-white rounded-xl hover:bg-blue-700 transition-colors font-medium"
                >
                    Create Property
                </button>
              </div>
              </div>

              {/* Remove duplicate amenity section - it was left over */}
              <div style={{ display: 'none' }}>
                <h3 className="text-lg font-semibold text-gray-900 mb-4">Legacy Property Amenities</h3>
                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">Available Amenities</label>
                    <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                      {[
                        'Swimming Pool', 'Gym/Fitness Center', 'Parking', 'Security', 'Elevator', 'Garden',
                        'Playground', 'WiFi', 'Air Conditioning', 'Heating', 'Balcony', 'Terrace',
                        'Laundry Room', 'Storage', 'Pet Friendly', 'Wheelchair Accessible'
                      ].map((amenity) => (
                        <label key={amenity} className="flex items-center space-x-2 cursor-pointer">
                          <input
                            type="checkbox"
                            checked={newProperty.amenities.includes(amenity)}
                            onChange={(e) => {
                              if (e.target.checked) {
                                setNewProperty(prev => ({
                                  ...prev,
                                  amenities: [...prev.amenities, amenity]
                                }));
                              } else {
                                setNewProperty(prev => ({
                                  ...prev,
                                  amenities: prev.amenities.filter(a => a !== amenity)
                                }));
                              }
                            }}
                            className="rounded border-gray-300 text-black focus:ring-black focus:ring-2"
                          />
                          <span className="text-sm text-gray-700">{amenity}</span>
                        </label>
                      ))}
                    </div>
                  </div>
                  
                  {/* Custom Amenity Input */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">Add Custom Amenity</label>
                    <div className="flex space-x-2">
                      <input
                        type="text"
                        placeholder="Enter custom amenity..."
                        value={newProperty.customAmenity || ''}
                        onChange={(e) => setNewProperty(prev => ({ ...prev, customAmenity: e.target.value }))}
                        onKeyPress={(e) => {
                          if (e.key === 'Enter' && newProperty.customAmenity.trim()) {
                            e.preventDefault();
                            if (!newProperty.amenities.includes(newProperty.customAmenity.trim())) {
                              setNewProperty(prev => ({
                                ...prev,
                                amenities: [...prev.amenities, prev.customAmenity.trim()],
                                customAmenity: ''
                              }));
                            }
                          }
                        }}
                        className="flex-1 px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-black focus:border-transparent"
                      />
                      <button
                        type="button"
                        onClick={() => {
                          if (newProperty.customAmenity.trim() && !newProperty.amenities.includes(newProperty.customAmenity.trim())) {
                            setNewProperty(prev => ({
                              ...prev,
                              amenities: [...prev.amenities, prev.customAmenity],
                              customAmenity: ''
                            }));
                          }
                        }}
                        className="px-4 py-2 bg-black text-white rounded-lg hover:bg-gray-800 transition-colors"
                      >
                        Add
                      </button>
                    </div>
                  </div>

                  {/* Selected Amenities Display */}
                  {newProperty.amenities.length > 0 && (
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">Selected Amenities ({newProperty.amenities.length})</label>
                      <div className="flex flex-wrap gap-2">
                        {newProperty.amenities.map((amenity, index) => (
                          <span
                            key={index}
                            className="inline-flex items-center px-3 py-1 rounded-full text-sm bg-gray-100 text-gray-800"
                          >
                            {amenity}
                            <button
                              type="button"
                              onClick={() => {
                                setNewProperty(prev => ({
                                  ...prev,
                                  amenities: prev.amenities.filter((_, i) => i !== index)
                                }));
                              }}
                              className="ml-2 text-gray-500 hover:text-red-500"
                            >
                              <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                              </svg>
                            </button>
                          </span>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              </div>


            </form>
          </div>
        </div>
      )}

      {/* Edit Property Modal */}
      {showEditModal && editingBuilding && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl p-6 w-full max-w-4xl max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-2xl font-bold text-gray-900">Edit Property</h2>
              <button onClick={() => { setShowEditModal(false); setEditingBuilding(null); }} className="text-gray-400 hover:text-gray-600">
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            <form className="space-y-6" onSubmit={(e) => { e.preventDefault(); handleSaveEdit(); }}>
              {/* Step 1: Basic Information */}
              <div className="bg-white p-6 rounded-xl border border-gray-200 shadow-sm">
                <div className="flex items-center mb-6">
                  <div className="flex items-center justify-center w-8 h-8 bg-blue-100 text-blue-600 rounded-full text-sm font-semibold mr-3">1</div>
                  <h3 className="text-xl font-semibold text-gray-900">Basic Information</h3>
                </div>
                
                <div className="space-y-6">
                  {/* Property Name */}
                  <div className="grid grid-cols-1 gap-6">
                <div>
                      <label className="block text-sm font-semibold text-gray-700 mb-3">Property Name *</label>
                      <input
                        type="text"
                        placeholder="Enter property name"
                        value={editingBuilding.buildingName || ''}
                        onChange={(e) => setEditingBuilding({ ...editingBuilding, buildingName: e.target.value })}
                        className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-colors"
                        required
                      />
                </div>
              </div>

                  {/* Subdomain & Address */}
                  <div className="space-y-4">
              <div>
                      <label className="block text-sm font-semibold text-gray-700 mb-3">Property Subdomain *</label>
                <div className="flex items-center">
                        <input
                          type="text"
                          placeholder="subdomain"
                          value={editingBuilding.subdomain || ''}
                          onChange={(e) => setEditingBuilding({ ...editingBuilding, subdomain: e.target.value })}
                          className="flex-1 px-4 py-3 border border-gray-300 rounded-l-xl focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-colors"
                          required
                        />
                        <span className="px-4 py-3 bg-gray-100 border border-l-0 border-gray-300 rounded-r-xl text-gray-600 font-medium">.jacs.com</span>
                </div>
                      <p className="text-xs text-gray-500 mt-1">This will be your property's website URL</p>
              </div>

              <div className="space-y-4">
                      <label className="block text-sm font-semibold text-gray-700 mb-3">Complete Address *</label>
                      
                      {/* Address Search */}
                      <div>
                        <label className="block text-xs font-medium text-gray-600 mb-2">Search Address on Map</label>
                        <div className="flex gap-2">
                          <input
                            type="text"
                            placeholder="e.g., Cebu City, IT Park, or specific address"
                            value={editAddressSearch}
                            onChange={(e) => setEditAddressSearch(e.target.value)}
                            onKeyPress={(e) => {
                              if (e.key === 'Enter') {
                                e.preventDefault();
                                handleEditAddressSearch();
                              }
                            }}
                            className="flex-1 px-4 py-3 border border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-colors"
                          />
                          <button
                            type="button"
                            onClick={handleEditAddressSearch}
                            disabled={editIsGeocoding || !editAddressSearch.trim()}
                            className="px-6 py-3 bg-blue-600 text-white rounded-xl hover:bg-blue-700 transition-colors font-medium disabled:opacity-50 disabled:cursor-not-allowed"
                          >
                            {editIsGeocoding ? 'Searching...' : 'Search'}
                          </button>
                        </div>
                        <p className="text-xs text-gray-500 mt-1">Search for an address or click on the map to set location</p>
                      </div>

                      {/* OSM Map */}
                      <div className="w-full h-64 rounded-xl overflow-hidden border border-gray-300 shadow-sm relative">
                        <MapContainer
                          center={editMapLocation}
                          zoom={13}
                          style={{ height: '100%', width: '100%', zIndex: 0 }}
                          scrollWheelZoom={true}
                          key={showEditModal ? 'edit-map-open' : 'edit-map-closed'}
                        >
                          <TileLayer
                            attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
                            url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                          />
                          <MapClickHandler onMapClick={handleEditMapClick} />
                          <MapResizeHandler />
                          {editSelectedLocation && (
                            <Marker position={[editSelectedLocation.lat, editSelectedLocation.lng]} />
                          )}
                        </MapContainer>
                        <div className="absolute top-2 left-2 bg-white bg-opacity-90 px-3 py-1 rounded-lg text-xs text-gray-700 shadow-md z-10">
                          Click on map to set location
                        </div>
                      </div>
                      {editIsGeocoding && (
                        <div className="text-sm text-blue-600 flex items-center">
                          <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-blue-600 mr-2"></div>
                          Getting address details...
                        </div>
                      )}
                      
                      <div>
                        <label className="block text-xs font-medium text-gray-600 mb-2">Street Address *</label>
                        <input
                          type="text"
                          placeholder="e.g., 123 Main Street, Building Name"
                          value={editingBuilding.addressObj?.street || ''}
                          onChange={(e) => setEditingBuilding({
                            ...editingBuilding,
                            addressObj: { ...(editingBuilding.addressObj || parseAddress(editingBuilding.address)), street: e.target.value }
                          })}
                          className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-colors"
                        required
                        />
                    </div>
                      
                      <div>
                        <label className="block text-xs font-medium text-gray-600 mb-2">Barangay</label>
                        <input
                          type="text"
                          placeholder="e.g., Barangay Name"
                          value={editingBuilding.addressObj?.barangay || ''}
                          onChange={(e) => setEditingBuilding({
                            ...editingBuilding,
                            addressObj: { ...(editingBuilding.addressObj || parseAddress(editingBuilding.address)), barangay: e.target.value }
                          })}
                          className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-colors"
                        />
                  </div>
                      
                      <div className="grid grid-cols-2 gap-4">
                        <div>
                          <label className="block text-xs font-medium text-gray-600 mb-2">City *</label>
                          <input
                            type="text"
                            placeholder="e.g., Cebu City"
                            value={editingBuilding.addressObj?.city || editingBuilding.city || ''}
                            onChange={(e) => setEditingBuilding({
                              ...editingBuilding,
                              addressObj: { ...(editingBuilding.addressObj || parseAddress(editingBuilding.address)), city: e.target.value },
                              city: e.target.value
                            })}
                            className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-colors"
                            required
                          />
                        </div>
                        
                        <div>
                          <label className="block text-xs font-medium text-gray-600 mb-2">Province *</label>
                          <input
                            type="text"
                            placeholder="e.g., Cebu"
                            value={editingBuilding.addressObj?.province || editingBuilding.province || ''}
                            onChange={(e) => setEditingBuilding({
                              ...editingBuilding,
                              addressObj: { ...(editingBuilding.addressObj || parseAddress(editingBuilding.address)), province: e.target.value },
                              province: e.target.value
                            })}
                            className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-colors"
                            required
                          />
                        </div>
                      </div>
                      
                      <div>
                        <label className="block text-xs font-medium text-gray-600 mb-2">Postal Code</label>
                        <input
                          type="text"
                          placeholder="e.g., 6000"
                          value={editingBuilding.addressObj?.postalCode || ''}
                          onChange={(e) => setEditingBuilding({
                            ...editingBuilding,
                            addressObj: { ...(editingBuilding.addressObj || parseAddress(editingBuilding.address)), postalCode: e.target.value }
                          })}
                          className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-colors"
                        />
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              {/* Step 2: Property Details */}
              <div className="bg-white p-6 rounded-xl border border-gray-200 shadow-sm">
                <div className="flex items-center mb-6">
                  <div className="flex items-center justify-center w-8 h-8 bg-green-100 text-green-600 rounded-full text-sm font-semibold mr-3">2</div>
                  <h3 className="text-xl font-semibold text-gray-900">Property Details</h3>
                </div>
                
                <div className="space-y-6">
                  {/* Property Type & Furnishing */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                      <label className="block text-sm font-semibold text-gray-700 mb-3">Property Type *</label>
                      <select
                        value={editingBuilding.propertyType || ''}
                        onChange={(e) => setEditingBuilding({ ...editingBuilding, propertyType: e.target.value })}
                        className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-colors"
                        required
                      >
                        <option value="">Select property type</option>
                        <option value="bed_space">Bed Space</option>
                        <option value="dormitory">Dormitory</option>
                        <option value="boarding_house">Boarding House</option>
                        <option value="studio_apartment">Studio Apartment</option>
                        <option value="room_for_rent">Room for Rent</option>
                      </select>
                </div>
                <div>
                      <label className="block text-sm font-semibold text-gray-700 mb-3">Furnishing Level</label>
                      <select
                        value={editingBuilding.furnishing || ''}
                        onChange={(e) => setEditingBuilding({ ...editingBuilding, furnishing: e.target.value })}
                        className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-colors"
                      >
                        <option value="">Select furnishing level</option>
                        <option value="UNFURNISHED">Unfurnished</option>
                        <option value="SEMI_FURNISHED">Semi-furnished</option>
                        <option value="FURNISHED">Fully furnished</option>
                      </select>
                </div>
              </div>

                  {/* Total Units & Rent */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                      <label className="block text-sm font-semibold text-gray-700 mb-3">Total Units *</label>
                      <input
                        type="number"
                        placeholder="Number of units"
                        min="1"
                        value={editingBuilding.totalUnits || ''}
                        onChange={(e) => setEditingBuilding({ ...editingBuilding, totalUnits: parseInt(e.target.value || '0') })}
                        className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-colors"
                        required
                      />
                </div>
                <div>
                      <label className="block text-sm font-semibold text-gray-700 mb-3">Average Monthly Rent (₱)</label>
                      <input
                        type="number"
                        min="0"
                        placeholder="e.g., 15,000"
                        value={editingBuilding.averageRent || ''}
                        onChange={(e) => setEditingBuilding({ ...editingBuilding, averageRent: parseInt(e.target.value || '0') })}
                        className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-colors"
                      />
                    </div>
                  </div>

                  {/* Property Status */}
                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-3">Property Status</label>
                    <select 
                      value={editingBuilding.status || 'pending_approval'} 
                      onChange={(e) => {
                        const newStatus = e.target.value;
                        setEditingBuilding({ 
                          ...editingBuilding, 
                          status: newStatus,
                          // Auto-set admin approval based on status
                          adminApproval: newStatus === 'active' ? 'Approved' : 
                                        newStatus === 'inactive' ? 'Approved' : 
                                        newStatus === 'rejected' ? 'Rejected' : 'Pending'
                        });
                      }} 
                      className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-colors"
                    >
                      <option value="pending_approval">Pending Review</option>
                      <option value="active">Active (Live)</option>
                      <option value="inactive">Inactive (Paused)</option>
                      <option value="rejected">Rejected</option>
                  </select>
                    <p className="text-xs text-gray-500 mt-1">
                      {editingBuilding.status === 'pending_approval' && 'Property is under review'}
                      {editingBuilding.status === 'active' && 'Property is live and accepting tenants'}
                      {editingBuilding.status === 'inactive' && 'Property is temporarily paused'}
                      {editingBuilding.status === 'rejected' && 'Property was rejected and needs revision'}
                    </p>
                </div>

                  {/* Additional Notes */}
                <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-3">Additional Notes</label>
                    <textarea
                      placeholder="Brief description of the property, special features, or any additional information"
                      rows="3"
                      value={editingBuilding.additionalNotes || ''}
                      onChange={(e) => setEditingBuilding({ ...editingBuilding, additionalNotes: e.target.value })}
                      className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-colors resize-none"
                    ></textarea>
                  </div>
                </div>
              </div>

              {/* Step 3: Contact Information */}
              <div className="bg-white p-6 rounded-xl border border-gray-200 shadow-sm">
                <div className="flex items-center mb-6">
                  <div className="flex items-center justify-center w-8 h-8 bg-purple-100 text-purple-600 rounded-full text-sm font-semibold mr-3">3</div>
                  <h3 className="text-xl font-semibold text-gray-900">Contact Information</h3>
                </div>
                
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-3">Contact Person *</label>
                    <input
                      type="text"
                      placeholder="Full name"
                      value={editingBuilding.contactPerson || ''}
                      onChange={(e) => setEditingBuilding({ ...editingBuilding, contactPerson: e.target.value })}
                      className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-colors"
                      required
                    />
                </div>
                <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-3">Email Address *</label>
                    <input
                      type="email"
                      placeholder="email@example.com"
                      value={editingBuilding.contactEmail || ''}
                      onChange={(e) => setEditingBuilding({ ...editingBuilding, contactEmail: e.target.value })}
                      className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-colors"
                      required
                    />
                </div>
                <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-3">Phone Number *</label>
                    <input
                      type="tel"
                      placeholder="+63 912 345 6789"
                      value={editingBuilding.contactPhone || ''}
                      onChange={(e) => setEditingBuilding({ ...editingBuilding, contactPhone: e.target.value })}
                      className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-colors"
                      required
                    />
                  </div>
                </div>
              </div>

              {/* Step 4: Media & Documents */}
              <div className="bg-white p-6 rounded-xl border border-gray-200 shadow-sm">
                <div className="flex items-center mb-6">
                  <div className="flex items-center justify-center w-8 h-8 bg-orange-100 text-orange-600 rounded-full text-sm font-semibold mr-3">4</div>
                  <h3 className="text-xl font-semibold text-gray-900">Media & Documents</h3>
                </div>
                
                <div className="space-y-8">
                  {/* Property Images */}
              <div>
                    <h4 className="text-lg font-medium text-gray-800 mb-4 flex items-center">
                      <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                      </svg>
                      Property Images
                    </h4>
                    <div className="space-y-4">
                      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                        {editingBuilding.images && editingBuilding.images.map((image, index) => (
                          <div key={index} className="relative group">
                            <img src={getImageSrc(image)} alt={`Property ${index + 1}`} className="w-full h-32 object-cover rounded-lg border border-gray-200 shadow-sm" />
                            <button
                              type="button"
                              onClick={() => removeEditPropertyImage(index)}
                              className="absolute -top-2 -right-2 bg-red-500 text-white rounded-full w-6 h-6 flex items-center justify-center text-xs hover:bg-red-600 transition-colors"
                            >
                              <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                              </svg>
                            </button>
                          </div>
                        ))}
                        {(!editingBuilding.images || editingBuilding.images.length < 10) && (
                          <label htmlFor="edit-property-images-upload" className="w-full h-32 border-2 border-dashed border-gray-300 rounded-lg flex flex-col items-center justify-center cursor-pointer hover:border-blue-400 hover:bg-blue-50 transition-colors bg-gray-50">
                            <input type="file" id="edit-property-images-upload" multiple accept="image/*" onChange={handleEditPropertyImageUpload} className="hidden" />
                            <svg className="w-8 h-8 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                            </svg>
                            <p className="mt-2 text-sm text-gray-600 font-medium">Add Images</p>
                            <p className="text-xs text-gray-500">{(editingBuilding.images?.length || 0)}/10 uploaded</p>
                          </label>
                        )}
                      </div>
                      <p className="text-sm text-gray-600 bg-blue-50 p-3 rounded-lg">
                        📸 Upload photos of the property exterior, common areas, lobby, amenities, and key features. Maximum 10 images allowed.
                      </p>
                    </div>
              </div>

                  {/* Legal Documents */}
                  <div>
                    <h4 className="text-lg font-medium text-gray-800 mb-4 flex items-center">
                      <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                      </svg>
                      Legal Documents
                    </h4>
                    <div className="space-y-4">
                      <div className="flex flex-wrap items-center gap-4">
                        {editingBuilding.legalDocs && editingBuilding.legalDocs.map((doc, index) => (
                          <div key={index} className="relative w-32 h-32 rounded-lg overflow-hidden border border-gray-200 shadow-sm">
                            {doc.fileType && doc.fileType.startsWith('image/') ? (
                              <img src={getImageSrc(doc.path || doc)} alt={doc.filename || `Document ${index + 1}`} className="w-full h-full object-cover" />
                            ) : (
                              <div className="w-full h-full bg-gray-100 flex items-center justify-center">
                                <div className="text-center">
                                  {getFileTypeIcon(doc.fileType) === 'pdf' ? (
                                    <svg className="w-8 h-8 text-red-500 mx-auto mb-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                                    </svg>
                                  ) : getFileTypeIcon(doc.fileType) === 'word' ? (
                                    <svg className="w-8 h-8 text-blue-500 mx-auto mb-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                                    </svg>
                                  ) : (
                                    <svg className="w-8 h-8 text-gray-400 mx-auto mb-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                                    </svg>
                                  )}
                                  <p className="text-xs text-gray-500 font-medium capitalize">{getFileTypeIcon(doc.fileType)}</p>
                                </div>
                              </div>
                            )}
                            <div className="absolute bottom-0 left-0 right-0 bg-black bg-opacity-50 text-white text-xs p-1 truncate">
                              {doc.filename || `Document ${index + 1}`}
                            </div>
                            <button
                              type="button"
                              onClick={() => removeEditLegalDoc(index)}
                              className="absolute top-1 right-1 bg-red-500 text-white rounded-full p-1 flex items-center justify-center hover:bg-red-600 transition-colors"
                            >
                              <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                              </svg>
                            </button>
              </div>
                        ))}
                        <label htmlFor="edit-legal-docs-upload" className="w-32 h-32 border-2 border-dashed border-gray-300 rounded-lg flex flex-col items-center justify-center cursor-pointer hover:border-blue-400 hover:bg-blue-50 transition-colors bg-gray-50">
                          <input type="file" id="edit-legal-docs-upload" multiple accept="image/*,.pdf,.doc,.docx,.txt,.rtf" onChange={handleEditLegalUpload} className="hidden" />
                          <svg className="w-6 h-6 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                          </svg>
                          <p className="mt-1 text-xs text-gray-600 text-center">Upload<br/>Documents</p>
                        </label>
            </div>
                      <p className="text-sm text-gray-600 bg-orange-50 p-3 rounded-lg">
                        📄 Upload photos, PDFs, or text files of permits, title deeds, tax declarations, occupancy permits, electrical certificates, and other legal documents. Supported formats: Images (JPG, PNG), PDF, Word docs, and text files.
                      </p>
                    </div>
                  </div>
                </div>
              </div>

              {/* Step 5: Property Amenities */}
              <div className="bg-white p-6 rounded-xl border border-gray-200 shadow-sm">
                <div className="flex items-center mb-6">
                  <div className="flex items-center justify-center w-8 h-8 bg-teal-100 text-teal-600 rounded-full text-sm font-semibold mr-3">5</div>
                  <h3 className="text-xl font-semibold text-gray-900">Property Amenities</h3>
                </div>
                
                <div className="space-y-6">
                  <div>
                    <h4 className="text-lg font-medium text-gray-800 mb-4">Available Amenities</h4>
                    <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                      {[
                        'Swimming Pool', 'Gym/Fitness Center', 'Parking', 'Security Guard', 'Elevator', 'Garden/Green Space',
                        'Children Playground', 'WiFi/Internet', 'Air Conditioning', 'Heating', 'Balcony/Terrace', 'Laundry Room',
                        'Storage Unit', 'Pet Friendly', 'Wheelchair Accessible', '24/7 Security', 'CCTV Surveillance', 'Generator'
                      ].map((amenity) => (
                        <label key={amenity} className="flex items-center space-x-3 cursor-pointer p-3 hover:bg-gray-50 rounded-lg transition-colors">
                          <input
                            type="checkbox"
                            checked={editingBuilding.amenities?.includes(amenity) || false}
                            onChange={(e) => {
                              if (e.target.checked) {
                                setEditingBuilding(prev => ({
                                  ...prev,
                                  amenities: [...(prev.amenities || []), amenity]
                                }));
                              } else {
                                setEditingBuilding(prev => ({
                                  ...prev,
                                  amenities: (prev.amenities || []).filter(a => a !== amenity)
                                }));
                              }
                            }}
                            className="rounded border-gray-300 text-blue-600 focus:ring-blue-500 focus:ring-2"
                          />
                          <span className="text-sm text-gray-700 font-medium">{amenity}</span>
                        </label>
                      ))}
                    </div>
                  </div>
                  
                  {/* Custom Amenity Input */}
                  <div className="border-t pt-6">
                    <h4 className="text-lg font-medium text-gray-800 mb-4">Add Custom Amenity</h4>
                    <div className="flex space-x-3">
                      <input
                        type="text"
                        placeholder="Enter custom amenity name..."
                        value={editingBuilding.customAmenity || ''}
                        onChange={(e) => setEditingBuilding(prev => ({ ...prev, customAmenity: e.target.value }))}
                        onKeyPress={(e) => {
                          if (e.key === 'Enter' && editingBuilding.customAmenity?.trim()) {
                            e.preventDefault();
                            if (!editingBuilding.amenities?.includes(editingBuilding.customAmenity.trim())) {
                              setEditingBuilding(prev => ({
                                ...prev,
                                amenities: [...(prev.amenities || []), prev.customAmenity.trim()],
                                customAmenity: ''
                              }));
                            }
                          }
                        }}
                        className="flex-1 px-4 py-3 border border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-colors"
                      />
                      <button
                        type="button"
                        onClick={() => {
                          if (editingBuilding.customAmenity?.trim() && !editingBuilding.amenities?.includes(editingBuilding.customAmenity.trim())) {
                            setEditingBuilding(prev => ({
                              ...prev,
                              amenities: [...(prev.amenities || []), prev.customAmenity.trim()],
                              customAmenity: ''
                            }));
                          }
                        }}
                        className="px-6 py-3 bg-blue-600 text-white rounded-xl hover:bg-blue-700 transition-colors font-medium"
                      >
                        Add Amenity
                      </button>
                    </div>
                  </div>

                  {/* Selected Amenities Display */}
                  {editingBuilding.amenities && editingBuilding.amenities.length > 0 && (
                    <div className="border-t pt-6">
                      <h4 className="text-lg font-medium text-gray-800 mb-4">
                        Selected Amenities 
                        <span className="ml-2 px-2 py-1 bg-blue-100 text-blue-800 rounded-full text-sm font-medium">
                          {editingBuilding.amenities.length}
                        </span>
                      </h4>
                      <div className="flex flex-wrap gap-2">
                        {editingBuilding.amenities.map((amenity, index) => (
                          <span
                            key={index}
                            className="inline-flex items-center px-4 py-2 rounded-full text-sm bg-blue-100 text-blue-800 font-medium"
                          >
                            {amenity}
                            <button
                              type="button"
                              onClick={() => {
                                setEditingBuilding(prev => ({
                                  ...prev,
                                  amenities: (prev.amenities || []).filter((_, i) => i !== index)
                                }));
                              }}
                              className="ml-2 text-blue-600 hover:text-red-500 transition-colors"
                            >
                              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                              </svg>
                            </button>
                          </span>
                        ))}
          </div>
        </div>
      )}
                </div>
              </div>

              {/* Form Submit Buttons */}
              <div className="bg-white p-6 rounded-xl border border-gray-200 shadow-sm">
                <div className="flex space-x-4">
                  <button
                    type="button"
                    onClick={() => { setShowEditModal(false); setEditingBuilding(null); }}
                    className="flex-1 px-8 py-4 border border-gray-300 text-gray-700 rounded-xl hover:bg-gray-50 transition-colors font-medium"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="flex-1 px-8 py-4 bg-blue-600 text-white rounded-xl hover:bg-blue-700 transition-colors font-medium"
                  >
                    Save Changes
                  </button>
                </div>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Enhanced View Details Modal */}
      {showDetailsModal && detailsBuilding && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl w-full max-w-6xl max-h-[95vh] overflow-y-auto shadow-2xl">
            {/* Header */}
            <div className="sticky top-0 bg-white border-b border-gray-200 px-8 py-6 rounded-t-2xl">
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="text-3xl font-bold text-gray-900">{detailsBuilding.buildingName}</h2>
                  <p className="text-gray-600 mt-1">Property Details & Information</p>
                </div>
                <button 
                  onClick={() => { setShowDetailsModal(false); setDetailsBuilding(null); }} 
                  className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg transition-colors"
                >
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
              </div>
            </div>

            <div className="p-8">
              {/* Hero Section */}
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 mb-8">
                {/* Image Gallery / Main Image */}
                <div className="space-y-4">
                  <div className="relative w-full h-80 flex items-center justify-center bg-gray-50 rounded-2xl overflow-hidden">
                    {(() => {
                      const imgs = getDetailsImages(detailsBuilding);
                      // Always fallback if no images
                      const mainImg = imgs[0] || defaultProperty;
                      return (
                        <img 
                          src={mainImg} 
                          alt={detailsBuilding.buildingName} 
                          className="w-full h-full object-cover rounded-xl border border-gray-200 shadow-lg" 
                          onError={(e) => { e.target.src = defaultProperty; }}
                        />
                      );
                    })()}
                    <div className="absolute top-4 right-4">
                      <span className={`px-3 py-1 rounded-full text-sm font-medium ${getStatusBadgeClass(detailsBuilding.status)}`}>{formatStatusDisplay(detailsBuilding.status)}</span>
                    </div>
                  </div>
                  {/* Image Gallery Thumbnails */}
                  {(() => {
                    const imgs = getDetailsImages(detailsBuilding);
                    if (imgs.length > 1) {
                      return (
                        <div className="grid grid-cols-4 gap-2">
                          {imgs.slice(0, 4).map((img, idx) => (
                            <div key={idx} className="relative h-20 rounded-lg overflow-hidden border border-gray-200">
                              <img 
                                src={img} 
                                alt={`${detailsBuilding.buildingName} ${idx + 1}`}
                                className="w-full h-full object-cover"
                                onError={(e) => { e.target.src = defaultProperty; }}
                              />
                </div>
                          ))}
                          {imgs.length > 4 && (
                            <div className="relative h-20 rounded-lg overflow-hidden border border-gray-200 bg-gray-100 flex items-center justify-center">
                              <span className="text-xs text-gray-600 font-medium">+{imgs.length - 4} more</span>
                            </div>
                          )}
                        </div>
                      );
                    }
                    return null;
                  })()}
                </div>

                {/* Key Information */}
                <div className="space-y-6">
                  {/* Location */}
                  <div className="bg-gray-50 rounded-xl p-6">
                    <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center">
                      <svg className="w-5 h-5 mr-2 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                      </svg>
                      Location
                    </h3>
                    {detailsBuilding.addressObj?.street && (
                      <p className="text-gray-700 font-medium">{detailsBuilding.addressObj.street}</p>
                    )}
                    {detailsBuilding.addressObj?.barangay && (
                      <p className="text-gray-600 text-sm mt-1">{detailsBuilding.addressObj.barangay}</p>
                    )}
                    {(detailsBuilding.addressObj?.city || detailsBuilding.city || detailsBuilding.addressObj?.province || detailsBuilding.province) && (
                      <p className="text-sm text-gray-500 mt-1">
                        {detailsBuilding.addressObj?.city || detailsBuilding.city || 'Cebu City'}, {detailsBuilding.addressObj?.province || detailsBuilding.province || 'Cebu'}
                      </p>
                    )}
                    {detailsBuilding.addressObj?.postalCode && (
                      <p className="text-xs text-gray-400 mt-1">Postal Code: {detailsBuilding.addressObj.postalCode}</p>
                    )}
                    {/* Only show full address if we don't have any individual components */}
                    {!detailsBuilding.addressObj?.street && !detailsBuilding.addressObj?.barangay && !detailsBuilding.addressObj?.city && !detailsBuilding.city && detailsBuilding.address && (
                      <p className="text-gray-700 font-medium">{detailsBuilding.address}</p>
                    )}
                    {!detailsBuilding.addressObj?.street && !detailsBuilding.addressObj?.barangay && !detailsBuilding.addressObj?.city && !detailsBuilding.city && !detailsBuilding.address && (
                      <p className="text-gray-500 text-sm">Address not specified</p>
                    )}
              </div>

                  {/* Subdomain */}
                  <div className="bg-blue-50 rounded-xl p-6">
                    <h3 className="text-lg font-semibold text-gray-900 mb-2 flex items-center">
                      <svg className="w-5 h-5 mr-2 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                      </svg>
                      Portal Access
                    </h3>
                    {detailsBuilding.status === 'pending_approval' ? (
                      <span className="text-sm font-medium text-gray-500">
                        {getSubdomainDisplay(detailsBuilding.subdomain)} (Pending Approval)
                      </span>
                    ) : (
                      <a 
                        href={getSubdomainUrl(detailsBuilding.subdomain)} 
                        target="_blank" 
                        rel="noopener noreferrer" 
                        className="text-blue-600 hover:text-blue-800 font-medium text-sm"
                      >
                        {getSubdomainDisplay(detailsBuilding.subdomain)} →
                      </a>
                    )}
            </div>

                  {/* Stats Grid */}
                  <div className="grid grid-cols-3 gap-4">
                    <div className="bg-white border border-gray-200 rounded-xl p-4 text-center">
                      <div className="text-2xl font-bold text-gray-900">{detailsBuilding.totalUnits}</div>
                      <div className="text-xs text-gray-500 mt-1">Total Units</div>
                    </div>
                    <div className="bg-white border border-gray-200 rounded-xl p-4 text-center">
                      <div className="text-2xl font-bold text-green-600">{detailsBuilding.occupiedUnits || 0}</div>
                      <div className="text-xs text-gray-500 mt-1">Occupied</div>
                    </div>
                    <div className="bg-white border border-gray-200 rounded-xl p-4 text-center">
                      <div className="text-2xl font-bold text-orange-600">{detailsBuilding.vacantUnits || 0}</div>
                      <div className="text-xs text-gray-500 mt-1">Vacant</div>
                    </div>
                  </div>
                </div>
              </div>

              {/* Detailed Information Grid */}
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                {/* Financial Information */}
                <div className="bg-gradient-to-br from-green-50 to-emerald-50 rounded-2xl p-6">
                  <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center">
                    <svg className="w-5 h-5 mr-2 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1" />
                    </svg>
                    Financial Details
                  </h3>
                  <div className="space-y-3">
                    <div className="flex justify-between items-center">
                      <span className="text-sm text-gray-600">Monthly Revenue</span>
                      <span className="font-semibold text-gray-900">{formatCurrency(detailsBuilding.monthlyRevenue)}</span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-sm text-gray-600">Average Rent</span>
                      <span className="font-semibold text-gray-900">{formatCurrency(detailsBuilding.averageRent)}</span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-sm text-gray-600">Furnishing</span>
                      <span className="font-semibold text-gray-900">{detailsBuilding.furnishing || 'Not specified'}</span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-sm text-gray-600">Property Type</span>
                      <span className="font-semibold text-gray-900 capitalize">{detailsBuilding.propertyType || 'Not specified'}</span>
                    </div>
                  </div>
                </div>

                {/* Contact Information */}
                <div className="bg-gradient-to-br from-blue-50 to-indigo-50 rounded-2xl p-6">
                  <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center">
                    <svg className="w-5 h-5 mr-2 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                    </svg>
                    Contact Information
                  </h3>
                  <div className="space-y-3">
              <div>
                      <span className="text-sm text-gray-600">Contact Person</span>
                      <p className="font-semibold text-gray-900">{detailsBuilding.contactPerson}</p>
              </div>
              <div>
                      <span className="text-sm text-gray-600">Email</span>
                      <p className="font-semibold text-gray-900">{detailsBuilding.contactEmail}</p>
              </div>
                    <div>
                      <span className="text-sm text-gray-600">Phone</span>
                      <p className="font-semibold text-gray-900">{detailsBuilding.contactPhone}</p>
                    </div>
                  </div>
                </div>

                {/* Timeline & Status */}
                <div className="bg-gradient-to-br from-purple-50 to-pink-50 rounded-2xl p-6">
                  <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center">
                    <svg className="w-5 h-5 mr-2 text-purple-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                    Timeline & Status
                  </h3>
                  <div className="space-y-3">
                    <div>
                      <span className="text-sm text-gray-600">Registered</span>
                      <p className="font-semibold text-gray-900">{formatDate(detailsBuilding.registrationDate)}</p>
                    </div>
                    <div>
                      <span className="text-sm text-gray-600">Approved</span>
                      <p className="font-semibold text-gray-900">{formatDate(detailsBuilding.approvalDate) || 'Not approved yet'}</p>
                    </div>
                    <div>
                      <span className="text-sm text-gray-600">Last Updated</span>
                      <p className="font-semibold text-gray-900">{formatDate(detailsBuilding.lastUpdated)}</p>
                    </div>
                  </div>
                </div>
              </div>

              {/* Amenities Section */}
              {detailsBuilding.amenities && detailsBuilding.amenities.length > 0 && (
                <div className="mt-8">
                  <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center">
                    <svg className="w-5 h-5 mr-2 text-indigo-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 3v4M3 5h4M6 17v4m-2-2h4m5-16l2.286 6.857L21 12l-5.714 2.143L13 21l-2.286-6.857L5 12l5.714-2.143L13 3z" />
                    </svg>
                    Amenities ({detailsBuilding.amenities.length})
                  </h3>
                  <div className="flex flex-wrap gap-2">
                    {detailsBuilding.amenities.map((amenity, index) => (
                      <span
                        key={index}
                        className="inline-flex items-center px-3 py-1 rounded-full text-sm bg-indigo-100 text-indigo-800 font-medium"
                      >
                        {amenity}
                      </span>
                    ))}
                  </div>
                </div>
              )}

              {/* Legal Documents Section */}
              {detailsBuilding.legalDocs && detailsBuilding.legalDocs.length > 0 && (
                <div className="mt-8">
                  <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center">
                    <svg className="w-5 h-5 mr-2 text-orange-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                    </svg>
                    Legal Documents ({detailsBuilding.legalDocs.length})
                  </h3>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                    {detailsBuilding.legalDocs.map((doc, index) => (
                      <div key={index} className="relative w-full h-32 rounded-lg overflow-hidden border border-gray-200 shadow-sm">
                        {doc.fileType && doc.fileType.startsWith('image/') ? (
                          <img 
                            src={getImageSrc(doc.path || doc)} 
                            alt={doc.filename || `Document ${index + 1}`} 
                            className="w-full h-full object-cover"
                            onError={(e) => { e.target.src = defaultProperty; }}
                          />
                        ) : (
                          <div className="w-full h-full bg-gray-100 flex items-center justify-center">
                            <div className="text-center">
                              {getFileTypeIcon(doc.fileType) === 'pdf' ? (
                                <svg className="w-8 h-8 text-red-500 mx-auto mb-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                                </svg>
                              ) : (
                                <svg className="w-8 h-8 text-gray-400 mx-auto mb-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                                </svg>
                              )}
                              <p className="text-xs text-gray-500 font-medium capitalize">{getFileTypeIcon(doc.fileType)}</p>
            </div>
                          </div>
                        )}
                        <div className="absolute bottom-0 left-0 right-0 bg-black bg-opacity-50 text-white text-xs p-1 truncate">
                          {doc.filename || `Document ${index + 1}`}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Additional Notes Section */}
              {detailsBuilding.additionalNotes && (
                <div className="mt-8">
                  <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center">
                    <svg className="w-5 h-5 mr-2 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                    </svg>
                    Additional Notes
                  </h3>
                  <div className="bg-gray-50 rounded-xl p-6">
                    <p className="text-gray-700 whitespace-pre-wrap">{detailsBuilding.additionalNotes}</p>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default ManageProperty;
