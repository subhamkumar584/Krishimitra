"use client";
import { useState, useEffect } from "react";
import { MapPin, Thermometer, Droplets, Wind, Eye } from "lucide-react";
import { useI18n } from "../../lib/i18n";

export default function AdvisoryPage() {
  const [lat, setLat] = useState<string>("");
  const [lon, setLon] = useState<string>("");
  const [locationName, setLocationName] = useState<string>("");
  const [weather, setWeather] = useState<any>(null);
  const [prices, setPrices] = useState<any>(null);
  const [loadingLocation, setLoadingLocation] = useState(false);
  const [loadingWeather, setLoadingWeather] = useState(false);
  const [loadingPrices, setLoadingPrices] = useState(false);
  const [locationError, setLocationError] = useState<string | null>(null);

  const detectLocation = async () => {
    setLoadingLocation(true);
    setLocationError(null);
    
    if (!navigator.geolocation) {
      setLocationError("Geolocation is not supported by this browser.");
      setLoadingLocation(false);
      return;
    }

    navigator.geolocation.getCurrentPosition(
      (position) => {
        const latitude = position.coords.latitude.toString();
        const longitude = position.coords.longitude.toString();
        setLat(latitude);
        setLon(longitude);
        setLocationName(`${latitude}, ${longitude}`);
        setLoadingLocation(false);
        // Automatically get weather and prices when location is detected
        getWeatherForCoords(latitude, longitude);
        getPricesForLocation();
      },
      (error) => {
        let errorMessage = "Unable to retrieve location.";
        switch (error.code) {
          case error.PERMISSION_DENIED:
            errorMessage = "Location access denied by user.";
            break;
          case error.POSITION_UNAVAILABLE:
            errorMessage = "Location information is unavailable.";
            break;
          case error.TIMEOUT:
            errorMessage = "Location request timed out.";
            break;
        }
        setLocationError(errorMessage);
        setLoadingLocation(false);
      },
      {
        enableHighAccuracy: true,
        timeout: 10000,
        maximumAge: 300000 // 5 minutes
      }
    );
  };

  const getWeatherForCoords = async (latitude: string, longitude: string) => {
    setLoadingWeather(true);
    try {
      const base = process.env.NEXT_PUBLIC_BACKEND_URL || "http://localhost:8000";
      const res = await fetch(`${base}/api/v1/weather?lat=${latitude}&lon=${longitude}`);
      const data = await res.json();
      setWeather(data);
      if (data.name) {
        setLocationName(data.name);
      }
    } catch (error) {
      console.error('Weather fetch error:', error);
    } finally {
      setLoadingWeather(false);
    }
  };

  const getWeather = async () => {
    if (!lat || !lon) return;
    await getWeatherForCoords(lat, lon);
  };

  const getPricesForLocation = async () => {
    setLoadingPrices(true);
    try {
      const base = process.env.NEXT_PUBLIC_BACKEND_URL || "http://localhost:8000";
      const url = lat && lon ? 
        `${base}/api/v1/info/market-prices?lat=${lat}&lon=${lon}` : 
        `${base}/api/v1/info/market-prices`;
      const res = await fetch(url);
      const data = await res.json();
      setPrices(data);
    } catch (error) {
      console.error('Prices fetch error:', error);
    } finally {
      setLoadingPrices(false);
    }
  };

  const getPrices = async () => {
    await getPricesForLocation();
  };

  // Product image mapping for common agricultural products
  const getProductImage = (productName: string, category: string) => {
    const name = productName.toLowerCase();
    const imageMap: {[key: string]: string} = {
      // Vegetables
      'tomato': '🍅',
      'onion': '🧅', 
      'potato': '🥔',
      'cabbage': '🥬',
      'cauliflower': '🥬',
      'brinjal': '🍆',
      'eggplant': '🍆',
      'chilli': '🌶️',
      'green chilli': '🌶️',
      'carrot': '🥕',
      'capsicum': '🫑',
      'cucumber': '🥒',
      'okra': '🌿',
      'ladyfinger': '🌿',
      'beans': '🫘',
      'peas': '🫛',
      
      // Fruits
      'apple': '🍎',
      'banana': '🍌',
      'orange': '🍊',
      'mango': '🥭',
      'grapes': '🍇',
      'lemon': '🍋',
      'lime': '🍋',
      'coconut': '🥥',
      'papaya': '🧡',
      'watermelon': '🍉',
      'pineapple': '🍍',
      'pomegranate': '🍎',
      
      // Grains/Commodities
      'wheat': '🌾',
      'rice': '🍚',
      'paddy': '🌾',
      'maize': '🌽',
      'corn': '🌽',
      'jowar': '🌾',
      'bajra': '🌾',
      'soybean': '🫘',
      'groundnut': '🥜',
      'mustard': '🌻',
      'sunflower': '🌻'
    };
    
    // Find matching emoji
    for (const [key, emoji] of Object.entries(imageMap)) {
      if (name.includes(key)) {
        return emoji;
      }
    }
    
    // Default emojis by category
    if (category === 'vegetables') return '🥬';
    if (category === 'fruits') return '🍎';
    if (category === 'grains') return '🌾';
    return '🏪';
  };

  const formatWeatherInfo = (weather: any) => {
    if (!weather || weather.error) return null;
    
    return {
      location: weather.name || locationName,
      temp: Math.round(weather.main?.temp || 0),
      description: weather.weather?.[0]?.description || "N/A",
      humidity: weather.main?.humidity || 0,
      windSpeed: weather.wind?.speed || 0,
      visibility: weather.visibility ? Math.round(weather.visibility / 1000) : 0,
      icon: weather.weather?.[0]?.icon || "01d"
    };
  };

  // Load all prices data on initial mount (no location filtering)
  useEffect(() => {
    getPricesForLocation();
  }, []); // Empty dependency array = run once on mount

  const { t } = useI18n();
  const weatherInfo = formatWeatherInfo(weather);
  const displayPrices = prices?.prices || { vegetables: [], fruits: [], grains: [] };
  const dataSource = prices?.source || "Loading...";
  const lastUpdated = prices?.last_updated;
  const totalRecords = prices?.total_records;
  const isLocationFiltered = prices?.prices?.location_filtered || false;
  const filteredStates = prices?.prices?.filtered_states || [];
  const filteredRecords = prices?.prices?.filtered_records || 0;
  const originalRecords = prices?.prices?.original_records || 0;

  return (
    <div className="container py-10">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-3xl font-bold">{t('nav.advisory')}</h1>
        <button 
          className="btn btn-primary flex items-center gap-2" 
          onClick={detectLocation}
          disabled={loadingLocation}
        >
          <MapPin className="w-4 h-4" />
          {loadingLocation ? "Detecting..." : "Use My Location"}
        </button>
      </div>

      {locationError && (
        <div className="bg-amber-600/20 border border-amber-600/30 rounded-lg p-4 mb-6">
          <p className="text-amber-200 text-sm">{locationError}</p>
          <p className="text-amber-300/70 text-xs mt-1">You can still enter coordinates manually below.</p>
        </div>
      )}

      {/* Location Input */}
      <div className="card mb-6">
        <h2 className="text-xl font-semibold mb-4">Location</h2>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <div>
            <label className="text-sm">{t('labels.latitude')}</label>
            <input 
              value={lat} 
              onChange={(e) => setLat(e.target.value)} 
              placeholder="e.g., 21.15"
              className="mt-1"
            />
          </div>
          <div>
            <label className="text-sm">{t('labels.longitude')}</label>
            <input 
              value={lon} 
              onChange={(e) => setLon(e.target.value)} 
              placeholder="e.g., 79.08"
              className="mt-1"
            />
          </div>
          <div className="flex items-end">
            <button 
              className="btn btn-secondary w-full" 
              onClick={getWeather}
              disabled={!lat || !lon || loadingWeather}
            >
              {loadingWeather ? "Loading..." : "Get Info"}
            </button>
          </div>
        </div>
        {locationName && (
          <div className="mt-3 flex items-center gap-2 text-sm text-white/70">
            <MapPin className="w-4 h-4" />
            <span>Location: {locationName}</span>
          </div>
        )}
      </div>

      {/* Weather Information */}
      {weatherInfo && (
        <div className="card mb-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-xl font-semibold">{t('feature.weather')}</h2>
            <div className="text-right">
              <p className="text-2xl font-bold">{weatherInfo.temp}°C</p>
              <p className="text-sm text-white/70 capitalize">{weatherInfo.description}</p>
            </div>
          </div>
          
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            <div className="flex items-center gap-2">
              <Droplets className="w-5 h-5 text-blue-400" />
              <div>
                <p className="text-sm text-white/70">Humidity</p>
                <p className="font-semibold">{weatherInfo.humidity}%</p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Wind className="w-5 h-5 text-green-400" />
              <div>
                <p className="text-sm text-white/70">Wind Speed</p>
                <p className="font-semibold">{weatherInfo.windSpeed} m/s</p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Eye className="w-5 h-5 text-purple-400" />
              <div>
                <p className="text-sm text-white/70">Visibility</p>
                <p className="font-semibold">{weatherInfo.visibility} km</p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <MapPin className="w-5 h-5 text-amber-400" />
              <div>
                <p className="text-sm text-white/70">Location</p>
                <p className="font-semibold text-sm">{weatherInfo.location}</p>
              </div>
            </div>
          </div>

          {/* Weather Recommendations */}
          <div className="mt-4 p-3 bg-emerald-600/10 border border-emerald-600/20 rounded-lg">
            <p className="text-sm text-emerald-200">
              <strong>Agricultural Advice:</strong> {weatherInfo.temp > 30 ? "Hot weather - ensure adequate irrigation" : weatherInfo.temp < 15 ? "Cool weather - protect sensitive crops" : "Good weather for farming activities"}. 
              {weatherInfo.humidity > 70 ? " High humidity may increase disease risk." : " Moderate humidity levels."}
            </p>
          </div>
        </div>
      )}

      {/* Market Prices */}
      <div className="space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <h2 className="text-2xl font-bold">{t('feature.prices')}</h2>
              {isLocationFiltered && (
                <span className="bg-green-600/20 text-green-300 text-xs px-2 py-1 rounded-full">
                  📍 Location-specific
                </span>
              )}
            </div>
            <div className="flex flex-wrap items-center gap-4 mt-2 text-sm text-white/60">
              <span>🇮🇳 {dataSource}</span>
              {isLocationFiltered && filteredRecords > 0 && (
                <span className="text-green-400">
                  🎯 {filteredRecords} nearby records (from {originalRecords} total)
                </span>
              )}
              {!isLocationFiltered && totalRecords && (
                <span>📈 {totalRecords} records</span>
              )}
              {lastUpdated && (
                <span>🕐 Updated: {new Date(lastUpdated).toLocaleDateString()}</span>
              )}
            </div>
            
            {/* Show filtered states */}
            {isLocationFiltered && filteredStates.length > 0 && (
              <div className="mt-2 p-2 bg-blue-600/10 border border-blue-600/20 rounded-lg">
                <p className="text-xs text-blue-200">
                  🗺️ Showing prices from nearby states: <span className="font-semibold">
                    {filteredStates.map(state => state.charAt(0).toUpperCase() + state.slice(1)).join(', ')}
                  </span>
                </p>
              </div>
            )}
          </div>
          <button 
            className="btn btn-primary flex items-center gap-2" 
            onClick={getPrices}
            disabled={loadingPrices}
          >
            {loadingPrices ? (
              <>
                <div className="animate-spin w-4 h-4 border-2 border-white border-t-transparent rounded-full"></div>
                Loading...
              </>
            ) : (
              <>
                🔄 Refresh Prices
              </>
            )}
          </button>
        </div>

        {/* Vegetables */}
        <div className="card">
          <div className="flex items-center justify-between mb-6">
            <h3 className="text-xl font-semibold text-green-400 flex items-center gap-2">
              🥬 Vegetables
            </h3>
            <span className="text-sm text-white/60 bg-green-600/20 px-2 py-1 rounded">
              {displayPrices.vegetables.length} items
            </span>
          </div>
          
          {displayPrices.vegetables.length === 0 ? (
            <div className="text-center py-8 text-white/60">
              <div className="text-4xl mb-2">🥬</div>
              <p>No vegetable prices available</p>
              <p className="text-sm mt-1">Try refreshing or check your location</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {displayPrices.vegetables.map((item, idx) => (
                <div key={idx} className="bg-gradient-to-br from-green-600/10 to-green-800/5 border border-green-600/20 rounded-xl p-4 hover:shadow-lg hover:shadow-green-900/20 transition-all">
                  <div className="flex items-start justify-between mb-3">
                    <div className="flex items-center gap-3">
                      <div className="text-2xl">
                        {getProductImage(item.name, 'vegetables')}
                      </div>
                      <div>
                        <h4 className="font-semibold text-white">{item.name}</h4>
                        {item.variety && item.variety !== 'FAQ' && (
                          <p className="text-xs text-green-300/80">{item.variety}</p>
                        )}
                      </div>
                    </div>
                  </div>
                  
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="text-sm text-white/70">Modal Price</span>
                      <span className="font-bold text-green-300">₹{item.price}/{item.unit}</span>
                    </div>
                    
                    {item.min_price && item.max_price && (
                      <div className="flex items-center justify-between text-xs">
                        <span className="text-white/50">Range</span>
                        <span className="text-white/70">₹{item.min_price} - ₹{item.max_price}</span>
                      </div>
                    )}
                    
                    <div className="pt-2 border-t border-green-600/20">
                      <p className="text-xs text-white/60 truncate" title={item.market}>
                        🏢 {item.market || 'Market info unavailable'}
                      </p>
                      {item.date && (
                        <p className="text-xs text-white/50 mt-1">
                          📅 {item.date}
                        </p>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Fruits */}
        <div className="card">
          <div className="flex items-center justify-between mb-6">
            <h3 className="text-xl font-semibold text-orange-400 flex items-center gap-2">
              🍎 Fruits
            </h3>
            <span className="text-sm text-white/60 bg-orange-600/20 px-2 py-1 rounded">
              {displayPrices.fruits.length} items
            </span>
          </div>
          
          {displayPrices.fruits.length === 0 ? (
            <div className="text-center py-8 text-white/60">
              <div className="text-4xl mb-2">🍎</div>
              <p>No fruit prices available</p>
              <p className="text-sm mt-1">Try refreshing or check your location</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {displayPrices.fruits.map((item, idx) => (
                <div key={idx} className="bg-gradient-to-br from-orange-600/10 to-orange-800/5 border border-orange-600/20 rounded-xl p-4 hover:shadow-lg hover:shadow-orange-900/20 transition-all">
                  <div className="flex items-start justify-between mb-3">
                    <div className="flex items-center gap-3">
                      <div className="text-2xl">
                        {getProductImage(item.name, 'fruits')}
                      </div>
                      <div>
                        <h4 className="font-semibold text-white">{item.name}</h4>
                        {item.variety && item.variety !== 'FAQ' && (
                          <p className="text-xs text-orange-300/80">{item.variety}</p>
                        )}
                      </div>
                    </div>
                  </div>
                  
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="text-sm text-white/70">Modal Price</span>
                      <span className="font-bold text-orange-300">₹{item.price}/{item.unit}</span>
                    </div>
                    
                    {item.min_price && item.max_price && (
                      <div className="flex items-center justify-between text-xs">
                        <span className="text-white/50">Range</span>
                        <span className="text-white/70">₹{item.min_price} - ₹{item.max_price}</span>
                      </div>
                    )}
                    
                    <div className="pt-2 border-t border-orange-600/20">
                      <p className="text-xs text-white/60 truncate" title={item.market}>
                        🏢 {item.market || 'Market info unavailable'}
                      </p>
                      {item.date && (
                        <p className="text-xs text-white/50 mt-1">
                          📅 {item.date}
                        </p>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Grains & Commodities */}
        <div className="card">
          <div className="flex items-center justify-between mb-6">
            <h3 className="text-xl font-semibold text-amber-400 flex items-center gap-2">
              🌾 Grains & Commodities
            </h3>
            <span className="text-sm text-white/60 bg-amber-600/20 px-2 py-1 rounded">
              {displayPrices.grains.length} items
            </span>
          </div>
          
          {displayPrices.grains.length === 0 ? (
            <div className="text-center py-8 text-white/60">
              <div className="text-4xl mb-2">🌾</div>
              <p>No grain/commodity prices available</p>
              <p className="text-sm mt-1">Try refreshing or check your location</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {displayPrices.grains.map((item, idx) => (
                <div key={idx} className="bg-gradient-to-br from-amber-600/10 to-amber-800/5 border border-amber-600/20 rounded-xl p-4 hover:shadow-lg hover:shadow-amber-900/20 transition-all">
                  <div className="flex items-start justify-between mb-3">
                    <div className="flex items-center gap-3">
                      <div className="text-2xl">
                        {getProductImage(item.name, 'grains')}
                      </div>
                      <div>
                        <h4 className="font-semibold text-white">{item.name}</h4>
                        {item.variety && item.variety !== 'FAQ' && (
                          <p className="text-xs text-amber-300/80">{item.variety}</p>
                        )}
                      </div>
                    </div>
                  </div>
                  
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="text-sm text-white/70">Modal Price</span>
                      <span className="font-bold text-amber-300">₹{item.price}/{item.unit}</span>
                    </div>
                    
                    {item.min_price && item.max_price && (
                      <div className="flex items-center justify-between text-xs">
                        <span className="text-white/50">Range</span>
                        <span className="text-white/70">₹{item.min_price} - ₹{item.max_price}</span>
                      </div>
                    )}
                    
                    <div className="pt-2 border-t border-amber-600/20">
                      <p className="text-xs text-white/60 truncate" title={item.market}>
                        🏢 {item.market || 'Market info unavailable'}
                      </p>
                      {item.date && (
                        <p className="text-xs text-white/50 mt-1">
                          📅 {item.date}
                        </p>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Data Source Disclaimer */}
        <div className="text-center p-6 bg-gradient-to-r from-blue-600/10 via-green-600/10 to-amber-600/10 border border-blue-600/20 rounded-xl">
          <div className="flex items-center justify-center gap-2 mb-3">
            <span className="text-2xl">🇮🇳</span>
            <h4 className="text-lg font-semibold text-white">Official Government Data</h4>
            {isLocationFiltered && (
              <span className="bg-green-600/30 text-green-200 text-xs px-2 py-1 rounded">
                Location-Filtered
              </span>
            )}
          </div>
          <p className="text-sm text-blue-200 mb-2">
            💡 Market prices are sourced from <strong>Government of India's data.gov.in</strong> portal,
            {isLocationFiltered ? 
              " filtered to show prices from markets near your location." : 
              " providing real-time mandi rates from across the country."
            }
          </p>
          {locationName && (
            <p className="text-xs text-white/70">
              📍 Location: {locationName}
              {isLocationFiltered && filteredStates.length > 0 && (
                <span> | Nearby states: {filteredStates.slice(0, 3).map(s => s.split(' ').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ')).join(', ')}</span>
              )}
            </p>
          )}
          <div className="flex items-center justify-center gap-6 mt-4 text-xs text-white/60">
            <span>✓ Real-time Data</span>
            <span>✓ Government Verified</span>
            {isLocationFiltered ? (
              <span>✓ Location-Specific</span>
            ) : (
              <span>✓ Multiple Markets</span>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
