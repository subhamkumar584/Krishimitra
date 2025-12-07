"""
eNAM (National Agriculture Market) Web Scraper
Scrapes trade data from https://enam.gov.in/web/dashboard/trade-data
"""
import requests
import json
from datetime import datetime, timedelta
from typing import List, Dict, Optional
import time
import random

class ENamScraper:
    def __init__(self):
        self.base_url = "https://enam.gov.in/web/"
        self.session = requests.Session()
        
        # Set user agent to mimic browser
        self.session.headers.update({
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
            'Accept': 'application/json, text/javascript, */*; q=0.01',
            'Accept-Language': 'en-US,en;q=0.9',
            'Referer': 'https://enam.gov.in/web/dashboard/trade-data',
            'X-Requested-With': 'XMLHttpRequest'
        })
    
    def get_states(self) -> List[Dict]:
        """Get list of states from eNAM API"""
        try:
            url = f"{self.base_url}ajax_ctrl/states_name"
            response = self.session.post(url, data={}, timeout=30)
            
            if response.status_code == 200:
                data = response.json()
                if data.get('status') == 200:
                    return data.get('data', [])
        except Exception as e:
            print(f"Error fetching states: {e}")
        
        return []
    
    def get_apmcs(self, state_id: str) -> List[Dict]:
        """Get APMCs for a specific state"""
        try:
            url = f"{self.base_url}Ajax_ctrl/apmc_list"
            response = self.session.post(url, data={'state_id': state_id}, timeout=30)
            
            if response.status_code == 200:
                data = response.json()
                return data.get('data', [])
        except Exception as e:
            print(f"Error fetching APMCs for state {state_id}: {e}")
        
        return []
    
    def get_trade_data(self, 
                      state_name: str = "", 
                      apmc_name: str = "", 
                      commodity_name: str = "",
                      from_date: str = None, 
                      to_date: str = None) -> List[Dict]:
        """Get trade data from eNAM"""
        try:
            # Use previous day if no dates provided
            if not from_date:
                yesterday = datetime.now() - timedelta(days=1)
                from_date = yesterday.strftime("%Y-%m-%d")
            if not to_date:
                to_date = from_date
            
            url = f"{self.base_url}Ajax_ctrl/trade_data_list"
            
            payload = {
                'language': 'en',
                'stateName': state_name,
                'apmcName': apmc_name,
                'commodityName': commodity_name,
                'fromDate': from_date,
                'toDate': to_date
            }
            
            response = self.session.post(url, data=payload, timeout=30)
            
            if response.status_code == 200:
                data = response.json()
                if data.get('status') == 200:
                    return data.get('data', [])
        except Exception as e:
            print(f"Error fetching trade data: {e}")
        
        return []
    
    def get_all_states_data(self, max_states: int = None) -> List[Dict]:
        """Get trade data for all states"""
        all_data = []
        states = self.get_states()
        
        if max_states:
            states = states[:max_states]
        
        print(f"Fetching data for {len(states)} states...")
        
        for i, state in enumerate(states, 1):
            state_name = state.get('state_name', '')
            print(f"[{i}/{len(states)}] Fetching data for: {state_name}")
            
            try:
                # Get trade data for this state
                trade_data = self.get_trade_data(state_name=state_name)
                
                if trade_data:
                    print(f"  ✓ Found {len(trade_data)} records for {state_name}")
                    all_data.extend(trade_data)
                else:
                    print(f"  ✗ No data found for {state_name}")
                
                # Add delay to be respectful to the server
                time.sleep(random.uniform(0.5, 1.5))
                
            except Exception as e:
                print(f"  ✗ Error fetching data for {state_name}: {e}")
                continue
        
        print(f"\nTotal records collected: {len(all_data)}")
        return all_data
    
    def get_state_specific_data(self, target_states: List[str]) -> List[Dict]:
        """Get trade data for specific states only"""
        all_data = []
        available_states = self.get_states()
        
        # Create mapping of state names (case insensitive)
        state_mapping = {
            state['state_name'].lower(): state['state_name'] 
            for state in available_states
        }
        
        print(f"Fetching data for specific states: {target_states}")
        
        for target_state in target_states:
            target_state_lower = target_state.lower()
            
            if target_state_lower in state_mapping:
                state_name = state_mapping[target_state_lower]
                print(f"Fetching data for: {state_name}")
                
                try:
                    trade_data = self.get_trade_data(state_name=state_name)
                    
                    if trade_data:
                        print(f"  ✓ Found {len(trade_data)} records for {state_name}")
                        all_data.extend(trade_data)
                    else:
                        print(f"  ✗ No data found for {state_name}")
                    
                    # Add delay
                    time.sleep(random.uniform(0.5, 1.0))
                    
                except Exception as e:
                    print(f"  ✗ Error fetching data for {state_name}: {e}")
                    continue
            else:
                print(f"  ✗ State '{target_state}' not found in available states")
        
        print(f"\nTotal records collected: {len(all_data)}")
        return all_data
    
    def format_trade_data_for_api(self, trade_data: List[Dict]) -> List[Dict]:
        """Format eNAM trade data to match our API structure"""
        formatted_data = []
        
        for record in trade_data:
            try:
                formatted_record = {
                    'state': record.get('state', ''),
                    'district': record.get('apmc', ''),  # eNAM uses 'apmc' field
                    'market': record.get('apmc', ''),
                    'commodity': record.get('commodity', ''),
                    'variety': record.get('commodity', ''),  # eNAM doesn't separate variety
                    'grade': '',  # Not available in eNAM data
                    'min_price': str(record.get('min_price', 0)),
                    'max_price': str(record.get('max_price', 0)),
                    'modal_price': str(record.get('modal_price', 0)),
                    'price_date': record.get('created_at', ''),
                    'arrival_date': record.get('created_at', ''),
                    'units': record.get('Commodity_Uom', 'Quintal'),
                    'quantity': record.get('commodity_arrivals', '0'),
                    'traded_quantity': record.get('commodity_traded', '0')
                }
                formatted_data.append(formatted_record)
            except Exception as e:
                print(f"Error formatting record: {e}")
                continue
        
        return formatted_data

# Test function
def test_enam_scraper():
    """Test the eNAM scraper"""
    scraper = ENamScraper()
    
    print("=== Testing eNAM Scraper ===")
    
    # Test 1: Get states
    print("\n1. Testing get_states():")
    states = scraper.get_states()
    print(f"Found {len(states)} states")
    for state in states[:5]:  # Show first 5
        print(f"  - {state.get('state_name')} (ID: {state.get('state_id')})")
    
    # Test 2: Check if Odisha is available
    print("\n2. Checking for Odisha:")
    odisha_states = [s for s in states if 'odisha' in s.get('state_name', '').lower()]
    print(f"Odisha found: {odisha_states}")
    
    # Test 3: Get trade data for Odisha if available
    if odisha_states:
        print(f"\n3. Testing trade data for Odisha:")
        odisha_data = scraper.get_trade_data(state_name=odisha_states[0]['state_name'])
        print(f"Found {len(odisha_data)} records for Odisha")
        
        if odisha_data:
            # Show sample record
            sample = odisha_data[0]
            print("Sample record:")
            for key, value in sample.items():
                print(f"  {key}: {value}")
    
    # Test 4: Get limited data from multiple states
    print(f"\n4. Testing multiple states (limited to 3):")
    all_data = scraper.get_all_states_data(max_states=3)
    print(f"Total records from multiple states: {len(all_data)}")

if __name__ == "__main__":
    test_enam_scraper()