import React, { useEffect, useMemo, useState, useCallback } from 'react';
import ManagerInquiries from './Inquiries';
import api from '../../services/api';
import API_BASE_URL from '../../config/api';
import defaultProperty from '../../assets/images/default_property.png';
import defaultUnit from '../../assets/images/default_unit.png';

const statusToBadgeClass = {
  Vacant: 'bg-green-100 text-green-800 border-green-200',
  Occupied: 'bg-gray-100 text-gray-700 border-gray-200',
  Draft: 'bg-yellow-100 text-yellow-800 border-yellow-200'
};


const ManagerRentSpace = ({ onPageChange = () => {} }) => {
  // No seed data; fetch approved properties from backend

  const [properties, setProperties] = useState([]);
  const [listings, setListings] = useState([]);
  const [selectedProperty, setSelectedProperty] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('All');
  const [bedroomsFilter, setBedroomsFilter] = useState('All');
  const [priceMin, setPriceMin] = useState('');
  const [priceMax, setPriceMax] = useState('');
  const [sortBy, setSortBy] = useState('Recent');
  const [sortOrder] = useState('desc');
  const [selectedIds, setSelectedIds] = useState(new Set());
  const [page, setPage] = useState(1);
  const [showEditModal, setShowEditModal] = useState(false);
  const [editingListing, setEditingListing] = useState(null);
  const [showAddSpaceModal, setShowAddSpaceModal] = useState(false);
  const [showPreviewModal, setShowPreviewModal] = useState(false);
  const [previewListing, setPreviewListing] = useState(null);
  const [previewImageIndex, setPreviewImageIndex] = useState(0);
  const [savingUnit, setSavingUnit] = useState(false);
  const [showManagerInquiries, setShowManagerInquiries] = useState(false);

  const loadCachedUnits = (propertyId) => {
    try {
      const raw = localStorage.getItem(`pm_units_${propertyId}`);
      if (!raw) return [];
      const parsed = JSON.parse(raw);
      return Array.isArray(parsed) ? parsed : [];
    } catch { return []; }
  };

  const cacheUnits = (propertyId, units) => {
    try { localStorage.setItem(`pm_units_${propertyId}`, JSON.stringify(units)); } catch {}
  };

  // Helper function to update property counts based on actual unit statuses
  const updatePropertyCounts = useCallback((propertyId) => {
    const propertyUnits = listings.filter(l => l.propertyId === propertyId);
    const vacant = propertyUnits.filter(l => {
      const status = (l.status || '').toLowerCase();
      return status === 'vacant' || status === 'available';
    }).length;
    const occupied = propertyUnits.filter(l => {
      const status = (l.status || '').toLowerCase();
      return status === 'occupied' || status === 'rented';
    }).length;
    
    setProperties(prev => prev.map(p => {
      if (p.id === propertyId) {
        return {
          ...p,
              maxUnits: p.maxUnits || 0, // Preserve the property's unit limit from database
          vacantUnits: vacant,
          occupiedUnits: occupied,
              totalUnits: propertyUnits.length // Actual count of units currently added
        };
      }
      return p;
    }));
  }, [listings]);

  const fetchUnitsForProperty = async (property) => {
    try {
      const res = await api.listUnits(property.id);
      const items = Array.isArray(res?.units) ? res.units : [];
      const mapped = items.map((u) => {
        // Handle images - can be array of strings or array of objects
        let imgArr = [];
        if (Array.isArray(u.images)) {
          imgArr = u.images.map(img => {
            if (typeof img === 'string') return img;
            if (img && img.url) return img.url;
            return null;
          }).filter(Boolean);
        } else if (typeof u.images === 'string') {
          try {
            const parsed = JSON.parse(u.images);
            if (Array.isArray(parsed)) {
              imgArr = parsed.map(img => {
                if (typeof img === 'string') return img;
                if (img && img.url) return img.url;
                return null;
              }).filter(Boolean);
            }
          } catch (e) {
            console.warn('Failed to parse unit images', e);
          }
        }
        
        // Normalize status - status can be 'draft', 'vacant', 'occupied', etc.
        // Backend may return 'vacant' if unit has no active tenant assignment, 'occupied' if it does
        // But we also support 'draft' status for unpublished units
        let normalizedStatus = u.status || 'draft';
        if (normalizedStatus) {
          const statusUpper = String(normalizedStatus).toUpperCase();
          // Normalize status values
          if (statusUpper === 'VACANT' || statusUpper === 'AVAILABLE') {
            normalizedStatus = 'Vacant';
          } else if (statusUpper === 'OCCUPIED' || statusUpper === 'RENTED') {
            normalizedStatus = 'Occupied';
          } else if (statusUpper === 'DRAFT' || statusUpper === 'PENDING') {
            normalizedStatus = 'Draft';
          } else if (statusUpper === 'MAINTENANCE') {
            normalizedStatus = 'Maintenance';
          } else {
            // Capitalize first letter
            normalizedStatus = String(normalizedStatus).charAt(0).toUpperCase() + String(normalizedStatus).slice(1).toLowerCase();
          }
        }
        
        // Handle amenities - ensure it's an object with boolean values
        let amenities = { balcony: false, furnished: false, airConditioning: false, wifi: false, security: false };
        if (u.amenities) {
          if (typeof u.amenities === 'object' && !Array.isArray(u.amenities)) {
            amenities = {
              balcony: Boolean(u.amenities.balcony),
              furnished: Boolean(u.amenities.furnished),
              airConditioning: Boolean(u.amenities.airConditioning || u.amenities.air_conditioning),
              wifi: Boolean(u.amenities.wifi),
              security: Boolean(u.amenities.security)
            };
          } else if (typeof u.amenities === 'string') {
            try {
              const parsed = JSON.parse(u.amenities);
              if (typeof parsed === 'object' && !Array.isArray(parsed)) {
                amenities = {
                  balcony: Boolean(parsed.balcony),
                  furnished: Boolean(parsed.furnished),
                  airConditioning: Boolean(parsed.airConditioning || parsed.air_conditioning),
                  wifi: Boolean(parsed.wifi),
                  security: Boolean(parsed.security)
                };
              }
            } catch (e) {
              console.warn('Failed to parse amenities', e);
            }
        }
        }
        
        return {
          id: `L-${u.id}`,
          propertyId: property.id,
          propertyName: property.name,
          propertyManager: property.propertyManager || '',
          unitName: u.unit_name || u.unitName || u.name || `Unit ${u.id}`,
          bedrooms: u.bedrooms || 0,
          bathrooms: u.bathrooms || 'own',
          sizeSqm: u.size_sqm || u.sizeSqm || 0,
          price: Number(u.price || u.monthly_rent || 0),
          securityDeposit: Number(u.security_deposit || u.securityDeposit || 0),
          status: normalizedStatus,
          description: u.description || '',
          floorNumber: u.floor_number || u.floorNumber || '',
          parkingSpaces: u.parking_spaces || u.parkingSpaces || 0,
          amenities: amenities,
          images: imgArr,
          inquiriesCount: u.inquiries_count || u.inquiriesCount || 0,
          updatedAt: (u.updated_at ? new Date(u.updated_at).getTime() : Date.now()),
          image: normalizeImageUrl(imgArr[0]) || defaultUnit
        };
      });
      setListings(prev => {
        const others = prev.filter(l => l.propertyId !== property.id);
        const merged = [...others, ...mapped];
        cacheUnits(property.id, merged);
        
        // Update property counts after setting listings - use normalized status values
        setTimeout(() => {
          const propertyUnits = merged.filter(l => l.propertyId === property.id);
          const vacant = propertyUnits.filter(l => {
            const status = (l.status || '').toLowerCase();
            return status === 'vacant' || status === 'available';
          }).length;
          const occupied = propertyUnits.filter(l => {
            const status = (l.status || '').toLowerCase();
            return status === 'occupied' || status === 'rented';
          }).length;
          
          setProperties(prevProps => prevProps.map(p => {
            if (p.id === property.id) {
              return {
                ...p,
                maxUnits: p.maxUnits || 0, // Preserve the property's unit limit from database
                vacantUnits: vacant,
                occupiedUnits: occupied,
                totalUnits: propertyUnits.length // Actual count of units currently added
              };
            }
            return p;
          }));
        }, 100);
        return merged;
      });
    } catch (e) {
      console.warn('Failed to load units', e);
    }
  };
  const [newSpace, setNewSpace] = useState({
    unitName: '',
    bedrooms: 1,
    bathrooms: 'own',
    sizeSqm: '',
    price: '',
    securityDeposit: '',
    status: 'draft', // New units default to Draft status
    description: '',
    floorNumber: '',
    parkingSpaces: 0,
    amenities: {
      balcony: false,
      furnished: false,
      airConditioning: false,
      wifi: false,
      security: false
    },
    images: []
  });
  const itemsPerPage = 6;

  const normalizeImageUrl = (value) => {
    if (!value || typeof value !== 'string') return null;
    
    // Base64 data URL (from uploaded images)
    if (value.startsWith('data:image/')) return value;
    
    // Already absolute URL
    if (value.startsWith('http://') || value.startsWith('https://')) return value;
    
    // Our backend uploads directory (serve directly from backend instance root)
    // Always use HTTP for localhost backend (backend doesn't support HTTPS)
    if (value.startsWith('/uploads/')) return `http://localhost:5000${value}`;
    
    // Backend relative path for API
    if (value.startsWith('/')) return `${API_BASE_URL}${value}`;
    
    // File path (from file uploads)
    if (value.includes('/') && !value.startsWith('http')) {
      return `${API_BASE_URL}/${value}`;
    }
    
    // Unrecognized format -> return null to let components handle fallback
    return null;
  };

  // Fetch approved managed properties for the manager
  useEffect(() => {
    let isMounted = true;
    async function fetchApproved() {
      try {
        setLoading(true);
        setError(null);
        const res = await api.getMyProperties();
        const items = Array.isArray(res?.properties) ? res.properties : [];
        
        // Filter for approved/active properties - handle both normalized (uppercase) and legacy status values
        const approved = items.filter(it => {
          const status = (it.status || '').toUpperCase();
          return status === 'ACTIVE' || status === 'APPROVED' || 
                 status === 'ACTIVE' || status === 'APPROVED' ||
                 it.status === 'active' || it.status === 'approved';
        });
        
        const mapped = approved.map((it) => {
          // Handle images - can be array of objects with 'url' or array of strings
          let images = [];
          if (Array.isArray(it.images)) {
            images = it.images.map(img => {
              if (typeof img === 'string') return { url: img };
              if (img && img.url) return img;
              return null;
            }).filter(Boolean);
          } else if (typeof it.images === 'string') {
            try {
              const parsed = JSON.parse(it.images);
              if (Array.isArray(parsed)) {
                images = parsed.map(img => {
                  if (typeof img === 'string') return { url: img };
                  if (img && img.url) return img;
                  return null;
                }).filter(Boolean);
              }
            } catch (e) {
              console.warn('Failed to parse images for property', it.id, e);
            }
          }
          
          const primaryImage = images.length > 0 ? images[0].url : null;
          
          // Handle address - can be object or string
          let addressStr = '—';
          if (typeof it.address === 'string') {
            addressStr = it.address;
          } else if (it.address && typeof it.address === 'object') {
            const parts = [];
            if (it.address.full) parts.push(it.address.full);
            if (it.address.building_name) parts.push(it.address.building_name);
            if (it.address.city) parts.push(it.address.city);
            if (it.address.province) parts.push(it.address.province);
            addressStr = parts.length > 0 ? parts.join(', ') : '—';
          }
          
          // Calculate average rent from monthly_rent or pricing object
          let averageRent = 0;
          if (it.pricing && it.pricing.monthly_rent) {
            averageRent = Number(it.pricing.monthly_rent) || 0;
          } else if (it.monthly_rent) {
            averageRent = Number(it.monthly_rent) || 0;
          }
          
          return {
            id: it.id,
            name: it.building_name || it.title || `Property ${it.id}`,
            address: addressStr,
            maxUnits: it.total_units || 0, // Property's unit limit from database (set when property was created)
            totalUnits: 0, // Actual count of units (will be calculated from actual units)
            occupiedUnits: 0, // Will be calculated from actual units
            vacantUnits: 0, // Will be calculated from actual units
            monthlyRevenue: 0, // Can be calculated from units if needed
            averageRent: averageRent,
            image: normalizeImageUrl(primaryImage),
            lastUpdated: it.updated_at ? new Date(it.updated_at).getTime() : Date.now(),
            propertyManager: it.contact_person || it.manager_name || it.owner_name || ''
          };
        });
        
        // Fetch units for each property and calculate actual counts
        const propertiesWithUnits = await Promise.all(
          mapped.map(async (property) => {
            try {
              const unitsRes = await api.listUnits(property.id);
              const units = Array.isArray(unitsRes?.units) ? unitsRes.units : [];
              
              // Calculate counts from actual units
              const totalUnits = units.length;
              const vacant = units.filter(u => {
                const status = (u.status || '').toLowerCase();
                return status === 'vacant' || status === 'available';
              }).length;
              const occupied = units.filter(u => {
                const status = (u.status || '').toLowerCase();
                return status === 'occupied' || status === 'rented';
              }).length;
              
              return {
                ...property,
                maxUnits: property.maxUnits || 0, // Preserve the property's unit limit from database
                totalUnits: totalUnits, // Actual count of units currently added
                vacantUnits: vacant,
                occupiedUnits: occupied
              };
            } catch (error) {
              console.warn(`Failed to fetch units for property ${property.id}:`, error);
              // Return property with zero counts if units fetch fails
              return property;
            }
          })
        );
        
        if (isMounted) {
          setProperties(propertiesWithUnits);

          // Auto-restore last selected property if exists
          const lastIdRaw = localStorage.getItem('pm_last_property_id');
          const lastId = lastIdRaw ? parseInt(lastIdRaw, 10) : null;
          if (lastId) {
            const found = propertiesWithUnits.find(p => p.id === lastId);
            if (found) {
              setSelectedProperty(found);
              // Show cached immediately, then refresh
              const cached = loadCachedUnits(found.id);
              if (cached.length > 0) {
                setListings(prev => {
                  const others = prev.filter(l => l.propertyId !== found.id);
                  return [...others, ...cached];
                });
              }
              fetchUnitsForProperty(found);
            }
          }
          // If nothing selected and exactly one property, auto-select
          if (!lastId && propertiesWithUnits.length === 1) {
            setSelectedProperty(propertiesWithUnits[0]);
            const cached = loadCachedUnits(propertiesWithUnits[0].id);
            if (cached.length > 0) {
              setListings(prev => {
                const others = prev.filter(l => l.propertyId !== propertiesWithUnits[0].id);
                return [...others, ...cached];
              });
            }
            fetchUnitsForProperty(propertiesWithUnits[0]);
          }
        }
      } catch (e) {
        // Swallow errors to avoid noisy banners; show empty state instead
        if (isMounted) {
          setProperties([]);
          setError('An error occurred while fetching available properties');
        }
      } finally {
        if (isMounted) setLoading(false);
      }
    }
    fetchApproved();
    return () => { isMounted = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Update property counts whenever listings change for the selected property
  useEffect(() => {
    if (selectedProperty && selectedProperty.id) {
      updatePropertyCounts(selectedProperty.id);
    }
  }, [listings, selectedProperty, updatePropertyCounts]);

  // Get filtered listings for selected property
  const filteredListings = useMemo(() => {
    if (!selectedProperty) return [];
    
    const term = (searchTerm || '').toLowerCase().trim();
    const parsedMin = priceMin !== '' && priceMin !== null ? Number(priceMin) : null;
    const parsedMax = priceMax !== '' && priceMax !== null ? Number(priceMax) : null;
    const isThreePlus = (val) => val === '3+' || val === '3_plus' || val === '3plus';
    
    return listings.filter(listing => {
      if (listing.propertyId !== selectedProperty.id) return false;
      
      const matchesSearch = term.length === 0 || (listing.unitName || '').toLowerCase().includes(term);
      
      // Status matching - handle case-insensitive comparison
      const matchesStatus = statusFilter === 'All' || 
        (listing.status || '').toLowerCase() === statusFilter.toLowerCase();
      
      const matchesBedrooms = (
        bedroomsFilter === 'All' ||
        (isThreePlus(bedroomsFilter) ? Number(listing.bedrooms) >= 3 : String(listing.bedrooms) === String(bedroomsFilter))
      );
      const matchesPriceMin = parsedMin === null || Number(listing.price) >= parsedMin;
      const matchesPriceMax = parsedMax === null || Number(listing.price) <= parsedMax;
      
      return matchesSearch && matchesStatus && matchesBedrooms && matchesPriceMin && matchesPriceMax;
    });
  }, [listings, selectedProperty, searchTerm, statusFilter, bedroomsFilter, priceMin, priceMax]);

  const sortedListings = useMemo(() => {
    const sorted = [...filteredListings].sort((a, b) => {
      let comparison = 0;
      switch (sortBy) {
        case 'Recent':
          comparison = b.updatedAt - a.updatedAt;
          break;
        case 'Price':
          comparison = a.price - b.price;
          break;
        case 'Inquiries':
          comparison = b.inquiriesCount - a.inquiriesCount;
          break;
        case 'Size':
          comparison = a.sizeSqm - b.sizeSqm;
          break;
        default:
          comparison = 0;
      }
      return sortOrder === 'desc' ? -comparison : comparison;
    });
    return sorted;
  }, [filteredListings, sortBy, sortOrder]);

  const currentPageItems = useMemo(() => {
    const startIndex = (page - 1) * itemsPerPage;
    return sortedListings.slice(startIndex, startIndex + itemsPerPage);
  }, [sortedListings, page]);

  const totalPages = Math.ceil(sortedListings.length / itemsPerPage);

  const handlePropertyClick = (property) => {
    setSelectedProperty(property);
    // Remember selection for tab switches / reloads
    try { localStorage.setItem('pm_last_property_id', String(property.id)); } catch {}
    setPage(1);
    setSearchTerm('');
    setStatusFilter('All');
    setBedroomsFilter('All');
    setPriceMin('');
    setPriceMax('');
    setSelectedIds(new Set());
    // Load units from backend for this managed property
    fetchUnitsForProperty(property);
  };

  const handleBackToProperties = () => {
    setSelectedProperty(null);
    try { localStorage.removeItem('pm_last_property_id'); } catch {}
    setPage(1);
    setSearchTerm('');
    setStatusFilter('All');
    setBedroomsFilter('All');
    setPriceMin('');
    setPriceMax('');
    setSelectedIds(new Set());
  };

  const handleBulkAction = async (action) => {
    if (selectedIds.size === 0) return;

    const selectedArray = Array.from(selectedIds);
    const results = [];

    for (const id of selectedArray) {
      try {
        const numericId = Number(String(id).replace('L-', ''));
        if (!Number.isFinite(numericId)) continue;

        if (action === 'delete') {
          await api.deleteUnit(numericId);
          results.push({ id, type: 'deleted' });
          continue;
        }

        // Map actions to DB statuses
        // Publish: Change from Draft to Vacant (make it available for rent)
        // Unpublish: Change to Draft (hide from public listings)
        let status;
        if (action === 'publish') {
          // Publish: Change Draft to Vacant
          status = 'vacant';
        } else if (action === 'unpublish') {
          // Unpublish: Change to Draft
          status = 'draft';
        } else {
          status = 'maintenance';
        }

        // Backend expects full payload for update; hydrate from current listing
        const listing = listings.find(l => l.id === id);
        if (!listing) continue;
        const payload = {
          unitName: listing.unitName,
          bedrooms: listing.bedrooms,
          bathrooms: listing.bathrooms,
          sizeSqm: listing.sizeSqm,
          monthlyRent: listing.price,
          securityDeposit: listing.securityDeposit || 0,
          status,
          description: listing.description || '',
          floorNumber: listing.floorNumber || '',
          parkingSpaces: listing.parkingSpaces || 0,
          balcony: listing.amenities?.balcony || false,
          furnished: listing.amenities?.furnished || false,
          airConditioning: listing.amenities?.airConditioning || false,
          wifi: listing.amenities?.wifi || false,
          security: listing.amenities?.security || false,
          images: Array.isArray(listing.images) ? listing.images : []
        };
        await api.updateUnit(numericId, payload);
        results.push({ id, type: 'updated', status });
      } catch (e) {
        console.warn(`Bulk ${action} failed for ${id}`, e);
      }
    }

    // Apply local state updates based on results
    setListings(prev => prev
      .map(listing => {
        const r = results.find(x => x.id === listing.id);
        if (!r) return listing;
        if (r.type === 'deleted') return null;
        if (r.type === 'updated') {
          // Normalize the status for display
          let normalizedStatus = r.status;
          if (r.status === 'vacant') normalizedStatus = 'Vacant';
          else if (r.status === 'draft') normalizedStatus = 'Draft';
          else if (r.status === 'occupied') normalizedStatus = 'Occupied';
          else if (r.status === 'maintenance') normalizedStatus = 'Maintenance';
          return { ...listing, status: normalizedStatus };
        }
        return listing;
      })
      .filter(Boolean)
    );

    // Clear selection and refresh from backend for the selected property to ensure consistency
    setSelectedIds(new Set());
    if (selectedProperty) {
      try { 
        await fetchUnitsForProperty(selectedProperty);
        // Update property counts after bulk action
        setTimeout(() => updatePropertyCounts(selectedProperty.id), 100);
      } catch (_) {}
    }
  };

  const handleEdit = (listing) => {
    setEditingListing(listing);
    setShowEditModal(true);
  };

  const handlePreview = (listing) => {
    setPreviewListing(listing);
    setPreviewImageIndex(0);
    setShowPreviewModal(true);
  };

  const handleInquiries = () => {
    setShowManagerInquiries(true);
  };

  const handleSaveEdit = async (updatedListing) => {
    try {
      // Extract numeric ID from frontend ID (remove "L-" prefix)
      const numericId = updatedListing.id.replace('L-', '');
      
      // Prepare payload with amenities as individual fields
      const payload = {
        unitName: updatedListing.unitName,
        bedrooms: updatedListing.bedrooms,
        bathrooms: updatedListing.bathrooms,
        sizeSqm: updatedListing.sizeSqm,
        monthlyRent: updatedListing.price,  // Backend expects monthlyRent, not price
        securityDeposit: updatedListing.securityDeposit,
        status: updatedListing.status,
        description: updatedListing.description,
        floorNumber: updatedListing.floorNumber,
        parkingSpaces: updatedListing.parkingSpaces,
        balcony: updatedListing.amenities?.balcony || false,
        furnished: updatedListing.amenities?.furnished || false,
        airConditioning: updatedListing.amenities?.airConditioning || false,
        wifi: updatedListing.amenities?.wifi || false,
        security: updatedListing.amenities?.security || false,
        images: updatedListing.images || []
      };

        // Call API to update the unit with numeric ID
        const res = await api.updateUnit(numericId, payload);
        if (res && res.message) {
          // Update local state
          setListings(prev => prev.map(listing => 
            listing.id === updatedListing.id ? updatedListing : listing
          ));
          setShowEditModal(false);
          setEditingListing(null);
          // Update property counts after unit edit
          if (updatedListing.propertyId) {
            setTimeout(() => updatePropertyCounts(updatedListing.propertyId), 100);
          }
          alert('Unit updated successfully!');
        }
      } catch (error) {
        console.error('Error updating unit:', error);
        alert('Failed to update unit. Please try again.');
      }
    };

  const handleAddSpace = () => {
    if (!selectedProperty || !selectedProperty.id) {
      alert('Please select a property first');
      return;
    }
    if (savingUnit) return;
    if (!newSpace.unitName || !newSpace.sizeSqm || !newSpace.price) {
      alert('Please fill in all required fields');
      return;
    }

    // Check if adding another unit would exceed the property's total units limit
    const currentUnitsForProperty = listings.filter(l => l.propertyId === selectedProperty.id);
    const currentUnitCount = currentUnitsForProperty.length;
    // Use maxUnits (the limit set when property was created) instead of totalUnits (actual count)
    const maxUnits = selectedProperty.maxUnits || selectedProperty.totalUnits || 0;
    
    if (maxUnits > 0 && currentUnitCount >= maxUnits) {
      alert(`Cannot add more units. This property is limited to ${maxUnits} unit${maxUnits !== 1 ? 's' : ''}. You currently have ${currentUnitCount} unit${currentUnitCount !== 1 ? 's' : ''}.`);
      return;
    }

    // Normalize status for display (capitalize first letter)
    const normalizeStatusForDisplay = (status) => {
      if (!status) return 'Draft';
      const statusLower = String(status).toLowerCase();
      if (statusLower === 'draft') return 'Draft';
      if (statusLower === 'vacant') return 'Vacant';
      if (statusLower === 'occupied') return 'Occupied';
      if (statusLower === 'maintenance') return 'Maintenance';
      return String(status).charAt(0).toUpperCase() + String(status).slice(1).toLowerCase();
    };

    const newListing = {
      id: `L-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      propertyId: selectedProperty.id,
      propertyName: selectedProperty.name,
      unitName: newSpace.unitName,
      bedrooms: Number(newSpace.bedrooms) || 0,
      bathrooms: Number(newSpace.bathrooms) || 0,
      sizeSqm: Number(newSpace.sizeSqm) || 0,
      price: Number(newSpace.price) || 0,
      securityDeposit: Number(newSpace.securityDeposit) || 0,
      status: normalizeStatusForDisplay(newSpace.status), // Normalize for display (Draft, Vacant, etc.)
      inquiriesCount: 0,
      updatedAt: Date.now(),
      propertyManager: selectedProperty.propertyManager || '',
      description: newSpace.description,
      floorNumber: newSpace.floorNumber,
      parkingSpaces: Number(newSpace.parkingSpaces) || 0,
      amenities: {
        balcony: newSpace.amenities.balcony,
        furnished: newSpace.amenities.furnished,
        airConditioning: newSpace.amenities.airConditioning,
        wifi: newSpace.amenities.wifi,
        security: newSpace.amenities.security
      },
      images: newSpace.images
    };

    // Add to state immediately for instant UI update
    setListings(prev => [...prev, newListing]);
    // Jump to first page so the newly added unit is visible immediately
    setPage(1);
    
    // Close modal immediately for better UX
    setShowAddSpaceModal(false);
    
    // Reset form (status will be reset to 'draft' by default in useState)
    // Note: Form reset happens above, this is just for clarity
    
    // Persist to backend and refresh
    (async () => {
      try {
        setSavingUnit(true);
        
        // Use the original status from newSpace (before normalization) to ensure 'draft' is preserved
        // newSpace.status is 'draft' (lowercase), which is what we want to send to backend
        const statusForBackend = String(newSpace.status || 'draft').toLowerCase();
        
        const payload = {
          unitName: newListing.unitName,
          bedrooms: newListing.bedrooms,
          bathrooms: newListing.bathrooms,
          sizeSqm: newListing.sizeSqm,
          monthlyRent: newListing.price,  // Backend expects monthlyRent, not price
          securityDeposit: newListing.securityDeposit,
          status: statusForBackend, // Backend expects lowercase: 'draft', 'vacant', etc.
          description: newListing.description,
          floorNumber: newListing.floorNumber,
          parkingSpaces: newListing.parkingSpaces,
          balcony: newListing.amenities?.balcony || false,
          furnished: newListing.amenities?.furnished || false,
          airConditioning: newListing.amenities?.airConditioning || false,
          wifi: newListing.amenities?.wifi || false,
          security: newListing.amenities?.security || false,
          images: newListing.images || []
        };
        
        await api.createUnit(selectedProperty.id, payload);
        
        // Refresh from server to get complete data with proper mapping
        // This will replace the temp listing with the real one from server
        await fetchUnitsForProperty(selectedProperty);
        
      } catch (e) {
        console.error('Failed to persist unit:', e);
        alert('Unit was added locally but failed to save to server. Please refresh the page.');
        // Keep the local listing even if save failed
      } finally {
        setSavingUnit(false);
      }
    })();
  };

  const handleInputChange = (field, value) => {
    setNewSpace(prev => ({
      ...prev,
      [field]: value
    }));
  };

  // Upload new unit images to backend and store URLs
  const handleImageUpload = async (e) => {
    const files = Array.from(e.target.files);
    if (files.length === 0) return;
    try {
      const uploadedUrls = [];
      for (let i = 0; i < files.length; i++) {
        const file = files[i];
        if (file.type.startsWith('image/')) {
          try {
            const res = await api.uploadUnitImage(file);
            if (res?.url) uploadedUrls.push(res.url);
          } catch (err) {
            alert('Failed to upload image: ' + (err.message || 'Unknown error'));
          }
        }
      }
      setNewSpace(prev => ({
        ...prev,
        images: [...(prev.images || []), ...uploadedUrls].slice(0, 10)
      }));
    } finally {
      e.target.value = '';
    }
  };

  const removeImage = (index) => {
    setNewSpace(prev => ({
      ...prev,
      images: prev.images.filter((_, i) => i !== index)
    }));
  };

  const handleEditImageUpload = async (e) => {
    const files = Array.from(e.target.files);
    if (files.length === 0) return;
    try {
      const uploadedUrls = [];
      for (let i = 0; i < files.length; i++) {
        const file = files[i];
        if (file.type.startsWith('image/')) {
          try {
            const res = await api.uploadUnitImage(file);
            if (res?.url) uploadedUrls.push(res.url);
          } catch (err) {
            alert('Failed to upload image: ' + (err.message || 'Unknown error'));
          }
        }
      }
      setEditingListing(prev => ({
        ...prev,
        images: [...(prev.images || []), ...uploadedUrls].slice(0, 10)
      }));
    } finally {
      e.target.value = '';
    }
  };

  const removeEditImage = (index) => {
    setEditingListing(prev => ({
      ...prev,
      images: prev.images.filter((_, i) => i !== index)
    }));
  };


  const handleAmenityToggle = (amenity) => {
    setNewSpace(prev => ({
      ...prev,
      amenities: {
        ...prev.amenities,
        [amenity]: !prev.amenities[amenity]
      }
    }));
  };

  const formatDate = (timestamp) => {
    const now = Date.now();
    const diff = now - timestamp;
    const days = Math.floor(diff / (1000 * 60 * 60 * 24));
    const hours = Math.floor(diff / (1000 * 60 * 60));
    
    if (days > 0) return `${days} day${days > 1 ? 's' : ''} ago`;
    if (hours > 0) return `${hours} hour${hours > 1 ? 's' : ''} ago`;
    return 'Just now';
  };

  // Render Properties View
  const renderPropertiesView = () => (
    <div>
      {/* Hero Header */}
      <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-gray-800 via-gray-900 to-black text-white mb-8">
        <div className="absolute inset-0 bg-black/20"></div>
        <div className="relative p-8">
          <div className="flex flex-col lg:flex-row items-start lg:items-center justify-between space-y-4 lg:space-y-0">
            <div>
              <h1 className="text-3xl font-bold mb-2">Manage Your Properties</h1>
              <p className="text-gray-300 text-lg">Select a property to manage its spaces and rooms</p>
              <div className="flex items-center space-x-6 mt-4">
                <div className="flex items-center space-x-2">
                  <div className="w-3 h-3 bg-blue-400 rounded-full"></div>
                  <span className="text-sm">{properties.length} Properties</span>
                </div>
                <div className="flex items-center space-x-2">
                  <div className="w-3 h-3 bg-green-400 rounded-full"></div>
                  <span className="text-sm">{properties.reduce((sum, p) => sum + (p.vacantUnits || 0), 0)} Vacant Units</span>
                </div>
                <div className="flex items-center space-x-2">
                  <div className="w-3 h-3 bg-gray-400 rounded-full"></div>
                  <span className="text-sm">{properties.reduce((sum, p) => sum + (p.occupiedUnits || 0), 0)} Occupied Units</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Properties Grid */}
      {error && (
        <div className="mb-4 p-4 rounded-xl bg-red-50 border border-red-200 text-red-700 text-sm">{error}</div>
      )}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {loading && properties.length === 0 && (
          <div className="col-span-1 md:col-span-2 lg:col-span-3 bg-white rounded-2xl shadow-lg border border-gray-100 p-8 text-center text-gray-600">
            Loading approved properties...
          </div>
        )}
        {!loading && properties.length === 0 && (
          <div className="col-span-1 md:col-span-2 lg:col-span-3 bg-white rounded-2xl shadow-lg border border-gray-100 p-8 text-center">
            <h3 className="text-lg font-semibold text-gray-900 mb-2">No approved properties</h3>
            <p className="text-gray-600">Properties will appear here after approval.</p>
          </div>
        )}
        {properties.map((property) => (
          <div 
            key={property.id} 
            className="bg-white rounded-2xl shadow-lg border border-gray-100 overflow-hidden hover:shadow-xl transition-all duration-300 cursor-pointer"
            onClick={() => handlePropertyClick(property)}
          >
            {/* Property Image */}
            <div className="relative h-60 bg-gray-200 flex items-center justify-center">
              <img
                src={property.image && property.image.trim() !== '' ? property.image : defaultProperty}
                alt={property.name}
                className="w-full object-cover rounded-lg"
                onError={(e) => { e.target.src = defaultProperty; }}
              />
              <div className="absolute top-3 right-3">
                <span className="px-3 py-1 rounded-full text-xs font-semibold bg-blue-100 text-blue-800 border border-blue-200">
                  {property.vacantUnits > 0 ? 'Available' : 'Full'}
                </span>
              </div>
            </div>

            {/* Property Details */}
            <div className="p-6">
              <h3 className="font-bold text-gray-900 text-xl mb-2">{property.name}</h3>
              <p className="text-gray-600 text-sm mb-4">{property.address}</p>
              
              {/* Property Stats */}
              <div className="grid grid-cols-2 gap-4 mb-4">
                <div className="text-center">
                  <p className="text-sm text-gray-500">Total Units</p>
                  <p className="font-semibold text-gray-900">{property.totalUnits || 0}</p>
                </div>
                <div className="text-center">
                  <p className="text-sm text-gray-500">Vacant</p>
                  <p className="font-semibold text-green-600">{property.vacantUnits || 0}</p>
                </div>
              </div>

              {/* Pricing Info (derived) */}
              <div className="border-t pt-4">
                <div className="flex justify-between items-center">
                  <span className="text-sm text-gray-500">Base Monthly Rent</span>
                  <span className="text-sm font-medium text-gray-700">₱{(property.averageRent || 0).toLocaleString()}</span>
                </div>
              </div>

              {/* Click to Manage Button */}
              <div className="mt-4">
                <button className="w-full bg-black text-white py-3 px-4 rounded-lg hover:bg-gray-800 transition-colors font-medium">
                  Manage Spaces
                </button>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );

  // Render Spaces/Rooms View
  const renderSpacesView = () => (
    <div>
      {/* Back Button and Property Header */}
      <div className="mb-6">
        <button
          onClick={handleBackToProperties}
          className="flex items-center space-x-2 text-gray-600 hover:text-black transition-colors mb-4"
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
          <span>Back to Properties</span>
        </button>
        
        <div className="bg-white rounded-2xl shadow-lg border border-gray-100 p-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-4">
              <img
                src={selectedProperty.image || defaultProperty}
                alt={selectedProperty.name}
                className="w-12 h-12 rounded-lg object-cover"
                onError={(e) => { e.target.src = defaultProperty; }}
              />
              <div>
                <h1 className="text-2xl font-bold text-gray-900">{selectedProperty.name}</h1>
                <p className="text-gray-600">{selectedProperty.address}</p>
                <div className="flex items-center space-x-6 mt-2">
                  <span className="text-sm text-gray-500">
                    {selectedProperty.totalUnits || 0} total units • {selectedProperty.vacantUnits || 0} vacant • {selectedProperty.occupiedUnits || 0} occupied
                  </span>
                </div>
              </div>
            </div>
            <button
              onClick={() => {
                const currentUnitsForProperty = listings.filter(l => l.propertyId === selectedProperty.id);
                const currentUnitCount = currentUnitsForProperty.length;
                // Use maxUnits (the limit set when property was created) instead of totalUnits (actual count)
                const maxUnits = selectedProperty.maxUnits || selectedProperty.totalUnits || 0;
                
                if (maxUnits > 0 && currentUnitCount >= maxUnits) {
                  alert(`Cannot add more units. This property is limited to ${maxUnits} unit${maxUnits !== 1 ? 's' : ''}. You currently have ${currentUnitCount} unit${currentUnitCount !== 1 ? 's' : ''}.`);
                  return;
                }
                setShowAddSpaceModal(true);
              }}
              className="bg-black text-white px-6 py-3 rounded-xl hover:bg-gray-800 transition-colors font-medium"
            >
              Add New Space
            </button>
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
          {(searchTerm || statusFilter !== 'All' || bedroomsFilter !== 'All' || priceMin || priceMax) && (
            <button
              onClick={() => {
                setSearchTerm('');
                setStatusFilter('All');
                setBedroomsFilter('All');
                setPriceMin('');
                setPriceMax('');
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
        
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {/* Search Input */}
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-2 flex items-center">
              <svg className="w-4 h-4 mr-1.5 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
              Search Spaces
            </label>
            <div className="relative">
            <input
              type="text"
                placeholder="Search by unit name..."
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
                {filteredListings.length} {filteredListings.length === 1 ? 'space' : 'spaces'} found
              </p>
            )}
          </div>

          {/* Status Filter */}
          <div>
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
              <option value="Vacant">Vacant</option>
              <option value="Occupied">Occupied</option>
              <option value="Draft">Draft</option>
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
                {listings.filter(l => {
                  if (l.propertyId !== selectedProperty?.id) return false;
                  const status = (l.status || '').toLowerCase();
                  return status === statusFilter.toLowerCase();
                }).length} {statusFilter.toLowerCase()} {listings.filter(l => {
                  if (l.propertyId !== selectedProperty?.id) return false;
                  const status = (l.status || '').toLowerCase();
                  return status === statusFilter.toLowerCase();
                }).length === 1 ? 'space' : 'spaces'}
              </p>
            )}
          </div>

          {/* Bedrooms Filter */}
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-2 flex items-center">
              <svg className="w-4 h-4 mr-1.5 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" />
              </svg>
              Bedrooms
            </label>
            <div className="relative">
            <select
              value={bedroomsFilter}
              onChange={(e) => setBedroomsFilter(e.target.value)}
                className="w-full pl-10 pr-10 py-3 border border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all duration-200 appearance-none bg-white cursor-pointer"
            >
              <option value="All">All Bedrooms</option>
              <option value="1">1 Bedroom</option>
              <option value="2">2 Bedrooms</option>
              <option value="3+">3+ Bedrooms</option>
            </select>
              <div className="absolute left-3 top-1/2 transform -translate-y-1/2 pointer-events-none">
                <svg className="w-5 h-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" />
                </svg>
          </div>
              <div className="absolute right-3 top-1/2 transform -translate-y-1/2 pointer-events-none">
                <svg className="w-5 h-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                </svg>
              </div>
            </div>
          </div>

          {/* Sort By */}
          <div>
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
                <option value="Price">Price (Low to High)</option>
                <option value="Inquiries">Most Inquiries</option>
                <option value="Size">Size (Smallest First)</option>
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
              Showing {currentPageItems.length} of {sortedListings.length} spaces
            </p>
          </div>
        </div>
        
        {/* Price Range */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-4 pt-4 border-t border-gray-200">
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-2 flex items-center">
              <svg className="w-4 h-4 mr-1.5 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1" />
              </svg>
              Min Price (₱)
            </label>
            <input
              type="number"
              placeholder="0"
              min="0"
              value={priceMin}
              onChange={(e) => setPriceMin(e.target.value)}
              className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all duration-200"
            />
          </div>
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-2 flex items-center">
              <svg className="w-4 h-4 mr-1.5 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1" />
              </svg>
              Max Price (₱)
            </label>
            <input
              type="number"
              placeholder="No limit"
              min="0"
              value={priceMax}
              onChange={(e) => setPriceMax(e.target.value)}
              className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all duration-200"
            />
          </div>
        </div>

        {/* Active Filters Badge */}
        {(searchTerm || statusFilter !== 'All' || bedroomsFilter !== 'All' || priceMin || priceMax) && (
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
                  Status: {statusFilter}
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
              {bedroomsFilter !== 'All' && (
                <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-medium bg-green-100 text-green-800">
                  Bedrooms: {bedroomsFilter === '3+' ? '3+' : bedroomsFilter}
                  <button
                    onClick={() => setBedroomsFilter('All')}
                    className="ml-2 hover:text-green-600"
                  >
                    <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </button>
                </span>
              )}
              {priceMin && (
                <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-medium bg-yellow-100 text-yellow-800">
                  Min: ₱{parseInt(priceMin).toLocaleString()}
                  <button
                    onClick={() => setPriceMin('')}
                    className="ml-2 hover:text-yellow-600"
                  >
                    <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </button>
                </span>
              )}
              {priceMax && (
                <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-medium bg-yellow-100 text-yellow-800">
                  Max: ₱{parseInt(priceMax).toLocaleString()}
                  <button
                    onClick={() => setPriceMax('')}
                    className="ml-2 hover:text-yellow-600"
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

      {/* Bulk Actions */}
      {selectedIds.size > 0 && (
        <div className="bg-gray-50 border border-gray-200 rounded-xl p-4 mb-6">
          <div className="flex items-center justify-between">
            <span className="text-gray-800 font-medium">
              {selectedIds.size} space{selectedIds.size > 1 ? 's' : ''} selected
            </span>
            <div className="flex space-x-2">
              <button
                onClick={() => handleBulkAction('publish')}
                className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors text-sm"
              >
                Publish
              </button>
              <button
                onClick={() => handleBulkAction('unpublish')}
                className="px-4 py-2 bg-yellow-600 text-white rounded-lg hover:bg-yellow-700 transition-colors text-sm"
              >
                Unpublish
              </button>
              <button
                onClick={() => handleBulkAction('delete')}
                className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors text-sm"
              >
                Delete
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Spaces Grid */}
      {currentPageItems.length === 0 ? (
        <div className="bg-white rounded-2xl shadow-lg border border-gray-100 p-12 text-center">
          {filteredListings.length === 0 ? (
            <div>
              <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4">
                <svg className="w-8 h-8 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
                </svg>
              </div>
              <h3 className="text-lg font-semibold text-gray-900 mb-2">No spaces available</h3>
              <p className="text-gray-600 mb-4">Get started by adding spaces to this property</p>
              <button 
                onClick={() => {
                  if (!selectedProperty || !selectedProperty.id) {
                    alert('Please select a property first');
                    return;
                  }
                  const currentUnitsForProperty = listings.filter(l => l.propertyId === selectedProperty.id);
                  const currentUnitCount = currentUnitsForProperty.length;
                  // Use maxUnits (the limit set when property was created) instead of totalUnits (actual count)
                  const maxUnits = selectedProperty.maxUnits || selectedProperty.totalUnits || 0;
                  
                  if (maxUnits > 0 && currentUnitCount >= maxUnits) {
                    alert(`Cannot add more units. This property is limited to ${maxUnits} unit${maxUnits !== 1 ? 's' : ''}. You currently have ${currentUnitCount} unit${currentUnitCount !== 1 ? 's' : ''}.`);
                    return;
                  }
                  setShowAddSpaceModal(true);
                }}
                className="bg-black text-white px-6 py-3 rounded-xl hover:bg-gray-800 transition-colors"
              >
                Add New Space
              </button>
            </div>
          ) : (
            <div>
              <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4">
                <svg className="w-8 h-8 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                </svg>
              </div>
              <h3 className="text-lg font-semibold text-gray-900 mb-2">No spaces match your filters</h3>
              <p className="text-gray-600">Try adjusting your search criteria</p>
            </div>
          )}
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {currentPageItems.map((listing) => (
            <div key={listing.id} className="bg-white rounded-2xl shadow-lg border border-gray-100 overflow-hidden hover:shadow-xl transition-all duration-300">
              {/* Unit Image */}
              <div className="relative h-60 bg-gray-200 flex items-center justify-center">
                <img
                  src={normalizeImageUrl(listing.images?.[0] ?? listing.image) || defaultUnit}
                  alt={listing.unitName}
                  className="w-full object-cover rounded-lg"
                  onError={(e) => { e.target.src = defaultUnit; }}
                />
                <div className="absolute top-3 left-3">
                  <input
                    type="checkbox"
                    checked={selectedIds.has(listing.id)}
                    onChange={(e) => {
                      const newSelected = new Set(selectedIds);
                      if (e.target.checked) {
                        newSelected.add(listing.id);
                      } else {
                        newSelected.delete(listing.id);
                      }
                      setSelectedIds(newSelected);
                    }}
                    className="w-5 h-5 text-black border-gray-300 rounded focus:ring-black"
                  />
                </div>
                <div className="absolute top-3 right-3">
                  <span className={`px-3 py-1 rounded-full text-xs font-semibold border ${statusToBadgeClass[listing.status]}`}>
                    {listing.status}
                  </span>
                </div>
              </div>

              {/* Unit Details */}
              <div className="p-6">
                <div className="flex items-start justify-between mb-3">
                  <div>
                    <h3 className="font-bold text-gray-900 text-lg mb-1">{listing.unitName}</h3>
                    <p className="text-gray-600 text-sm">{listing.propertyName}</p>
                  </div>
                  <div className="text-right">
                    <p className="text-2xl font-bold text-black">₱{listing.price.toLocaleString()}</p>
                    <p className="text-gray-500 text-sm">per month</p>
                  </div>
                </div>

                {/* Unit Stats */}
                <div className="grid grid-cols-3 gap-4 mb-4">
                  <div className="text-center">
                    <p className="text-sm text-gray-500">Bedrooms</p>
                    <p className="font-semibold text-gray-900">{listing.bedrooms}</p> 
                  </div>
                  <div className="text-center">
                    <p className="text-sm text-gray-500">Bathrooms</p>
                    <p className="font-semibold text-gray-900">
                      {listing.bathrooms === 'own' ? 'Own' : listing.bathrooms === 'share' ? 'Share' : listing.bathrooms}
                    </p>
                  </div>
                  <div className="text-center">
                    <p className="text-sm text-gray-500">Size</p>
                    <p className="font-semibold text-gray-900">{listing.sizeSqm} sqm</p>
                  </div>
                </div>

                {/* Inquiries and Last Updated */}
                <div className="flex items-center justify-between mb-4 text-sm text-gray-500">
                  <span>{listing.inquiriesCount} inquiries</span>
                  <span>{formatDate(listing.updatedAt)}</span>
                </div>

                {/* Action Buttons */}
                <div className="flex space-x-2">
                  <button
                    onClick={() => handleEdit(listing)}
                    className="flex-1 bg-black text-white py-2 px-4 rounded-lg hover:bg-gray-800 transition-colors text-sm font-medium"
                  >
                    Edit
                  </button>
                  <button className="flex-1 bg-gray-100 text-gray-700 py-2 px-4 rounded-lg hover:bg-gray-200 transition-colors text-sm font-medium" onClick={() => handlePreview(listing)}>
                    Preview
                  </button>
                  <button className="flex-1 bg-green-100 text-green-700 py-2 px-4 rounded-lg hover:bg-green-200 transition-colors text-sm font-medium" onClick={handleInquiries}>
                    Inquiries
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
              Previous
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
  );

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {selectedProperty ? renderSpacesView() : renderPropertiesView()}
      </div>

      {/* Manager Inquiries Modal */}
      {showManagerInquiries && (
        <ManagerInquiries 
          isOpen={showManagerInquiries} 
          onClose={() => {
            setShowManagerInquiries(false);
            // Refresh units when modal closes to update counts after tenant assignment
            if (selectedProperty) {
              fetchUnitsForProperty(selectedProperty);
            }
          }} 
        />
      )}

      {/* Add Space Modal */}
      {showAddSpaceModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl max-w-4xl w-full max-h-[90vh] overflow-hidden">
            <div className="flex items-center justify-between p-6 border-b border-gray-200">
              <h2 className="text-2xl font-bold text-gray-900">Add New Space</h2>
              <button
                onClick={() => setShowAddSpaceModal(false)}
                className="text-gray-400 hover:text-gray-600"
              >
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            <div className="overflow-y-auto max-h-[calc(90vh-140px)] p-6">
              <div className="space-y-6">
                {/* Basic Information */}
                <div>
                  <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center">
                    <span className="w-2 h-2 bg-black rounded-full mr-3"></span>
                    Basic Information
                  </h3>
                  <div className="space-y-4">
                    <div>
                      <label className="block text-sm font-semibold text-gray-700 mb-2">Unit Name *</label>
                      <input
                        type="text"
                        placeholder="e.g., Studio A-101, 1BR B-205"
                        value={newSpace.unitName}
                        onChange={(e) => handleInputChange('unitName', e.target.value)}
                        className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-black focus:border-transparent transition-all duration-200"
                      />
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label className="block text-sm font-semibold text-gray-700 mb-2">Bedrooms</label>
                        <select
                          value={newSpace.bedrooms}
                          onChange={(e) => handleInputChange('bedrooms', e.target.value)}
                          className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-black focus:border-transparent transition-all duration-200"
                        >
                          <option value={1}>1 Bedroom</option>
                          <option value={2}>2 Bedrooms</option>
                          <option value={3}>3+ Bedrooms</option>
                        </select>
                      </div>
                      <div>
                        <label className="block text-sm font-semibold text-gray-700 mb-2">Bathroom</label>
                        <select
                          value={newSpace.bathrooms}
                          onChange={(e) => handleInputChange('bathrooms', e.target.value)}
                          className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-black focus:border-transparent transition-all duration-200"
                        >
                          <option value="own">Own Bathroom</option>
                          <option value="share">Share Bathroom</option>
                        </select>
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label className="block text-sm font-semibold text-gray-700 mb-2">Size (sqm) *</label>
                        <input
                          type="number"
                          placeholder="e.g., 25"
                          value={newSpace.sizeSqm}
                          onChange={(e) => handleInputChange('sizeSqm', e.target.value)}
                          className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-black focus:border-transparent transition-all duration-200"
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-semibold text-gray-700 mb-2">Monthly Rent (₱) *</label>
                        <input
                          type="number"
                          placeholder="e.g., 5000"
                          value={newSpace.price}
                          onChange={(e) => handleInputChange('price', e.target.value)}
                          className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-black focus:border-transparent transition-all duration-200"
                        />
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label className="block text-sm font-semibold text-gray-700 mb-2">Security Deposit (₱)</label>
                        <input
                          type="number"
                          placeholder="e.g., 10000"
                          value={newSpace.securityDeposit}
                          onChange={(e) => handleInputChange('securityDeposit', e.target.value)}
                          className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-black focus:border-transparent transition-all duration-200"
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-semibold text-gray-700 mb-2">Status</label>
                        <select
                          value={newSpace.status}
                          onChange={(e) => handleInputChange('status', e.target.value)}
                          className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-black focus:border-transparent transition-all duration-200"
                        >
                          <option value="draft">Draft (Not Published)</option>
                          <option value="vacant">Vacant (Published)</option>
                          <option value="occupied">Occupied</option>
                          <option value="maintenance">Maintenance</option>
                        </select>
                        <p className="text-xs text-gray-500 mt-1">New units default to Draft. Use "Publish" bulk action to make them available for rent.</p>
                      </div>
                    </div>

                  </div>
                </div>

                {/* Description */}
                <div>
                  <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center">
                    <span className="w-2 h-2 bg-black rounded-full mr-3"></span>
                    Description
                  </h3>
                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-2">Space Description</label>
                    <textarea
                      placeholder="Brief description of the space, features, and highlights..."
                      value={newSpace.description}
                      onChange={(e) => handleInputChange('description', e.target.value)}
                      className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-black focus:border-transparent transition-all duration-200"
                      rows="4"
                    ></textarea>
                  </div>
                </div>

                {/* Additional Details */}
                <div>
                  <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center">
                    <span className="w-2 h-2 bg-black rounded-full mr-3"></span>
                    Additional Details
                  </h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-semibold text-gray-700 mb-2">Floor Number</label>
                      <input
                        type="text"
                        placeholder="e.g., 1, 2A, Ground Floor"
                        value={newSpace.floorNumber}
                        onChange={(e) => handleInputChange('floorNumber', e.target.value)}
                        className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-black focus:border-transparent transition-all duration-200"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-semibold text-gray-700 mb-2">Parking Spaces</label>
                      <input
                        type="number"
                        min="0"
                        placeholder="e.g., 1"
                        value={newSpace.parkingSpaces}
                        onChange={(e) => handleInputChange('parkingSpaces', e.target.value)}
                        className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-black focus:border-transparent transition-all duration-200"
                      />
                    </div>
                  </div>
                </div>

                {/* Amenities */}
                <div>
                  <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center">
                    <span className="w-2 h-2 bg-black rounded-full mr-3"></span>
                    Amenities
                  </h3>
                  <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                    <label className="flex items-center text-sm text-gray-700">
                      <input 
                        type="checkbox" 
                        checked={newSpace.amenities.balcony} 
                        onChange={() => handleAmenityToggle('balcony')} 
                        className="mr-3 h-4 w-4 text-black focus:ring-black rounded" 
                      />
                      Balcony
                    </label>
                    <label className="flex items-center text-sm text-gray-700">
                      <input 
                        type="checkbox" 
                        checked={newSpace.amenities.furnished} 
                        onChange={() => handleAmenityToggle('furnished')} 
                        className="mr-3 h-4 w-4 text-black focus:ring-black rounded" 
                      />
                      Furnished
                    </label>
                    <label className="flex items-center text-sm text-gray-700">
                      <input 
                        type="checkbox" 
                        checked={newSpace.amenities.airConditioning} 
                        onChange={() => handleAmenityToggle('airConditioning')} 
                        className="mr-3 h-4 w-4 text-black focus:ring-black rounded" 
                      />
                      Air Conditioning
                    </label>
                    <label className="flex items-center text-sm text-gray-700">
                      <input 
                        type="checkbox" 
                        checked={newSpace.amenities.wifi} 
                        onChange={() => handleAmenityToggle('wifi')} 
                        className="mr-3 h-4 w-4 text-black focus:ring-black rounded" 
                      />
                      WiFi
                    </label>
                    <label className="flex items-center text-sm text-gray-700">
                      <input 
                        type="checkbox" 
                        checked={newSpace.amenities.security} 
                        onChange={() => handleAmenityToggle('security')} 
                        className="mr-3 h-4 w-4 text-black focus:ring-black rounded" 
                      />
                      Security
                    </label>
                  </div>
                </div>

                {/* Images */}
                <div>
                  <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center">
                    <span className="w-2 h-2 bg-black rounded-full mr-3"></span>
                    Unit Images
                  </h3>
                  <div className="space-y-4">
                    <div className="border-2 border-dashed border-gray-300 rounded-xl p-6 text-center hover:border-gray-400 transition-colors">
                      <div className="flex flex-col items-center">
                        <svg className="w-12 h-12 text-gray-400 mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 002 2v12a2 2 0 002 2z" />
                        </svg>
                        <p className="text-gray-600 mb-2">Upload unit images</p>
                        <p className="text-sm text-gray-500">Drag and drop images here, or click to browse</p>
                        <input
                          type="file"
                          multiple
                          accept="image/*"
                          onChange={(e) => handleImageUpload(e)}
                          className="hidden"
                          id="unit-image-upload"
                        />
                        <label
                          htmlFor="unit-image-upload"
                          className="mt-3 inline-flex items-center px-4 py-2 bg-black text-white rounded-lg hover:bg-gray-800 transition-colors cursor-pointer"
                        >
                          <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                          </svg>
                          Choose Images
                        </label>
                      </div>
                    </div>
                    
                    {/* Image Preview */}
                    {newSpace.images && newSpace.images.length > 0 && (
                      <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                        {newSpace.images.map((image, index) => (
                          <div key={index} className="relative group">
                            <img
                              src={image}
                              alt={`Unit image ${index + 1}`}
                              className="w-full h-32 object-cover rounded-lg"
                            />
                            <button
                              onClick={() => removeImage(index)}
                              className="absolute top-2 right-2 bg-red-500 text-white rounded-full w-6 h-6 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
                            >
                              ×
                            </button>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </div>

            <div className="flex space-x-3 p-2 border-t border-gray-200 bg-gray-50">
              <button
                onClick={() => setShowAddSpaceModal(false)}
                className="flex-1 px-6 py-2 border border-gray-300 text-gray-700 rounded-xl hover:bg-gray-50 transition-colors font-medium"
              >
                Cancel
              </button>
              <button
                onClick={handleAddSpace}
                className="flex-1 px-6 py-2 bg-black text-white rounded-xl hover:bg-gray-800 transition-colors font-medium"
              >
                Add Space
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Preview Modal - Enhanced Unit Details */}
      {showPreviewModal && previewListing && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl w-full max-w-6xl max-h-[95vh] overflow-hidden shadow-2xl">
            {/* Header */}
            <div className="sticky top-0 bg-white border-b border-gray-200 px-8 py-6 rounded-t-2xl z-10">
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="text-3xl font-bold text-gray-900">{previewListing.unitName}</h2>
                  <p className="text-gray-600 mt-1">{previewListing.propertyName} • Unit Details</p>
                </div>
                <button
                  onClick={() => { setShowPreviewModal(false); setPreviewListing(null); }} 
                  className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg transition-colors"
                >
                  <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
            </div>

            {/* Scrollable Content */}
            <div className="overflow-y-auto max-h-[calc(95vh-200px)] p-8">
              {/* Hero Section with Image Gallery */}
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 mb-8">
                {/* Image Gallery */}
                <div className="space-y-4">
                  <div className="relative w-full h-80 flex items-center justify-center bg-gray-50 rounded-2xl overflow-hidden">
                {(() => {
                  const imgs = Array.isArray(previewListing.images) ? previewListing.images.filter(Boolean) : [];
                  const total = imgs.length;
                  const currentSrc = normalizeImageUrl(total > 0 ? imgs[Math.min(previewImageIndex, total - 1)] : previewListing.image) || defaultUnit;
                  const canNavigate = total > 1;
                  const prev = () => setPreviewImageIndex((i) => (i === 0 ? total - 1 : i - 1));
                  const next = () => setPreviewImageIndex((i) => (i === total - 1 ? 0 : i + 1));
                  return (
                        <>
                      <img
                        src={currentSrc}
                        alt={previewListing.unitName}
                            className="w-full h-full object-cover rounded-xl border border-gray-200 shadow-lg"
                        onError={(e) => { e.target.src = defaultUnit; }}
                      />
                          {total > 1 && (
                            <>
                              <div className="absolute top-4 right-4 bg-black bg-opacity-70 text-white text-xs px-3 py-1 rounded-full">
                                {Math.min(previewImageIndex, Math.max(0, total - 1)) + 1} / {total}
                      </div>
                              <button 
                                onClick={prev} 
                                className="absolute left-4 top-1/2 -translate-y-1/2 bg-black/60 text-white p-2 rounded-full hover:bg-black/80 transition-colors"
                              >
                                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                                </svg>
                          </button>
                              <button 
                                onClick={next} 
                                className="absolute right-4 top-1/2 -translate-y-1/2 bg-black/60 text-white p-2 rounded-full hover:bg-black/80 transition-colors"
                              >
                                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                                </svg>
                          </button>
                              <div className="absolute bottom-4 left-1/2 -translate-x-1/2 flex space-x-2">
                            {imgs.map((_, idx) => (
                                  <button 
                                    key={idx} 
                                    onClick={() => setPreviewImageIndex(idx)} 
                                    className={`w-2 h-2 rounded-full transition-all ${
                                      idx === previewImageIndex ? 'bg-white scale-125 w-6' : 'bg-white/60 hover:bg-white/80'
                                    }`} 
                                  />
                            ))}
                          </div>
                        </>
                      )}
                        </>
                      );
                    })()}
                  </div>
                  {/* Thumbnail Gallery */}
                  {(() => {
                    const imgs = Array.isArray(previewListing.images) ? previewListing.images.filter(Boolean) : [];
                    if (imgs.length > 1) {
                      return (
                        <div className="grid grid-cols-4 gap-2">
                          {imgs.slice(0, 4).map((img, idx) => (
                            <button
                              key={idx}
                              onClick={() => setPreviewImageIndex(idx)}
                              className={`relative h-20 rounded-lg overflow-hidden border-2 transition-all ${
                                idx === previewImageIndex ? 'border-blue-500' : 'border-gray-200'
                              }`}
                            >
                              <img 
                                src={normalizeImageUrl(img) || defaultUnit} 
                                alt={`${previewListing.unitName} ${idx + 1}`}
                                className="w-full h-full object-cover"
                                onError={(e) => { e.target.src = defaultUnit; }}
                              />
                            </button>
                          ))}
                          {imgs.length > 4 && (
                            <div className="relative h-20 rounded-lg overflow-hidden border-2 border-gray-200 bg-gray-100 flex items-center justify-center">
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
                  {/* Price and Status */}
                  <div className="bg-gradient-to-br from-blue-50 to-indigo-50 rounded-2xl p-6">
                    <div className="flex items-center justify-between mb-4">
                      <div>
                        <p className="text-sm text-gray-600 mb-1">Monthly Rent</p>
                        <p className="text-3xl font-bold text-gray-900">₱{previewListing.price?.toLocaleString() || '0'}</p>
                    </div>
                      <span className={`px-4 py-2 rounded-full text-sm font-semibold border ${statusToBadgeClass[previewListing.status] || statusToBadgeClass['Vacant']}`}>
                        {previewListing.status || 'Vacant'}
                      </span>
                  </div>
                    {previewListing.securityDeposit > 0 && (
                      <div className="pt-4 border-t border-gray-200">
                        <div className="flex justify-between items-center">
                          <span className="text-sm text-gray-600">Security Deposit</span>
                          <span className="text-lg font-semibold text-gray-900">₱{previewListing.securityDeposit.toLocaleString()}</span>
                  </div>
                </div>
                    )}
              </div>

                  {/* Unit Stats Grid */}
                  <div className="grid grid-cols-2 gap-4">
                    <div className="bg-white border border-gray-200 rounded-xl p-4 text-center">
                      <div className="text-2xl font-bold text-gray-900">{previewListing.bedrooms || 0}</div>
                      <div className="text-xs text-gray-500 mt-1">Bedrooms</div>
                  </div>
                    <div className="bg-white border border-gray-200 rounded-xl p-4 text-center">
                      <div className="text-2xl font-bold text-gray-900">
                        {previewListing.bathrooms === 'own' ? 'Own' : previewListing.bathrooms === 'share' ? 'Share' : previewListing.bathrooms || 'N/A'}
                    </div>
                      <div className="text-xs text-gray-500 mt-1">Bathroom</div>
                  </div>
                    <div className="bg-white border border-gray-200 rounded-xl p-4 text-center">
                      <div className="text-2xl font-bold text-gray-900">{previewListing.sizeSqm || 0}</div>
                      <div className="text-xs text-gray-500 mt-1">Square Meters</div>
                  </div>
                    <div className="bg-white border border-gray-200 rounded-xl p-4 text-center">
                      <div className="text-2xl font-bold text-gray-900">{previewListing.parkingSpaces || 0}</div>
                      <div className="text-xs text-gray-500 mt-1">Parking Spaces</div>
                </div>
              </div>

                  {/* Additional Info */}
                  <div className="bg-gray-50 rounded-xl p-6">
                    <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center">
                      <svg className="w-5 h-5 mr-2 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                      </svg>
                      Additional Information
                </h3>
                    <div className="space-y-3">
                      <div className="flex justify-between items-center">
                        <span className="text-sm text-gray-600">Floor Number</span>
                        <span className="font-semibold text-gray-900">{previewListing.floorNumber || 'Not specified'}</span>
                    </div>
                      <div className="flex justify-between items-center">
                        <span className="text-sm text-gray-600">Inquiries</span>
                        <span className="font-semibold text-gray-900">{previewListing.inquiriesCount || 0}</span>
                    </div>
                      <div className="flex justify-between items-center">
                        <span className="text-sm text-gray-600">Last Updated</span>
                        <span className="font-semibold text-gray-900">{formatDate(previewListing.updatedAt)}</span>
                    </div>
                    </div>
                  </div>
                </div>
              </div>

              {/* Detailed Information Grid */}
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                {/* Description */}
                <div className="bg-gradient-to-br from-gray-50 to-white rounded-2xl p-6 border border-gray-200">
                  <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center">
                    <svg className="w-5 h-5 mr-2 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                    </svg>
                    Description
                  </h3>
                  <div className="bg-white rounded-xl p-4 border border-gray-200">
                    <p className="text-gray-700 leading-relaxed whitespace-pre-wrap">
                      {previewListing.description || `A comfortable ${previewListing.bedrooms || 0}-bedroom unit with ${previewListing.bathrooms === 'own' ? 'own' : previewListing.bathrooms === 'share' ? 'shared' : previewListing.bathrooms || 'N/A'} bathroom spanning ${previewListing.sizeSqm || 0} square meters. This well-designed space offers modern living with ${previewListing.parkingSpaces || 0} parking space${previewListing.parkingSpaces !== 1 ? 's' : ''} and is located on ${previewListing.floorNumber ? `floor ${previewListing.floorNumber}` : 'an unspecified floor'}. Perfect for ${previewListing.bedrooms === 1 ? 'individuals or couples' : 'families or roommates'} seeking quality accommodation.`}
                    </p>
                </div>
              </div>

              {/* Amenities */}
                <div className="bg-gradient-to-br from-indigo-50 to-purple-50 rounded-2xl p-6 border border-gray-200">
                  <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center">
                    <svg className="w-5 h-5 mr-2 text-indigo-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 3v4M3 5h4M6 17v4m-2-2h4m5-16l2.286 6.857L21 12l-5.714 2.143L13 21l-2.286-6.857L5 12l5.714-2.143L13 3z" />
                    </svg>
                  Amenities
                    {previewListing.amenities && Object.keys(previewListing.amenities).length > 0 && (
                      <span className="ml-2 px-2 py-1 bg-indigo-100 text-indigo-800 rounded-full text-xs font-medium">
                        {Object.entries(previewListing.amenities).filter(([_, available]) => available).length}
                      </span>
                    )}
                </h3>
                  <div className="bg-white rounded-xl p-4 border border-gray-200">
                  {previewListing.amenities && Object.keys(previewListing.amenities).length > 0 ? (
                    (() => {
                      const selectedAmenities = Object.entries(previewListing.amenities).filter(([_, available]) => available);
                      return selectedAmenities.length > 0 ? (
                          <div className="grid grid-cols-2 gap-3">
                          {selectedAmenities.map(([amenity, _]) => (
                            <div key={amenity} className="flex items-center space-x-2 p-2 rounded-lg bg-green-50 border border-green-200">
                                <svg className="w-4 h-4 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                                </svg>
                              <span className="text-sm font-medium text-green-800">
                                {amenity === 'airConditioning' ? 'Air Conditioning' : 
                                   amenity === 'wifi' ? 'WiFi' :
                                 amenity.charAt(0).toUpperCase() + amenity.slice(1)}
                              </span>
                            </div>
                          ))}
                        </div>
                      ) : (
                        <div className="text-center text-sm text-gray-500 py-4">
                          No amenities selected
                        </div>
                      );
                    })()
                  ) : (
                    <div className="text-center text-sm text-gray-500 py-4">
                      No amenities specified
                    </div>
                  )}
                </div>
                </div>
              </div>

              {/* Property Information */}
              <div className="mt-8 bg-gradient-to-br from-blue-50 to-cyan-50 rounded-2xl p-6 border border-gray-200">
                <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center">
                  <svg className="w-5 h-5 mr-2 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
                  </svg>
                  Property Information
                </h3>
                <div className="bg-white rounded-xl p-6 border border-gray-200">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div className="flex items-center space-x-4">
                      <div className="w-12 h-12 bg-blue-100 rounded-full flex items-center justify-center">
                        <svg className="w-6 h-6 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
                          </svg>
                        </div>
                      <div>
                        <span className="text-xs text-gray-500">Property Name</span>
                        <p className="text-sm font-semibold text-gray-900">{previewListing.propertyName || '—'}</p>
                      </div>
                    </div>
                    <div className="flex items-center space-x-4">
                      <div className="w-12 h-12 bg-green-100 rounded-full flex items-center justify-center">
                        <svg className="w-6 h-6 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                          </svg>
                        </div>
                        <div>
                          <span className="text-xs text-gray-500">Property Manager</span>
                        <p className="text-sm font-semibold text-gray-900">{previewListing.propertyManager || '—'}</p>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
            </div>

            {/* Sticky Footer Actions */}
            <div className="sticky bottom-0 bg-white border-t border-gray-200 px-8 py-4 rounded-b-2xl">
              <div className="flex flex-col sm:flex-row gap-4">
                <button
                  onClick={() => {
                    setShowPreviewModal(false);
                    handleEdit(previewListing);
                  }}
                  className="flex-1 bg-black text-white py-3 px-6 rounded-xl hover:bg-gray-800 transition-colors font-medium flex items-center justify-center"
                >
                  <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                  </svg>
                  Edit Unit
                </button>
                <button
                  onClick={() => setShowPreviewModal(false)}
                  className="flex-1 border border-gray-300 text-gray-700 py-3 px-6 rounded-xl hover:bg-gray-50 transition-colors font-medium"
                >
                  Close
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Edit Modal */}
      {showEditModal && editingListing && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl max-w-4xl w-full max-h-[90vh] overflow-hidden">
            <div className="flex items-center justify-between p-6 border-b border-gray-200">
              <h2 className="text-2xl font-bold text-gray-900">Edit Space</h2>
              <button
                onClick={() => setShowEditModal(false)}
                className="text-gray-400 hover:text-gray-600"
              >
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            <div className="overflow-y-auto max-h-[calc(90vh-140px)] p-6">
              <div className="space-y-6">
                {/* Basic Information */}
                <div>
                  <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center">
                    <span className="w-2 h-2 bg-black rounded-full mr-3"></span>
                    Basic Information
                  </h3>
                  <div className="space-y-4">
                    <div>
                      <label className="block text-sm font-semibold text-gray-700 mb-2">Unit Name *</label>
                      <input
                        type="text"
                        placeholder="e.g., Studio A-101, 1BR B-205"
                        value={editingListing.unitName}
                        onChange={(e) => setEditingListing({...editingListing, unitName: e.target.value})}
                        className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-black focus:border-transparent transition-all duration-200"
                      />
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label className="block text-sm font-semibold text-gray-700 mb-2">Bedrooms</label>
                        <select
                          value={editingListing.bedrooms}
                          onChange={(e) => setEditingListing({...editingListing, bedrooms: parseInt(e.target.value)})}
                          className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-black focus:border-transparent transition-all duration-200"
                        >
                          <option value={1}>1 Bedroom</option>
                          <option value={2}>2 Bedrooms</option>
                          <option value={3}>3+ Bedrooms</option>
                        </select>
                      </div>
                      <div>
                        <label className="block text-sm font-semibold text-gray-700 mb-2">Bathroom</label>
                        <select
                          value={editingListing.bathrooms}
                          onChange={(e) => setEditingListing({...editingListing, bathrooms: e.target.value})}
                          className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-black focus:border-transparent transition-all duration-200"
                        >
                          <option value="own">Own Bathroom</option>
                          <option value="share">Share Bathroom</option>
                        </select>
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label className="block text-sm font-semibold text-gray-700 mb-2">Size (sqm) *</label>
                        <input
                          type="number"
                          placeholder="e.g., 25"
                          value={editingListing.sizeSqm}
                          onChange={(e) => setEditingListing({...editingListing, sizeSqm: parseInt(e.target.value)})}
                          className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-black focus:border-transparent transition-all duration-200"
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-semibold text-gray-700 mb-2">Monthly Rent (₱) *</label>
                        <input
                          type="number"
                          placeholder="e.g., 5000"
                          value={editingListing.price}
                          onChange={(e) => setEditingListing({...editingListing, price: parseInt(e.target.value)})}
                          className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-black focus:border-transparent transition-all duration-200"
                        />
                      </div>
                    </div>

                    <div>
                      <label className="block text-sm font-semibold text-gray-700 mb-2">Security Deposit (₱)</label>
                      <input
                        type="number"
                        placeholder="e.g., 10000"
                        value={editingListing.securityDeposit || ''}
                        onChange={(e) => setEditingListing({...editingListing, securityDeposit: parseInt(e.target.value) || 0})}
                        className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-black focus:border-transparent transition-all duration-200"
                      />
                    </div>

                    <div>
                      <label className="block text-sm font-semibold text-gray-700 mb-2">Status</label>
                      <select
                        value={editingListing.status}
                        onChange={(e) => setEditingListing({...editingListing, status: e.target.value})}
                        className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-black focus:border-transparent transition-all duration-200"
                      >
                        <option value="Draft">Draft</option>
                        <option value="Vacant">Vacant</option>
                        <option value="Occupied">Occupied</option>
                      </select>
                    </div>
                  </div>
                </div>

                {/* Description */}
                <div>
                  <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center">
                    <span className="w-2 h-2 bg-black rounded-full mr-3"></span>
                    Description
                  </h3>
                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-2">Space Description</label>
                    <textarea
                      placeholder="Brief description of the space, features, and highlights..."
                      value={editingListing.description || ''}
                      onChange={(e) => setEditingListing({...editingListing, description: e.target.value})}
                      className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-black focus:border-transparent transition-all duration-200"
                      rows="4"
                    ></textarea>
                  </div>
                </div>

                {/* Additional Details */}
                <div>
                  <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center">
                    <span className="w-2 h-2 bg-black rounded-full mr-3"></span>
                    Additional Details
                  </h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-semibold text-gray-700 mb-2">Floor Number</label>
                      <input
                        type="number"
                        placeholder="e.g., 1"
                        value={editingListing.floorNumber || ''}
                        onChange={(e) => setEditingListing({...editingListing, floorNumber: e.target.value})}
                        className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-black focus:border-transparent transition-all duration-200"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-semibold text-gray-700 mb-2">Parking Spaces</label>
                      <input
                        type="number"
                        placeholder="e.g., 1"
                        value={editingListing.parkingSpaces || 0}
                        onChange={(e) => setEditingListing({...editingListing, parkingSpaces: parseInt(e.target.value)})}
                        className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-black focus:border-transparent transition-all duration-200"
                      />
                    </div>
                  </div>
                </div>

                {/* Amenities */}
                <div>
                  <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center">
                    <span className="w-2 h-2 bg-black rounded-full mr-3"></span>
                    Amenities
                  </h3>
                  <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                    <label className="flex items-center text-sm text-gray-700">
                      <input 
                        type="checkbox" 
                        checked={editingListing.amenities?.balcony || false} 
                        onChange={(e) => setEditingListing({
                          ...editingListing, 
                          amenities: {
                            ...editingListing.amenities,
                            balcony: e.target.checked
                          }
                        })} 
                        className="mr-3 h-4 w-4 text-black focus:ring-black rounded" 
                      />
                      Balcony
                    </label>
                    <label className="flex items-center text-sm text-gray-700">
                      <input 
                        type="checkbox" 
                        checked={editingListing.amenities?.furnished || false} 
                        onChange={(e) => setEditingListing({
                          ...editingListing, 
                          amenities: {
                            ...editingListing.amenities,
                            furnished: e.target.checked
                          }
                        })} 
                        className="mr-3 h-4 w-4 text-black focus:ring-black rounded" 
                      />
                      Furnished
                    </label>
                    <label className="flex items-center text-sm text-gray-700">
                      <input 
                        type="checkbox" 
                        checked={editingListing.amenities?.airConditioning || false} 
                        onChange={(e) => setEditingListing({
                          ...editingListing, 
                          amenities: {
                            ...editingListing.amenities,
                            airConditioning: e.target.checked
                          }
                        })} 
                        className="mr-3 h-4 w-4 text-black focus:ring-black rounded" 
                      />
                      Air Conditioning
                    </label>
                    <label className="flex items-center text-sm text-gray-700">
                      <input 
                        type="checkbox" 
                        checked={editingListing.amenities?.wifi || false} 
                        onChange={(e) => setEditingListing({
                          ...editingListing, 
                          amenities: {
                            ...editingListing.amenities,
                            wifi: e.target.checked
                          }
                        })}   
                        className="mr-3 h-4 w-4 text-black focus:ring-black rounded" 
                      />
                      WiFi
                    </label>
                    <label className="flex items-center text-sm text-gray-700">
                      <input 
                        type="checkbox" 
                        checked={editingListing.amenities?.security || false} 
                        onChange={(e) => setEditingListing({
                          ...editingListing, 
                          amenities: {
                            ...editingListing.amenities,
                            security: e.target.checked
                          }
                        })} 
                        className="mr-3 h-4 w-4 text-black focus:ring-black rounded" 
                      />
                      Security
                    </label>
                  </div>
                </div>

                {/* Images */}
                <div>
                  <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center">
                    <span className="w-2 h-2 bg-black rounded-full mr-3"></span>
                    Unit Images
                  </h3>
                  <div className="space-y-4">
                    <div className="border-2 border-dashed border-gray-300 rounded-xl p-6 text-center hover:border-gray-400 transition-colors">
                      <div className="flex flex-col items-center">
                        <svg className="w-12 h-12 text-gray-400 mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 002 2v12a2 2 0 002 2z" />
                        </svg>
                        <p className="text-gray-600 mb-2">Upload unit images</p>
                        <p className="text-sm text-gray-500">Drag and drop images here, or click to browse</p>
                        <input
                          type="file"
                          multiple
                          accept="image/*"
                          onChange={(e) => handleEditImageUpload(e)}
                          className="hidden"
                          id="edit-unit-image-upload"
                        />
                        <label
                          htmlFor="edit-unit-image-upload"
                          className="mt-3 inline-flex items-center px-4 py-2 bg-black text-white rounded-lg hover:bg-gray-800 transition-colors cursor-pointer"
                        >
                          <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                          </svg>
                          Choose Images
                        </label>
                      </div>
                    </div>
                    
                    {/* Image Preview */}
                    {editingListing.images && editingListing.images.length > 0 && (
                      <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                        {editingListing.images.map((image, index) => (
                          <div key={index} className="relative group">
                            <img
                              src={image}
                              alt={`Unit image ${index + 1}`}
                              className="w-full h-32 object-cover rounded-lg"
                            />
                            <button
                              onClick={() => removeEditImage(index)}
                              className="absolute top-2 right-2 bg-red-500 text-white rounded-full w-6 h-6 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
                            >
                              ×
                            </button>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </div>

            <div className="flex space-x-6 p-2 border-t border-gray-200 bg-gray-50">
              <button
                onClick={() => setShowEditModal(false)}
                className="flex-1 px-4 py-2 border border-gray-300 text-gray-700 rounded-xl hover:bg-gray-50 transition-colors font-medium"
              >
                Cancel
              </button>
              <button
                onClick={() => handleSaveEdit(editingListing)}
                className="flex-1 px-4 py-2 bg-black text-white rounded-xl hover:bg-gray-800 transition-colors font-medium"
              >
                Save Changes
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default ManagerRentSpace;



