# Property Type Specific Fields Design

## 🎯 **Goal**: Different Unit fields based on Property Type

## **Approach 1: JSON Field for Property-Specific Data (Recommended)**

### **Database Schema Changes:**

```sql
-- Add property-specific data field to units table
ALTER TABLE units ADD COLUMN property_specific_data JSON;

-- Add property type reference for easier querying
ALTER TABLE units ADD COLUMN property_type VARCHAR(50);
```

### **Property Type Specific Fields:**

#### **Bed Space Units:**
```json
{
  "bed_number": "A1",
  "room_shared_with": 3,
  "locker_space": true,
  "study_desk": true,
  "wardrobe_space": "small",
  "window_access": true,
  "electrical_outlets": 2
}
```

#### **Dormitory Units:**
```json
{
  "bed_number": "B-12",
  "room_capacity": 4,
  "shared_amenities": ["common_kitchen", "study_room", "laundry"],
  "curfew_time": "22:00",
  "visitor_policy": "weekends_only",
  "meal_plan_included": false,
  "wifi_access": "unlimited"
}
```

#### **Boarding House Units:**
```json
{
  "room_number": "BH-3A",
  "meal_plan": "breakfast_dinner",
  "laundry_access": "weekly",
  "house_rules": ["no_smoking", "quiet_hours_10pm"],
  "shared_bathroom_count": 2,
  "common_areas": ["living_room", "kitchen", "dining"],
  "cleaning_schedule": "weekly"
}
```

#### **Studio Apartment Units:**
```json
{
  "kitchenette": true,
  "living_area_size": 25.5,
  "bedroom_separated": false,
  "balcony_access": true,
  "air_conditioning": true,
  "furniture_included": ["bed", "sofa", "dining_table"],
  "utilities_included": ["electricity", "water", "internet"]
}
```

#### **Room for Rent Units:**
```json
{
  "room_type": "master_bedroom",
  "shared_amenities": ["kitchen", "living_room", "bathroom"],
  "house_rules": ["no_pets", "no_smoking"],
  "utilities_shared": true,
  "parking_available": false,
  "deposit_required": true
}
```

## **Approach 2: Separate Tables for Each Property Type**

### **Create separate tables:**
- `bed_space_units`
- `dormitory_units` 
- `boarding_house_units`
- `studio_apartment_units`
- `room_for_rent_units`

### **Pros:**
- Type safety
- Clear schema
- Better performance for specific queries

### **Cons:**
- More complex joins
- Harder to maintain
- Less flexible

## **Approach 3: Polymorphic Association**

### **Create a base Unit model and specific models:**
```python
class Unit(db.Model):
    # Common fields
    id = db.Column(db.Integer, primary_key=True)
    property_id = db.Column(db.Integer, db.ForeignKey('properties.id'))
    unit_number = db.Column(db.String(20))
    monthly_rent = db.Column(Numeric(10, 2))
    # ... other common fields

class BedSpaceUnit(Unit):
    __tablename__ = 'bed_space_units'
    bed_number = db.Column(db.String(20))
    room_shared_with = db.Column(db.Integer)
    locker_space = db.Column(db.Boolean)
    # ... bed space specific fields

class DormitoryUnit(Unit):
    __tablename__ = 'dormitory_units'
    room_capacity = db.Column(db.Integer)
    shared_amenities = db.Column(db.JSON)
    curfew_time = db.Column(db.Time)
    # ... dormitory specific fields
```

## **Recommended Implementation: Approach 1 (JSON Field)**

### **Backend Model Updates:**

```python
# sub-domain/backend/models/property.py
class Unit(db.Model):
    # ... existing fields ...
    
    # Property-specific data stored as JSON
    property_specific_data = db.Column(db.JSON)
    
    # Property type for easier querying
    property_type = db.Column(db.Enum(PropertyType))
    
    def get_property_specific_field(self, field_name, default=None):
        """Get a property-specific field value."""
        if not self.property_specific_data:
            return default
        return self.property_specific_data.get(field_name, default)
    
    def set_property_specific_field(self, field_name, value):
        """Set a property-specific field value."""
        if not self.property_specific_data:
            self.property_specific_data = {}
        self.property_specific_data[field_name] = value
```

### **Frontend Implementation:**

```javascript
// Property-specific field configurations
const PROPERTY_TYPE_FIELDS = {
  bed_space: [
    { name: 'bed_number', label: 'Bed Number', type: 'text', required: true },
    { name: 'room_shared_with', label: 'Shared With', type: 'number', required: true },
    { name: 'locker_space', label: 'Locker Space', type: 'checkbox' },
    { name: 'study_desk', label: 'Study Desk', type: 'checkbox' },
    { name: 'wardrobe_space', label: 'Wardrobe Space', type: 'select', options: ['small', 'medium', 'large'] },
    { name: 'window_access', label: 'Window Access', type: 'checkbox' },
    { name: 'electrical_outlets', label: 'Electrical Outlets', type: 'number' }
  ],
  dormitory: [
    { name: 'bed_number', label: 'Bed Number', type: 'text', required: true },
    { name: 'room_capacity', label: 'Room Capacity', type: 'number', required: true },
    { name: 'shared_amenities', label: 'Shared Amenities', type: 'multiselect', options: ['common_kitchen', 'study_room', 'laundry', 'gym', 'lounge'] },
    { name: 'curfew_time', label: 'Curfew Time', type: 'time' },
    { name: 'visitor_policy', label: 'Visitor Policy', type: 'select', options: ['weekends_only', 'evenings_only', 'no_visitors'] },
    { name: 'meal_plan_included', label: 'Meal Plan Included', type: 'checkbox' },
    { name: 'wifi_access', label: 'WiFi Access', type: 'select', options: ['unlimited', 'limited', 'none'] }
  ],
  boarding_house: [
    { name: 'room_number', label: 'Room Number', type: 'text', required: true },
    { name: 'meal_plan', label: 'Meal Plan', type: 'select', options: ['none', 'breakfast_only', 'breakfast_dinner', 'full_board'] },
    { name: 'laundry_access', label: 'Laundry Access', type: 'select', options: ['daily', 'weekly', 'bi_weekly', 'none'] },
    { name: 'house_rules', label: 'House Rules', type: 'multiselect', options: ['no_smoking', 'no_pets', 'quiet_hours_10pm', 'no_visitors_after_10pm'] },
    { name: 'shared_bathroom_count', label: 'Shared Bathrooms', type: 'number' },
    { name: 'common_areas', label: 'Common Areas', type: 'multiselect', options: ['living_room', 'kitchen', 'dining', 'garden'] },
    { name: 'cleaning_schedule', label: 'Cleaning Schedule', type: 'select', options: ['daily', 'weekly', 'bi_weekly'] }
  ],
  studio_apartment: [
    { name: 'kitchenette', label: 'Kitchenette', type: 'checkbox' },
    { name: 'living_area_size', label: 'Living Area Size (sqm)', type: 'number' },
    { name: 'bedroom_separated', label: 'Bedroom Separated', type: 'checkbox' },
    { name: 'balcony_access', label: 'Balcony Access', type: 'checkbox' },
    { name: 'air_conditioning', label: 'Air Conditioning', type: 'checkbox' },
    { name: 'furniture_included', label: 'Furniture Included', type: 'multiselect', options: ['bed', 'sofa', 'dining_table', 'wardrobe', 'desk'] },
    { name: 'utilities_included', label: 'Utilities Included', type: 'multiselect', options: ['electricity', 'water', 'internet', 'cable'] }
  ],
  room_for_rent: [
    { name: 'room_type', label: 'Room Type', type: 'select', options: ['master_bedroom', 'single_room', 'shared_room'] },
    { name: 'shared_amenities', label: 'Shared Amenities', type: 'multiselect', options: ['kitchen', 'living_room', 'bathroom', 'laundry', 'garden'] },
    { name: 'house_rules', label: 'House Rules', type: 'multiselect', options: ['no_pets', 'no_smoking', 'no_visitors', 'quiet_hours'] },
    { name: 'utilities_shared', label: 'Utilities Shared', type: 'checkbox' },
    { name: 'parking_available', label: 'Parking Available', type: 'checkbox' },
    { name: 'deposit_required', label: 'Deposit Required', type: 'checkbox' }
  ]
};
```

### **Dynamic Form Generation:**

```javascript
// Generate form fields based on property type
const generatePropertySpecificFields = (propertyType) => {
  const fields = PROPERTY_TYPE_FIELDS[propertyType] || [];
  
  return fields.map(field => {
    switch (field.type) {
      case 'text':
        return (
          <input
            key={field.name}
            type="text"
            name={field.name}
            placeholder={field.label}
            required={field.required}
            className="w-full px-3 py-2 border rounded-lg"
          />
        );
      case 'number':
        return (
          <input
            key={field.name}
            type="number"
            name={field.name}
            placeholder={field.label}
            required={field.required}
            className="w-full px-3 py-2 border rounded-lg"
          />
        );
      case 'checkbox':
        return (
          <label key={field.name} className="flex items-center">
            <input
              type="checkbox"
              name={field.name}
              className="mr-2"
            />
            {field.label}
          </label>
        );
      case 'select':
        return (
          <select
            key={field.name}
            name={field.name}
            required={field.required}
            className="w-full px-3 py-2 border rounded-lg"
          >
            <option value="">Select {field.label}</option>
            {field.options.map(option => (
              <option key={option} value={option}>
                {option.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase())}
              </option>
            ))}
          </select>
        );
      case 'multiselect':
        return (
          <div key={field.name} className="space-y-2">
            <label className="block text-sm font-medium">{field.label}</label>
            {field.options.map(option => (
              <label key={option} className="flex items-center">
                <input
                  type="checkbox"
                  name={`${field.name}[]`}
                  value={option}
                  className="mr-2"
                />
                {option.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase())}
              </label>
            ))}
          </div>
        );
      default:
        return null;
    }
  });
};
```

## **Benefits of This Approach:**

1. **Flexibility**: Easy to add new fields for any property type
2. **Maintainability**: Single table structure
3. **Performance**: JSON fields are efficiently indexed in modern databases
4. **Scalability**: Can handle complex nested data structures
5. **Type Safety**: Can validate JSON structure in backend

## **Implementation Steps:**

1. **Database Migration**: Add `property_specific_data` JSON column
2. **Backend Updates**: Update Unit model with helper methods
3. **Frontend Updates**: Create dynamic form generation
4. **API Updates**: Handle property-specific data in CRUD operations
5. **Validation**: Add JSON schema validation for each property type

Would you like me to implement this approach for your system?





