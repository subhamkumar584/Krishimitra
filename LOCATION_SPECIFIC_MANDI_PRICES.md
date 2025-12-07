# 📍 Location-Specific Mandi Prices Implementation

## Overview
The advisory section now shows **real-time mandi prices filtered by user's location**, displaying prices from nearby markets rather than showing data from the entire country.

## 🎯 Key Features

### **Location-Based Filtering**
- **Coordinate-Based**: Uses user's GPS coordinates to find nearby states
- **Distance Algorithm**: Calculates distance from user location to state centers
- **Proximity Filtering**: Shows prices from markets within 500km radius
- **Fallback Expansion**: Expands to 1000km if no nearby data found

### **Smart State Mapping**
- **29 States + 8 UTs**: Complete mapping of all Indian states and union territories
- **Geographic Centers**: Each state mapped to its geographic center coordinates
- **Distance Calculation**: Approximate distance calculation for filtering
- **Multi-State Results**: Shows prices from 3-5 closest states

## 🗺️ Location Filtering Process

### Step 1: Location Detection
```typescript
// User clicks "Use My Location"
navigator.geolocation.getCurrentPosition((position) => {
  const latitude = position.coords.latitude.toString();
  const longitude = position.coords.longitude.toString();
  // Automatically fetch location-specific prices
});
```

### Step 2: Backend Filtering
```python
# Calculate distance to all state centers
def get_nearby_states(user_lat, user_lon, max_distance=500):
    nearby_states = []
    for state, (state_lat, state_lon) in state_coordinates.items():
        distance = calculate_distance(user_lat, user_lon, state_lat, state_lon)
        if distance <= max_distance:
            nearby_states.append((state, distance))
    return sorted_nearby_states[:5]  # Return closest 5 states

# Filter government API data by nearby states
filtered_records = [
    record for record in records 
    if record.get('state').lower() in nearby_states
]
```

### Step 3: UI Display
- **Location Badge**: Shows "📍 Location-specific" when filtered
- **Nearby States**: Displays which states are included
- **Record Count**: Shows "🎯 X nearby records (from Y total)"
- **State List**: Lists nearby states below the header

## 📊 State Coordinate Mapping

### Major Regions Covered:
- **North India**: Punjab, Haryana, Delhi, Uttar Pradesh, Uttarakhand, Himachal Pradesh
- **Central India**: Madhya Pradesh, Chhattisgarh, Rajasthan, Gujarat, Maharashtra
- **South India**: Karnataka, Andhra Pradesh, Telangana, Tamil Nadu, Kerala
- **East India**: West Bengal, Odisha, Bihar, Jharkhand, Assam
- **Northeast**: All 7 sister states included
- **West India**: Maharashtra, Gujarat, Goa

### Distance Examples:
- **Mumbai (19.0760, 72.8777)**: Shows Gujarat, Maharashtra, Goa prices
- **Delhi (28.7041, 77.1025)**: Shows Punjab, Haryana, UP, Rajasthan prices
- **Bengaluru (12.9716, 77.5946)**: Shows Karnataka, Tamil Nadu, Kerala, Andhra Pradesh prices
- **Kolkata (22.5726, 88.3639)**: Shows West Bengal, Odisha, Bihar, Jharkhand prices

## 🛠️ Technical Implementation

### Backend (`backend/app/routes_info.py`)

#### State Coordinates Database
```python
state_coordinates = {
    'andhra pradesh': (15.9129, 79.7400),
    'karnataka': (15.3173, 75.7139),
    'maharashtra': (19.7515, 75.7139),
    'gujarat': (22.2587, 71.1924),
    # ... 29 states + 8 UTs
}
```

#### Distance Calculation
```python
def calculate_distance(lat1, lon1, lat2, lon2):
    # Simple Euclidean distance approximation
    dlat = abs(lat1 - lat2)
    dlon = abs(lon1 - lon2)
    return math.sqrt(dlat**2 + dlon**2) * 111  # Convert to km
```

#### API Response Enhancement
```python
return {
    "prices": {
        "vegetables": [...],
        "fruits": [...], 
        "grains": [...],
        "location_filtered": True,
        "filtered_states": ["maharashtra", "gujarat", "goa"],
        "original_records": 1000,
        "filtered_records": 150
    },
    "source": "Government of India - data.gov.in",
    "location_info": {...}
}
```

### Frontend (`frontend/app/advisory/page.tsx`)

#### Location-Specific UI Elements
```typescript
// Show location filtering badge
{isLocationFiltered && (
  <span className="bg-green-600/20 text-green-300 text-xs px-2 py-1 rounded-full">
    📍 Location-specific
  </span>
)}

// Display filtered record count
{isLocationFiltered && filteredRecords > 0 && (
  <span className="text-green-400">
    🎯 {filteredRecords} nearby records (from {originalRecords} total)
  </span>
)}

// Show nearby states
{filteredStates.length > 0 && (
  <div className="mt-2 p-2 bg-blue-600/10 border border-blue-600/20 rounded-lg">
    <p className="text-xs text-blue-200">
      🗺️ Showing prices from nearby states: 
      <span className="font-semibold">{filteredStates.join(', ')}</span>
    </p>
  </div>
)}
```

## 🎯 User Experience

### **Without Location (Default)**
- Shows all available mandi prices from across India
- Generic "📈 X records" display
- No location filtering applied

### **With Location Permission**
1. **Auto-Detection**: Automatically detects user location
2. **Smart Filtering**: Filters to show only nearby market prices  
3. **Visual Indicators**: Clear badges showing location-specific data
4. **Transparency**: Shows exactly which states are included
5. **Fallback**: Expands search if no nearby data found

### **Manual Coordinates**
- User can enter latitude/longitude manually
- Same location-based filtering applies
- Works even if GPS permission denied

## 📈 Benefits

### **For Farmers**
- **Relevant Prices**: Only see prices from accessible markets
- **Transportation Cost**: Prices from markets they can actually reach
- **Regional Accuracy**: Reflects local supply/demand conditions
- **Time Savings**: No need to scroll through irrelevant distant markets

### **For Users**
- **Personalized Data**: Location-aware information
- **Better Decisions**: Make informed selling/buying decisions
- **Local Context**: Understand nearby market trends
- **Real Accessibility**: Focus on reachable markets

## 🔄 Fallback Strategy

1. **Primary**: 500km radius from user location
2. **Secondary**: 1000km radius if no data found
3. **Tertiary**: All national data if still no results
4. **Final**: Mock data if API completely fails

## 📍 Location Examples

### Test Coordinates:
- **Mumbai**: `19.0760, 72.8777` → Maharashtra, Gujarat, Goa
- **Delhi**: `28.7041, 77.1025` → Punjab, Haryana, UP, Rajasthan  
- **Bengaluru**: `12.9716, 77.5946` → Karnataka, Tamil Nadu, Kerala
- **Kolkata**: `22.5726, 88.3639` → West Bengal, Odisha, Bihar
- **Chennai**: `13.0827, 80.2707` → Tamil Nadu, Andhra Pradesh, Karnataka
- **Hyderabad**: `17.3850, 78.4867` → Telangana, Andhra Pradesh, Karnataka

## 🚀 Future Enhancements

- **District-Level Filtering**: More granular location filtering
- **Transport Cost Integration**: Factor in transportation costs
- **Market Distance Display**: Show actual distance to each market  
- **Seasonal Adjustments**: Location-specific seasonal price patterns
- **Historical Trends**: Location-based price history and trends

The location-specific mandi prices feature is now **fully functional** and provides farmers with relevant, actionable market information! 🎉