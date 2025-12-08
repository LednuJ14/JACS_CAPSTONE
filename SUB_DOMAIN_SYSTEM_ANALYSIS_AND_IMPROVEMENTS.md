# Sub-Domain System Analysis & Improvement Report

## Executive Summary

This report provides a comprehensive analysis of the sub-domain system, identifying critical security issues, missing property isolation mechanisms, and recommendations for improvements. The sub-domain system is designed to provide each property with a unique, isolated management portal, ensuring data separation and security.

---

## 🔴 CRITICAL SECURITY ISSUES

### 1. **Announcement Routes - Missing Property Filtering for Managers**
**File:** `sub-domain/backend/routes/announcement_routes.py`
**Issue:** Property managers can see ALL announcements across all properties, not just their current property subdomain.
**Location:** Line 146 - Comment says "Staff and property managers can see all announcements" with no property_id filtering.

**Fix Required:**
```python
# Add property_id filtering for property managers
elif user_role_str in ['MANAGER', 'PROPERTY_MANAGER']:
    # Get property_id from request
    from routes.auth_routes import get_property_id_from_request
    property_id = get_property_id_from_request()
    
    if not property_id:
        return jsonify({
            'error': 'Property context is required. Please access through a property subdomain.',
            'code': 'PROPERTY_CONTEXT_REQUIRED'
        }), 400
    
    # CRITICAL: Verify property exists and user owns it
    from models.property import Property
    property_obj = Property.query.get(property_id)
    if not property_obj:
        return jsonify({'error': 'Property not found'}), 404
    
    if property_obj.owner_id != current_user.id:
        return jsonify({
            'error': 'Access denied. You do not own this property.',
            'code': 'PROPERTY_ACCESS_DENIED'
        }), 403
    
    # Filter announcements by property_id
    query = query.filter(
        or_(
            Announcement.property_id == property_id,
            Announcement.property_id.is_(None)  # Global announcements
        )
    )
```

### 2. **Document Routes - Missing Property Filtering for Managers**
**File:** `sub-domain/backend/routes/document_routes.py`
**Issue:** Line 103 comment says "Property managers can see all documents (no filter)" - this is a security vulnerability.
**Location:** Lines 100-103

**Fix Required:**
```python
elif user_role_str in ['MANAGER', 'PROPERTY_MANAGER']:
    # Get property_id from request
    from routes.auth_routes import get_property_id_from_request
    property_id = get_property_id_from_request()
    
    if not property_id:
        return jsonify({
            'error': 'Property context is required. Please access through a property subdomain.',
            'code': 'PROPERTY_CONTEXT_REQUIRED'
        }), 400
    
    # CRITICAL: Verify property exists and user owns it
    from models.property import Property
    property_obj = Property.query.get(property_id)
    if not property_obj:
        return jsonify({'error': 'Property not found'}), 404
    
    if property_obj.owner_id != current_user.id:
        return jsonify({
            'error': 'Access denied. You do not own this property.',
            'code': 'PROPERTY_ACCESS_DENIED'
        }), 403
    
    # Filter documents by property_id
    if property_id_filter:
        query = query.filter(Document.property_id == property_id_filter)
    else:
        query = query.filter(Document.property_id == property_id)
```

### 3. **Feedback Routes - Missing Ownership Validation**
**File:** `sub-domain/backend/routes/feedback_routes.py`
**Issue:** Property managers can see feedback from ALL properties if property_id is not provided. No ownership validation.
**Location:** Lines 119-131

**Fix Required:**
```python
# Filter by property if property_id is provided
if property_id:
    query = query.filter(Feedback.property_id == property_id)
    
    # CRITICAL: For property managers, verify ownership
    if user_role in ['MANAGER', 'PROPERTY_MANAGER']:
        property_obj = Property.query.get(property_id)
        if not property_obj:
            return jsonify({'error': 'Property not found'}), 404
        if property_obj.owner_id != current_user.id:
            return jsonify({
                'error': 'Access denied. You do not own this property.',
                'code': 'PROPERTY_ACCESS_DENIED'
            }), 403
elif user_role in ['MANAGER', 'PROPERTY_MANAGER']:
    # Property managers MUST provide property_id
    return jsonify({
        'error': 'Property context is required. Please access through a property subdomain.',
        'code': 'PROPERTY_CONTEXT_REQUIRED'
    }), 400
```

### 4. **Notification Routes - Missing Property Context**
**File:** `sub-domain/backend/routes/notification_routes.py`
**Issue:** Notifications for property managers are not filtered by property_id. A manager with multiple properties could see notifications from all properties.
**Location:** Lines 74-79

**Fix Required:**
```python
elif user_role_str in ['MANAGER', 'PROPERTY_MANAGER']:
    # Get property_id from request
    from routes.auth_routes import get_property_id_from_request
    property_id = get_property_id_from_request()
    
    if not property_id:
        # Try JWT claims
        from flask_jwt_extended import get_jwt
        try:
            claims = get_jwt()
            property_id = claims.get('property_id')
        except Exception:
            pass
    
    # Property managers should have property context
    query = Notification.query.filter_by(
        user_id=current_user.id,
        recipient_type='property_manager'
    )
    
    # If property_id available, filter by it (if notifications table has property_id)
    # Note: Check if Notification model has property_id field
    # If not, this may need to be added to the model
```

### 5. **Property Routes - Returns All Properties**
**File:** `sub-domain/backend/routes/property_routes.py`
**Issue:** The `/properties/` endpoint returns ALL properties owned by the user, not just the current subdomain property. This could leak information about other properties.
**Location:** Lines 17-69

**Fix Required:**
```python
@property_bp.route('/', methods=['GET'])
@jwt_required()
def get_properties():
    """Get the current property for the subdomain context."""
    try:
        current_user_id = get_jwt_identity()
        
        # Convert string to int if needed
        if isinstance(current_user_id, str):
            try:
                current_user_id = int(current_user_id)
            except ValueError:
                return jsonify({'error': 'Invalid user ID'}), 400
        
        user = User.query.get(current_user_id)
        
        if not user:
            return jsonify({'error': 'User not found'}), 404
        
        # CRITICAL: Get property_id from subdomain context
        from routes.auth_routes import get_property_id_from_request
        property_id = get_property_id_from_request()
        
        if not property_id:
            # Try JWT claims
            from flask_jwt_extended import get_jwt
            try:
                claims = get_jwt()
                property_id = claims.get('property_id')
            except Exception:
                pass
        
        if property_id:
            # Return only the current property
            property_obj = Property.query.get(property_id)
            if not property_obj:
                return jsonify({'error': 'Property not found'}), 404
            
            # Verify ownership
            if property_obj.owner_id != user.id:
                return jsonify({
                    'error': 'Access denied. You do not own this property.',
                    'code': 'PROPERTY_ACCESS_DENIED'
                }), 403
            
            try:
                prop_dict = property_obj.to_dict()
                return jsonify([prop_dict]), 200
            except Exception as prop_error:
                current_app.logger.warning(f"Error converting property {property_obj.id} to dict: {str(prop_error)}")
                return jsonify([{
                    'id': property_obj.id,
                    'name': getattr(property_obj, 'name', 'Unknown'),
                    'address': getattr(property_obj, 'address', ''),
                    'city': getattr(property_obj, 'city', ''),
                    'display_settings': getattr(property_obj, 'display_settings', None) or {}
                }]), 200
        else:
            # No property context - return empty array
            return jsonify([]), 200
```

### 6. **User Routes - No Property Context**
**File:** `sub-domain/backend/routes/user_routes.py`
**Issue:** The `/users/` endpoint returns ALL users, not filtered by property. This could leak user information from other properties.
**Location:** Lines 17-61

**Fix Required:**
```python
@user_bp.route('/', methods=['GET'])
@jwt_required()
def get_users():
    """Get list of users for the current property (property manager only)."""
    try:
        claims = get_jwt()
        if claims.get('role') != 'property_manager':
            return jsonify({'error': 'Insufficient permissions'}), 403
        
        # CRITICAL: Get property_id from subdomain context
        from routes.auth_routes import get_property_id_from_request
        property_id = get_property_id_from_request()
        
        if not property_id:
            from flask_jwt_extended import get_jwt
            try:
                property_id = claims.get('property_id')
            except Exception:
                pass
        
        if not property_id:
            return jsonify({
                'error': 'Property context is required. Please access through a property subdomain.',
                'code': 'PROPERTY_CONTEXT_REQUIRED'
            }), 400
        
        # Verify ownership
        from models.property import Property
        property_obj = Property.query.get(property_id)
        if not property_obj:
            return jsonify({'error': 'Property not found'}), 404
        
        current_user_id = get_jwt_identity()
        if property_obj.owner_id != int(current_user_id):
            return jsonify({
                'error': 'Access denied. You do not own this property.',
                'code': 'PROPERTY_ACCESS_DENIED'
            }), 403
        
        # Filter users by property
        # Get tenants for this property
        from models.tenant import Tenant
        tenant_ids = [t.user_id for t in Tenant.query.filter_by(property_id=property_id).all()]
        
        # Get staff for this property
        from models.staff import Staff
        staff_ids = [s.user_id for s in Staff.query.filter_by(property_id=property_id).all()]
        
        # Combine user IDs
        user_ids = list(set(tenant_ids + staff_ids + [current_user_id]))
        
        # Base query - filter by property-related users
        query = User.query.filter(User.id.in_(user_ids))
        
        # Apply role filter
        role_filter = request.args.get('role')
        if role_filter:
            try:
                role_enum = UserRole.from_string(role_filter)
                query = query.filter(User.role == role_enum.value)
            except (ValueError, KeyError, AttributeError) as e:
                current_app.logger.error(f"Invalid role filter '{role_filter}': {str(e)}")
                return jsonify({'error': f'Invalid role: {role_filter}'}), 400
        
        users = query.all()
        
        # Serialize users with error handling
        users_list = []
        for user in users:
            try:
                users_list.append(user.to_dict())
            except Exception as user_error:
                current_app.logger.warning(f"Error serializing user {user.id}: {str(user_error)}")
                continue
        
        return jsonify({
            'users': users_list
        }), 200
```

---

## 🟡 MEDIUM PRIORITY ISSUES

### 7. **Frontend API Service - Missing Property Context in Some Calls**
**File:** `sub-domain/frontend/src/services/api.js`
**Issue:** Some API methods don't automatically include property_id from subdomain context.

**Recommendations:**
- Add automatic property_id injection in `makeRequest()` method
- Ensure all API calls include `X-Property-ID` header when property context is available
- Add helper method to automatically append property_id to query params

**Fix:**
```javascript
async makeRequest(url, options = {}) {
  // ... existing code ...
  
  // Automatically add property context if available
  const propertyId = this.getPropertyIdFromSubdomain();
  if (propertyId && !options.headers?.['X-Property-ID']) {
    if (!config.headers) config.headers = {};
    config.headers['X-Property-ID'] = propertyId;
  }
  
  // Also add to query params if it's a GET request
  if (propertyId && !url.includes('property_id') && !url.includes('property_subdomain')) {
    const separator = url.includes('?') ? '&' : '?';
    url = `${url}${separator}property_id=${propertyId}`;
  }
  
  // ... rest of existing code ...
}
```

### 8. **Settings Modal - Fallback to First Property**
**File:** `sub-domain/frontend/src/JACS/pages/property manager/SettingsModal.jsx`
**Issue:** Lines 146-147 - Falls back to `properties[0].id` if subdomain matching fails. This could select the wrong property.

**Fix:** Remove fallback and require property context:
```javascript
if (properties && Array.isArray(properties) && properties.length > 0) {
  // Don't auto-select first property - require subdomain match
  const matchingProperty = properties.find(p => 
    p.id === propertyIdOrSubdomain || 
    p.portal_subdomain === propertyIdOrSubdomain
  );
  if (matchingProperty) {
    propertyIdToUse = matchingProperty.id;
  } else {
    console.error('No matching property found for subdomain');
    // Don't fallback - require correct subdomain
  }
}
```

### 9. **TenantsPage - Property Selection Logic**
**File:** `sub-domain/frontend/src/JACS/pages/property manager/TenantsPage.jsx`
**Issue:** Lines 84-94 - Complex property matching logic that could match wrong property.

**Recommendation:** Simplify to only match by exact property_id or portal_subdomain.

---

## 🟢 LOW PRIORITY / IMPROVEMENTS

### 10. **Error Handling Consistency**
**Issue:** Inconsistent error messages and error codes across routes.

**Recommendation:** Create a centralized error response helper:
```python
# utils/errors.py
def property_context_required():
    return jsonify({
        'error': 'Property context is required. Please access through a property subdomain.',
        'code': 'PROPERTY_CONTEXT_REQUIRED'
    }), 400

def property_access_denied():
    return jsonify({
        'error': 'Access denied. You do not own this property.',
        'code': 'PROPERTY_ACCESS_DENIED'
    }), 403
```

### 11. **Logging Improvements**
**Recommendation:** Add structured logging for property access attempts:
```python
current_app.logger.info(f"Property access attempt: user_id={current_user.id}, property_id={property_id}, subdomain={subdomain}")
```

### 12. **Database Indexes**
**Recommendation:** Ensure database has indexes on:
- `properties.owner_id`
- `properties.portal_subdomain`
- `tenants.property_id`
- `staff.property_id`
- `units.property_id`
- `tasks.property_id` (if exists)
- `documents.property_id`
- `announcements.property_id`

### 13. **Frontend Property Context Caching**
**File:** `sub-domain/frontend/src/JACS/components/PropertyContext.jsx`
**Issue:** Property context is cached in sessionStorage, but might not update when switching subdomains.

**Recommendation:** Clear cache when hostname changes:
```javascript
useEffect(() => {
  const currentHostname = window.location.hostname;
  const cachedHostname = sessionStorage.getItem('last_hostname');
  
  if (cachedHostname && cachedHostname !== currentHostname) {
    // Subdomain changed - clear cache
    sessionStorage.removeItem('property_context');
  }
  
  sessionStorage.setItem('last_hostname', currentHostname);
  load();
}, [window.location.hostname]);
```

### 14. **API Request Interceptor**
**Recommendation:** Add automatic property context injection in frontend:
```javascript
// In api.js constructor or initialization
this.addPropertyContextToRequests = true;

// In makeRequest method
if (this.addPropertyContextToRequests) {
  const propertyId = this.getPropertyIdFromSubdomain();
  if (propertyId) {
    if (!config.headers) config.headers = {};
    config.headers['X-Property-ID'] = propertyId;
  }
}
```

---

## 📋 IMPLEMENTATION PRIORITY

### Phase 1: Critical Security Fixes (IMMEDIATE)
1. ✅ Fix announcement routes - Add property filtering
2. ✅ Fix document routes - Add property filtering  
3. ✅ Fix feedback routes - Add ownership validation
4. ✅ Fix notification routes - Add property context
5. ✅ Fix property routes - Return only current property
6. ✅ Fix user routes - Filter by property

### Phase 2: Frontend Improvements (HIGH)
7. Add automatic property context to API calls
8. Fix Settings Modal fallback logic
9. Improve property context caching

### Phase 3: Code Quality (MEDIUM)
10. Centralize error handling
11. Improve logging
12. Add database indexes

### Phase 4: Optimization (LOW)
13. Performance optimizations
14. Caching improvements
15. Documentation updates

---

## ✅ ALREADY FIXED (From Previous Work)

1. ✅ **Task Routes** - Property filtering and ownership validation added
2. ✅ **Request Routes** - Property filtering and ownership validation added
3. ✅ **Tenant Routes** - Property filtering and ownership validation added
4. ✅ **Billing Routes** - Property filtering and ownership validation added
5. ✅ **Analytics Routes** - Property filtering and ownership validation added
6. ✅ **Staff Routes** - Property filtering and ownership validation added
7. ✅ **Chat Routes** - Property filtering and ownership validation added
8. ✅ **Auth Routes** - Property_id added to JWT claims

---

## 🔍 TESTING RECOMMENDATIONS

1. **Multi-Property Manager Test:**
   - Create a user with 3 properties
   - Log into each subdomain
   - Verify data isolation (no cross-property data leakage)
   - Verify ownership validation (403 errors when accessing other properties)

2. **Subdomain Switching Test:**
   - Log into property A subdomain
   - Switch to property B subdomain (different tab)
   - Verify property context updates correctly
   - Verify cached data is cleared

3. **API Direct Access Test:**
   - Try accessing endpoints with wrong property_id
   - Verify 403 errors are returned
   - Verify error messages are clear

4. **Frontend Property Context Test:**
   - Test property context loading on page refresh
   - Test property context when backend is unavailable
   - Test property context with invalid subdomain

---

## 📝 SUMMARY

**Critical Issues Found:** 6
**Medium Priority Issues:** 3
**Low Priority Improvements:** 6

**Total Routes Scanned:** 13
**Routes with Issues:** 6
**Routes Already Fixed:** 7

The sub-domain system has a solid foundation with proper isolation in most routes. However, **6 critical security vulnerabilities** need immediate attention to prevent data leakage between properties. Once these are fixed, the system will provide complete property isolation as designed.

---

## 🚀 NEXT STEPS

1. **Immediate Action:** Fix all 6 critical security issues (Phase 1)
2. **Testing:** Run comprehensive multi-property isolation tests
3. **Documentation:** Update API documentation with property context requirements
4. **Monitoring:** Add logging for property access violations
5. **Review:** Code review of all property filtering logic

---

*Report Generated: 2024*
*System: JACS Sub-Domain Property Management System*

