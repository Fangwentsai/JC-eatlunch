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
    // 檢查placeId是否有效
    if (!placeId) {
      console.error('Google Place Details API 錯誤: placeId為空');
      return {};
    }

    // 定義需要獲取的字段 - 簡化字段列表，只保留基本必要字段
    const fields = [
      'name',
      'formatted_address',
      'geometry',
      'rating',
      'user_ratings_total',
      'photos',
      'vicinity'
    ];

    // 構建參數
    const params = {
      place_id: placeId,
      fields: fields.join(','), // 組合成逗號分隔字符串
      key: process.env.GOOGLE_MAPS_API_KEY
    };
    
    console.log('Google Place Details API 請求參數:', {
      place_id: params.place_id,
      fields: params.fields,
      key: params.key ? '已設置' : '未設置'
    });
    
    // 呼叫 Google Places API Place Details
    const response = await axios.get('https://maps.googleapis.com/maps/api/place/details/json', {
      params: params
    });
    
    if (response.data.status === 'OK') {
      return response.data.result;
    } else {
      console.error('Google Place Details API 返回錯誤:', response.data.status);
      console.error('錯誤詳情:', response.data.error_message || '無錯誤詳情');
      console.error('請求參數:', {
        place_id: params.place_id,
        fields: params.fields
      });
      
      // 嘗試不帶fields參數再次請求
      if (response.data.status === 'INVALID_REQUEST') {
        console.log('嘗試不帶fields參數再次請求...');
        const fallbackParams = {
          place_id: placeId,
          key: process.env.GOOGLE_MAPS_API_KEY
        };
        
        try {
          const fallbackResponse = await axios.get('https://maps.googleapis.com/maps/api/place/details/json', {
            params: fallbackParams
          });
          
          if (fallbackResponse.data.status === 'OK') {
            console.log('不帶fields參數的請求成功');
            return fallbackResponse.data.result;
          } else {
            console.error('不帶fields參數的請求也失敗:', fallbackResponse.data.status);
          }
        } catch (fallbackError) {
          console.error('執行後備請求時出錯:', fallbackError.message);
        }
      }
      
      return {};
    }
  } catch (error) {
    console.error('獲取餐廳詳細資訊錯誤:', error.message);
    console.error('錯誤堆疊:', error.stack);
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