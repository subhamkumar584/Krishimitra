from flask import Blueprint, request, jsonify
from sqlalchemy.orm import Session
from .db import get_db
from .enam_scraper import ENamScraper

bp = Blueprint("info", __name__, url_prefix="/api/v1/info")

@bp.get("/market-prices")
def market_prices():
    import httpx
    import random
    from datetime import datetime
    
    lat = request.args.get("lat")
    lon = request.args.get("lon")
    commodity = request.args.get("commodity", "")
    
    # Government API configuration
    API_KEY = "579b464db66ec23bdd000001f1b11029dd3c46855362207201330531"
    API_URL = "https://api.data.gov.in/resource/9ef84268-d588-465a-a308-a864a43d0070"
    
    try:
        # Get hybrid data from both data.gov.in and eNAM
        records, gov_count, enam_count = get_hybrid_mandi_data(lat, lon)
        
        if records:
            # Process and categorize the hybrid data
            categorized_prices = categorize_mandi_data(records, lat, lon)
            
            # Add source information
            categorized_prices['data_sources'] = {
                'government_api_records': gov_count,
                'enam_records': enam_count,
                'total_records': len(records)
            }
            
            # Filter by commodity if requested
            if commodity:
                filtered_prices = filter_by_commodity(categorized_prices, commodity)
                return jsonify({
                    "prices": filtered_prices,
                    "source": "Government of India - data.gov.in",
                    "last_updated": datetime.now().isoformat(),
                    "total_records": len(records)
                })
            
            # Determine source description
            source_desc = "Hybrid: Government of India (data.gov.in)"
            if enam_count > 0:
                source_desc += f" + eNAM ({enam_count} records)"
                
            return jsonify({
                "prices": categorized_prices,
                "source": source_desc,
                "data_sources": categorized_prices.get('data_sources', {}),
                "last_updated": datetime.now().isoformat(),
                "total_records": len(records),
                "location_info": {
                    "coordinates": f"{lat},{lon}" if lat and lon else None,
                    "location_filtered": categorized_prices.get('location_filtered', False),
                    "filtered_states": categorized_prices.get('filtered_states', []),
                    "original_records": categorized_prices.get('original_records', 0),
                    "filtered_records": categorized_prices.get('filtered_records', 0)
                }
            })
        else:
            # Fallback to mock data if API fails
            return get_fallback_prices(lat, lon)
                
    except Exception as e:
        # Fallback to mock data on any error
        return get_fallback_prices(lat, lon)


def get_hybrid_mandi_data(lat=None, lon=None):
    """Get mandi data from both data.gov.in and eNAM, with preference for official API"""
    
    # First try official government API
    import httpx
    API_KEY = "579b464db66ec23bdd000001f1b11029dd3c46855362207201330531"
    API_URL = "https://api.data.gov.in/resource/9ef84268-d588-465a-a308-a864a43d0070"
    
    gov_records = []
    enam_records = []
    
    try:
        # Fetch from government API
        params = {
            "api-key": API_KEY,
            "format": "json",
            "limit": "100"
        }
        
        with httpx.Client(timeout=15) as client:
            response = client.get(API_URL, params=params)
            if response.status_code == 200:
                data = response.json()
                gov_records = data.get("records", [])
                print(f"✓ Fetched {len(gov_records)} records from data.gov.in")
    except Exception as e:
        print(f"✗ Error fetching from data.gov.in: {e}")
    
    # Get available states from government data
    gov_states = set()
    if gov_records:
        gov_states = {record.get('state', '').lower().strip() for record in gov_records if record.get('state')}
        print(f"✓ Government API has data for states: {sorted(gov_states)}")
    
    # Define all Indian states that might have missing data
    all_expected_states = {
        'odisha', 'west bengal', 'bihar', 'jharkhand', 'chhattisgarh',
        'assam', 'meghalaya', 'manipur', 'mizoram', 'nagaland', 'tripura',
        'arunachal pradesh', 'sikkim', 'himachal pradesh', 'uttarakhand',
        'jammu and kashmir', 'ladakh', 'punjab', 'haryana', 'delhi',
        'uttar pradesh', 'rajasthan', 'madhya pradesh', 'kerala',
        'tamil nadu', 'karnataka', 'andhra pradesh', 'telangana',
        'maharashtra', 'goa'
    }
    
    # Find states missing from government API
    missing_states = all_expected_states - gov_states
    if missing_states:
        print(f"✗ Missing from gov API: {sorted(missing_states)}")
        
        # Try to get data from eNAM for missing states
        try:
            scraper = ENamScraper()
            
            # If user provided location, prioritize nearby states
            if lat and lon:
                nearby_states = get_nearby_states_for_location(float(lat), float(lon))
                missing_nearby = [state for state in nearby_states if state.lower() in missing_states]
                if missing_nearby:
                    print(f"✓ Fetching eNAM data for nearby missing states: {missing_nearby}")
                    enam_data = scraper.get_state_specific_data(missing_nearby)
                    enam_records = scraper.format_trade_data_for_api(enam_data)
            else:
                # Get data for some key missing states (limit to avoid overload)
                priority_missing = [state for state in ['odisha', 'west bengal', 'bihar', 'kerala'] if state in missing_states][:3]
                if priority_missing:
                    print(f"✓ Fetching eNAM data for priority missing states: {priority_missing}")
                    enam_data = scraper.get_state_specific_data(priority_missing)
                    enam_records = scraper.format_trade_data_for_api(enam_data)
                    
        except Exception as e:
            print(f"✗ Error fetching from eNAM: {e}")
    
    # Combine both datasets
    all_records = gov_records + enam_records
    print(f"✓ Combined dataset: {len(gov_records)} gov + {len(enam_records)} eNAM = {len(all_records)} total")
    
    return all_records, len(gov_records), len(enam_records)


def get_nearby_states_for_location(lat, lon):
    """Get nearby states for given coordinates"""
    state_coordinates = {
        'andhra pradesh': (15.9129, 79.7400),
        'telangana': (17.1232, 79.2088),
        'karnataka': (15.3173, 75.7139),
        'kerala': (10.8505, 76.2711),
        'tamil nadu': (11.1271, 78.6569),
        'maharashtra': (19.7515, 75.7139),
        'gujarat': (22.2587, 71.1924),
        'rajasthan': (27.0238, 74.2179),
        'madhya pradesh': (22.9734, 78.6569),
        'uttar pradesh': (26.8467, 80.9462),
        'bihar': (25.0961, 85.3131),
        'west bengal': (22.9868, 87.8550),
        'odisha': (20.9517, 85.0985),
        'jharkhand': (23.6102, 85.2799),
        'chhattisgarh': (21.2787, 81.8661),
        'punjab': (31.1471, 75.3412),
        'haryana': (29.0588, 76.0856),
        'himachal pradesh': (31.1048, 77.1734),
        'uttarakhand': (30.0668, 79.0193),
        'delhi': (28.7041, 77.1025),
        'assam': (26.2006, 92.9376),
        'arunachal pradesh': (28.2180, 94.7278),
        'manipur': (24.6637, 93.9063),
        'meghalaya': (25.4670, 91.3662),
        'mizoram': (23.1645, 92.9376),
        'nagaland': (26.1584, 94.5624),
        'sikkim': (27.5330, 88.5122),
        'tripura': (23.9408, 91.9882),
        'goa': (15.2993, 74.1240)
    }
    
    import math
    def calculate_distance(lat1, lon1, lat2, lon2):
        dlat = abs(lat1 - lat2)
        dlon = abs(lon1 - lon2)
        return math.sqrt(dlat**2 + dlon**2) * 111
    
    nearby_states = []
    for state, (state_lat, state_lon) in state_coordinates.items():
        distance = calculate_distance(lat, lon, state_lat, state_lon)
        if distance <= 500:  # 500km radius
            nearby_states.append((state, distance))
    
    # Sort by distance and return state names
    nearby_states.sort(key=lambda x: x[1])
    return [state for state, _ in nearby_states[:5]]


def categorize_mandi_data(records, lat=None, lon=None):
    """Categorize real mandi data into vegetables, fruits, and commodities with location filtering"""
    
    # Use existing nearby states function for location filtering
    
    # Filter records by location if coordinates provided
    filtered_records = records
    target_states = None
    
    if lat and lon:
        try:
            user_lat, user_lon = float(lat), float(lon)
            target_states = get_nearby_states_for_location(user_lat, user_lon)
            
            if target_states:
                filtered_records = [
                    record for record in records 
                    if record.get('state', '').lower().strip() in target_states
                ]
                
                # If no records found in nearby states, expand search radius
                if not filtered_records:
                    # Expand search by using a custom function for 1000km radius
                    import math
                    state_coordinates = {
                        'andhra pradesh': (15.9129, 79.7400), 'telangana': (17.1232, 79.2088),
                        'karnataka': (15.3173, 75.7139), 'kerala': (10.8505, 76.2711),
                        'tamil nadu': (11.1271, 78.6569), 'maharashtra': (19.7515, 75.7139),
                        'gujarat': (22.2587, 71.1924), 'rajasthan': (27.0238, 74.2179),
                        'madhya pradesh': (22.9734, 78.6569), 'uttar pradesh': (26.8467, 80.9462),
                        'bihar': (25.0961, 85.3131), 'west bengal': (22.9868, 87.8550),
                        'odisha': (20.9517, 85.0985), 'jharkhand': (23.6102, 85.2799),
                        'chhattisgarh': (21.2787, 81.8661), 'punjab': (31.1471, 75.3412),
                        'haryana': (29.0588, 76.0856), 'himachal pradesh': (31.1048, 77.1734),
                        'uttarakhand': (30.0668, 79.0193), 'delhi': (28.7041, 77.1025),
                        'assam': (26.2006, 92.9376), 'arunachal pradesh': (28.2180, 94.7278),
                        'manipur': (24.6637, 93.9063), 'meghalaya': (25.4670, 91.3662),
                        'mizoram': (23.1645, 92.9376), 'nagaland': (26.1584, 94.5624),
                        'sikkim': (27.5330, 88.5122), 'tripura': (23.9408, 91.9882),
                        'goa': (15.2993, 74.1240)
                    }
                    
                    def calc_dist(lat1, lon1, lat2, lon2):
                        dlat, dlon = abs(lat1 - lat2), abs(lon1 - lon2)
                        return math.sqrt(dlat**2 + dlon**2) * 111
                    
                    expanded_states = []
                    for state, (s_lat, s_lon) in state_coordinates.items():
                        if calc_dist(user_lat, user_lon, s_lat, s_lon) <= 1000:
                            expanded_states.append(state)
                    target_states = expanded_states[:5]
                    filtered_records = [
                        record for record in records 
                        if record.get('state', '').lower().strip() in target_states
                    ]
        except ValueError:
            pass  # Use all records if coordinates are invalid
    
    # Define category mappings
    vegetable_keywords = [
        'tomato', 'onion', 'potato', 'cabbage', 'cauliflower', 'brinjal', 'okra', 'chilli', 'green chilli',
        'carrot', 'radish', 'spinach', 'coriander', 'mint', 'capsicum', 'cucumber', 'bottle gourd',
        'ridge gourd', 'bitter gourd', 'pumpkin', 'beans', 'peas', 'ladyfinger'
    ]
    
    fruit_keywords = [
        'apple', 'banana', 'orange', 'mango', 'grapes', 'pomegranate', 'lemon', 'lime', 'coconut',
        'papaya', 'watermelon', 'muskmelon', 'pineapple', 'guava', 'sapota', 'sweet lime'
    ]
    
    grain_keywords = [
        'wheat', 'rice', 'paddy', 'jowar', 'bajra', 'maize', 'barley', 'gram', 'tur', 'moong',
        'urad', 'masoor', 'arhar', 'chana', 'soybean', 'groundnut', 'sunflower', 'mustard', 'sesame'
    ]
    
    vegetables = []
    fruits = []
    grains = []
    
    # Process each record (using filtered records for location-specific data)
    for record in filtered_records:
        try:
            commodity_name = record.get('commodity', '').lower().strip()
            variety = record.get('variety', '').lower().strip()
            state = record.get('state', '')
            district = record.get('district', '')
            market = record.get('market', '')
            
            # Get prices (convert from per quintal to per kg for most items)
            min_price = float(record.get('min_price', 0))
            max_price = float(record.get('max_price', 0))
            modal_price = float(record.get('modal_price', 0))
            
            if modal_price == 0:
                continue  # Skip records with no price data
            
            # Create item data structure
            item_data = {
                'name': record.get('commodity', ''),
                'variety': record.get('variety', ''),
                'price': round(modal_price / 100, 2),  # Convert to per kg (assuming quintal pricing)
                'min_price': round(min_price / 100, 2),
                'max_price': round(max_price / 100, 2),
                'unit': 'kg',
                'market': f"{market}, {district}, {state}",
                'state': state,
                'district': district,
                'date': record.get('arrival_date', ''),
                'grade': record.get('grade', '')
            }
            
            # Categorize based on commodity name
            categorized = False
            
            # Check vegetables
            for veg in vegetable_keywords:
                if veg in commodity_name or veg in variety:
                    # For vegetables, use direct pricing (already per kg in many cases)
                    if 'quintal' in commodity_name.lower() or modal_price > 1000:
                        item_data['price'] = round(modal_price / 100, 2)
                    else:
                        item_data['price'] = round(modal_price, 2)
                    
                    vegetables.append(item_data)
                    categorized = True
                    break
            
            if not categorized:
                # Check fruits
                for fruit in fruit_keywords:
                    if fruit in commodity_name or fruit in variety:
                        # For fruits, use direct pricing
                        if modal_price > 1000:
                            item_data['price'] = round(modal_price / 100, 2)
                        else:
                            item_data['price'] = round(modal_price, 2)
                        
                        fruits.append(item_data)
                        categorized = True
                        break
            
            if not categorized:
                # Check grains/commodities
                for grain in grain_keywords:
                    if grain in commodity_name or grain in variety:
                        # Keep quintal pricing for grains
                        item_data['price'] = round(modal_price, 2)
                        item_data['unit'] = 'quintal'
                        grains.append(item_data)
                        categorized = True
                        break
                        
        except (ValueError, KeyError) as e:
            continue  # Skip malformed records
    
    # Sort by price and take top items from each category
    vegetables = sorted(vegetables, key=lambda x: x['price'])[:12]
    fruits = sorted(fruits, key=lambda x: x['price'])[:8]
    grains = sorted(grains, key=lambda x: x['price'])[:10]
    
    result = {
        'vegetables': vegetables,
        'fruits': fruits,
        'grains': grains
    }
    
    # Add location filtering information
    if target_states:
        result['filtered_states'] = target_states
        result['location_filtered'] = True
        result['original_records'] = len(records)
        result['filtered_records'] = len(filtered_records)
    else:
        result['location_filtered'] = False
        result['original_records'] = len(records)
        result['filtered_records'] = len(records)
    
    return result


def filter_by_commodity(categorized_prices, commodity):
    """Filter prices by specific commodity search"""
    filtered = {}
    commodity_lower = commodity.lower()
    
    for category, items in categorized_prices.items():
        filtered_items = [
            item for item in items 
            if commodity_lower in item['name'].lower() or commodity_lower in item.get('variety', '').lower()
        ]
        if filtered_items:
            filtered[category] = filtered_items
    
    return filtered


def get_fallback_prices(lat, lon):
    """Fallback mock prices when API is unavailable"""
    region = "Local Mandi"
    if lat and lon:
        try:
            lat_f, lon_f = float(lat), float(lon)
            if 20 <= lat_f <= 25 and 75 <= lon_f <= 85:
                region = "Central India Mandi"
            elif 25 <= lat_f <= 30 and 75 <= lon_f <= 80:
                region = "North India Mandi"
            elif 15 <= lat_f <= 20 and 75 <= lon_f <= 80:
                region = "South India Mandi"
        except ValueError:
            pass
    
    mock_prices = {
        "vegetables": [
            {"name": "Tomato", "price": 25, "unit": "kg", "market": region, "variety": "Local"},
            {"name": "Onion", "price": 30, "unit": "kg", "market": region, "variety": "Local"},
            {"name": "Potato", "price": 20, "unit": "kg", "market": region, "variety": "Local"}
        ],
        "fruits": [
            {"name": "Apple", "price": 120, "unit": "kg", "market": region, "variety": "Local"},
            {"name": "Banana", "price": 40, "unit": "kg", "market": region, "variety": "Local"}
        ],
        "grains": [
            {"name": "Wheat", "price": 2500, "unit": "quintal", "market": "Agricultural Market", "variety": "Local"}
        ]
    }
    
    from datetime import datetime
    return jsonify({
        "prices": mock_prices,
        "source": "Fallback Data",
        "last_updated": datetime.now().isoformat(),
        "region": region
    })

@bp.get("/schemes")
def schemes():
    # Stub: replace with Government schemes/news aggregation
    return jsonify({"schemes": [
        {"title": "PM-Kisan", "description": "Income support to farmers"}
    ]})
