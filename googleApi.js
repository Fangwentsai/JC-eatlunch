const axios = require('axios');

// 搜尋附近餐廳的函數
async function searchNearbyPlaces(lat, lng, keyword, radius = 1500, minPriceLevel, maxPriceLevel) {
  try {
    // 構建基本查詢參數
    const params = {
      location: `${lat},${lng}`,
      radius: radius,
      type: 'restaurant',
      keyword: keyword,
      opennow: true,
      key: process.env.GOOGLE_MAPS_API_KEY
    };
    
    // 根據指定的價格範圍添加參數
    if (minPriceLevel !== undefined && minPriceLevel !== null) {
      params.minprice = minPriceLevel;
    }
    
    if (maxPriceLevel !== undefined && maxPriceLevel !== null) {
      params.maxprice = maxPriceLevel;
    }
    
    // 呼叫 Google Places API Nearby Search
    const response = await axios.get('https://maps.googleapis.com/maps/api/place/nearbysearch/json', {
      params: params
    });
    
    if (response.data.status === 'OK') {
      return response.data.results;
    } else {
      console.error('Google Places API 返回錯誤:', response.data.status);
      return [];
    }
  } catch (error) {
    console.error('搜尋附近餐廳錯誤:', error);
    return [];
  }
}

// 獲取餐廳詳細資訊的函數
async function getPlaceDetails(placeId) {
  try {
    const params = {
      place_id: placeId,
      fields: [
        'name',
        'formatted_address',
        'vicinity',
        'geometry',
        'rating',
        'user_ratings_total',
        'photos',
        'reviews',
        'website',
        'url',
        'price_level',
        'serves_delivery'
      ].join(','), // 組合成逗號分隔字符串
      key: process.env.GOOGLE_MAPS_API_KEY
    };
    
    // 呼叫 Google Places API Place Details
    const response = await axios.get('https://maps.googleapis.com/maps/api/place/details/json', {
      params: params
    });
    
    if (response.data.status === 'OK') {
      return response.data.result;
    } else {
      console.error('Google Place Details API 返回錯誤:', response.data.status);
      return {};
    }
  } catch (error) {
    console.error('獲取餐廳詳細資訊錯誤:', error);
    return {};
  }
}

// 計算步行時間的函數
async function calculateWalkingDistances(userLocation, places) {
  try {
    if (!places || places.length === 0) {
      return [];
    }
    
    // 準備 Distance Matrix API 的參數
    const origin = `${userLocation.latitude},${userLocation.longitude}`;
    
    // 從地點列表中獲取目的地經緯度
    const destinations = places.map(place => {
      const lat = place.geometry.location.lat;
      const lng = place.geometry.location.lng;
      return `${lat},${lng}`;
    }).join('|');
    
    const params = {
      origins: origin,
      destinations: destinations,
      mode: 'walking',
      key: process.env.GOOGLE_MAPS_API_KEY
    };
    
    // 呼叫 Google Distance Matrix API
    const response = await axios.get('https://maps.googleapis.com/maps/api/distancematrix/json', {
      params: params
    });
    
    if (response.data.status === 'OK') {
      // 將步行時間添加到每個地點對象中
      return places.map((place, index) => {
        const distanceInfo = response.data.rows[0].elements[index];
        let walkingDuration = null;
        
        if (distanceInfo && distanceInfo.status === 'OK') {
          walkingDuration = distanceInfo.duration.value; // 步行時間（秒）
        }
        
        return {
          ...place,
          walkingDuration: walkingDuration
        };
      });
    } else {
      console.error('Google Distance Matrix API 返回錯誤:', response.data.status);
      return places;
    }
  } catch (error) {
    console.error('計算步行時間錯誤:', error);
    return places;
  }
}

module.exports = {
  searchNearbyPlaces,
  getPlaceDetails,
  calculateWalkingDistances
}; 