const { saveUserData, saveUserPreference, getUserData } = require('./firebase');
const { 
  searchNearbyPlaces, 
  getPlaceDetails, 
  calculateWalkingDistances 
} = require('./googleApi');
const { generateResponse, enhanceRestaurantDescription, analyzeUserPreference } = require('./gemini');

// 處理文字消息
async function handleText(client, event, profile) {
  const { text } = event.message;
  const userId = profile.userId;
  
  // 檢查是否是問候語
  const greetings = ['hi', 'hello', '你好', '您好', '嗨', '哈囉', 'hey', '嘿', '早安', '午安', '晚安'];
  const isGreeting = greetings.some(greeting => 
    text.toLowerCase().includes(greeting.toLowerCase())
  );
  
  // 獲取用戶數據
  const userData = await getUserData(userId);
  
  // 處理問候語或初次對話
  if (isGreeting || !userData || !userData.diningPurpose) {
    // 準備個性化問候語
    const greeting = userData && userData.displayName 
      ? `${userData.displayName}，您好！` 
      : '您好！';

    // 發送用餐目的選擇按鈕
    return client.replyMessage(event.replyToken, {
      type: 'template',
      altText: '請選擇您的用餐目的',
      template: {
        type: 'buttons',
        title: '上班吃什麼？',
        text: `${greeting}請問今天的用餐目的是什麼呢？`,
        actions: [
          {
            type: 'postback',
            label: '🍱 小資族午餐',
            data: 'action=diningPurpose&purpose=worker'
          },
          {
            type: 'postback',
            label: '🍽️ 高級商業聚餐',
            data: 'action=diningPurpose&purpose=business'
          }
        ]
      }
    });
  }
  
  // 提取食物關鍵字
  const foodKeyword = extractFoodKeyword(text);

  // 優先處理：如果機器人剛詢問完用餐目的，正在等待食物偏好
  if (userData && userData.diningPurpose && userData.awaitingFoodPreference) {
    // 將提取的食物關鍵字視為食物偏好
    await saveUserPreference(userId, foodKeyword); 
    // 清除等待標記，同時確保 diningPurpose 仍然存在
    await saveUserData(userId, profile.displayName, { 
      diningPurpose: userData.diningPurpose,
      foodPreference: foodKeyword,
      awaitingFoodPreference: false 
    });

    // 檢查是否已有位置信息
    const freshUserData = await getUserData(userId);
    if (freshUserData && freshUserData.location) {
      return startRestaurantSearch(client, event, profile, freshUserData.diningPurpose, freshUserData.foodPreference, freshUserData.location);
    } else {
      // 請求用戶分享位置
      return client.replyMessage(event.replyToken, {
        type: 'text',
        text: `收到【${foodKeyword}】！為了幫您找到附近的餐廳，請分享您的目前位置。`,
        quickReply: {
          items: [
            {
              type: 'action',
              action: {
                type: 'location',
                label: '分享位置'
              }
            }
          ]
        }
      });
    }
  }
  
  // 處理初次對話或簡單問候 - 移除這個部分，因為已經在前面處理了
  // if (
  //   !userData || 
  //   !userData.diningPurpose || 
  //   text.toLowerCase().includes('hi') || 
  //   text.toLowerCase().includes('hello') || 
  //   text.includes('你好') || 
  //   text.includes('您好') || 
  //   text.includes('嗨') ||
  //   text.includes('吃什麼') ||
  //   text.includes('午餐') ||
  //   text.includes('中餐')
  // ) {
  //   // 準備個性化問候語
  //   const greeting = userData && userData.displayName 
  //     ? `${userData.displayName}，您好！` 
  //     : '您好！';

  //   // 發送用餐目的選擇按鈕
  //   return client.replyMessage(event.replyToken, {
  //     type: 'template',
  //     altText: '請選擇您的用餐目的',
  //     template: {
  //       type: 'buttons',
  //       title: '上班吃什麼？',
  //       text: `${greeting}請問今天的用餐目的是什麼呢？`,
  //       actions: [
  //         {
  //           type: 'postback',
  //           label: '🍱 小資族午餐',
  //           data: 'action=diningPurpose&purpose=worker'
  //         },
  //         {
  //           type: 'postback',
  //           label: '🍽️ 高級商業聚餐',
  //           data: 'action=diningPurpose&purpose=business'
  //         }
  //       ]
  //     }
  //   });
  // } 
  // 用戶已經選擇了用餐目的，但還沒有輸入料理偏好
  else if (userData.diningPurpose && !userData.foodPreference) {
    // 保存用戶的料理偏好
    await saveUserPreference(userId, foodKeyword);
    
    // 如果用戶已經分享了位置，可以直接開始搜尋餐廳
    if (userData.location) {
      return startRestaurantSearch(client, event, profile, userData.diningPurpose, foodKeyword, userData.location);
    }
    
    // 否則請求用戶分享位置
    return client.replyMessage(event.replyToken, {
      type: 'text',
      text: `收到！為了幫您找到附近的${foodKeyword}，請分享您的目前位置。`,
      quickReply: {
        items: [
          {
            type: 'action',
            action: {
              type: 'location',
              label: '分享位置'
            }
          }
        ]
      }
    });
  } 
  // 用戶已經有完整資料，檢查是否在詢問特定餐廳或想要推薦
  else if (text.includes('推薦') || text.includes('建議') || text.includes('你覺得')) {
    try {
      // 分析用戶偏好歷史
      const preferenceAnalysis = await analyzeUserPreference(userData);
      
      let aiPrompt = `使用者想要關於餐廳的推薦。他問的問題是: "${text}"。`;
      
      if (preferenceAnalysis.preferences.length > 0) {
        aiPrompt += `根據他過去的搜尋紀錄，他可能喜歡這些類型的料理: ${preferenceAnalysis.preferences.join(', ')}。`;
      }
      
      if (preferenceAnalysis.suggestion) {
        aiPrompt += `你可以考慮推薦他: ${preferenceAnalysis.suggestion}，或類似的食物。`;
      }
      
      aiPrompt += '請給予簡短、活潑且有用的餐飲建議。回覆必須是中文，不要超過100字。';
      
      // 使用 OpenAI 產生回覆
      const aiResponse = await generateResponse(aiPrompt, []);
      
      // 使用 AI 回覆
      return client.replyMessage(event.replyToken, {
        type: 'text',
        text: aiResponse
      });
    } catch (error) {
      console.error('AI 推薦生成錯誤:', error);
      // 發生錯誤時，提供一個通用回覆
      return client.replyMessage(event.replyToken, {
        type: 'text',
        text: '很高興為您提供推薦！請告訴我您今天想吃什麼類型的料理呢？'
      });
    }
  }
  // 用戶已經有完整資料，這是一個新的搜尋
  else {
    // 更新用戶的料理偏好
    await saveUserPreference(userId, foodKeyword);
    
    if (userData.location) {
      return startRestaurantSearch(client, event, profile, userData.diningPurpose, foodKeyword, userData.location);
    } else {
      // 請求用戶分享位置
      return client.replyMessage(event.replyToken, {
        type: 'text',
        text: `收到！為了幫您找到附近的${foodKeyword}，請分享您的目前位置。`,
        quickReply: {
          items: [
            {
              type: 'action',
              action: {
                type: 'location',
                label: '分享位置'
              }
            }
          ]
        }
      });
    }
  }
}

// 處理位置消息
async function handleLocation(client, event, profile) {
  const { latitude, longitude } = event.message;
  const userId = profile.userId;
  
  // 保存用戶位置
  const location = { latitude, longitude };
  await saveUserData(userId, profile.displayName, { location });
  
  // 獲取用戶數據
  const userData = await getUserData(userId);
  
  // 如果用戶已經選擇了用餐目的和料理偏好，開始搜尋餐廳
  if (userData && userData.diningPurpose && userData.foodPreference) {
    return startRestaurantSearch(
      client, 
      event, 
      profile, 
      userData.diningPurpose, 
      userData.foodPreference,
      location
    );
  }
  
  // 如果用戶尚未選擇用餐目的，請求用戶選擇
  if (!userData || !userData.diningPurpose) {
    // 準備個性化問候語
    const greeting = userData && userData.displayName 
      ? `${userData.displayName}，您好！` 
      : '您好！';
      
    // 發送用餐目的選擇按鈕
    return client.replyMessage(event.replyToken, {
      type: 'template',
      altText: '請選擇您的用餐目的',
      template: {
        type: 'buttons',
        title: '上班吃什麼？',
        text: `${greeting}請問今天的用餐目的是什麼呢？`,
        actions: [
          {
            type: 'postback',
            label: '🍱 小資族午餐',
            data: 'action=diningPurpose&purpose=worker'
          },
          {
            type: 'postback',
            label: '🍽️ 高級商業聚餐',
            data: 'action=diningPurpose&purpose=business'
          }
        ]
      }
    });
  }
  
  // 如果用戶尚未輸入料理偏好，請求用戶輸入
  // 使用用戶暱稱進行個性化問候
  const nickname = userData && userData.displayName ? userData.displayName : '';
  const greeting = nickname ? `${nickname}，` : '';
  
  return client.replyMessage(event.replyToken, {
    type: 'text',
    text: `好的，${greeting}我已記錄您的位置。今天想吃點什麼呢？例如：飯類、麵食、日式、泰式、或其他你想到的關鍵字？`
  });
}

// 開始餐廳搜尋流程
async function startRestaurantSearch(client, event, profile, diningPurpose, foodPreference, location) {
  try {
    // 告知用戶搜尋已開始
    await client.replyMessage(event.replyToken, {
      type: 'text',
      text: `收到！正在為您尋找附近的${foodPreference}...`
    });
    
    // 設置價格級別
    const priceLevel = diningPurpose === 'worker' 
      ? { min: 1, max: 2 }   // 小資族價格範圍
      : { min: 3, max: 4 };  // 商業聚餐價格範圍
    
    // 步驟1：用 Google Places API 搜尋附近餐廳
    const nearbyPlaces = await searchNearbyPlaces(
      location.latitude,
      location.longitude,
      foodPreference,
      1500, // 搜尋半徑 1.5 公里
      priceLevel.min,
      priceLevel.max
    );
    
    if (!nearbyPlaces || nearbyPlaces.length === 0) {
      // 找不到餐廳，通知用戶
      await client.pushMessage(profile.userId, {
        type: 'text',
        text: `抱歉，在您附近找不到符合條件的${foodPreference}餐廳。`
      });
      return;
    }
    
    let selectedRestaurants = [];
    
    // 根據用餐目的處理餐廳推薦
    if (diningPurpose === 'worker') { // 小資族午餐
      // 步驟2：初步篩選餐廳 (選取評分較高的前10-12家)
      const initialFiltered = nearbyPlaces
        .sort((a, b) => (b.rating || 0) - (a.rating || 0))
        .slice(0, 12);
      
      // 步驟3：計算步行時間
      const restaurantsWithTime = await calculateWalkingDistances(
        location,
        initialFiltered
      );
      
      // 步驟4：最終分組與選擇
      // 找出步行10分鐘內的餐廳
      const nearbyRestaurants = restaurantsWithTime
        .filter(r => r.walkingDuration <= 10 * 60) // 轉換為秒
        .sort((a, b) => (b.rating || 0) - (a.rating || 0))
        .slice(0, 3);
      
      // 找出步行10-15分鐘的餐廳
      const furtherRestaurants = restaurantsWithTime
        .filter(r => r.walkingDuration > 10 * 60 && r.walkingDuration <= 15 * 60)
        .sort((a, b) => (b.rating || 0) - (a.rating || 0))
        .slice(0, 2);
      
      selectedRestaurants = [...nearbyRestaurants, ...furtherRestaurants];
    } else { // 商業聚餐
      // 直接選擇評分最高的5家餐廳
      selectedRestaurants = nearbyPlaces
        .sort((a, b) => {
          // 首先按評分排序
          const ratingDiff = (b.rating || 0) - (a.rating || 0);
          if (ratingDiff !== 0) return ratingDiff;
          
          // 評分相同時，按評論數排序
          return (b.user_ratings_total || 0) - (a.user_ratings_total || 0);
        })
        .slice(0, 5);
    }
    
    if (selectedRestaurants.length === 0) {
      await client.pushMessage(profile.userId, {
        type: 'text',
        text: `抱歉，在您附近找不到符合條件的${foodPreference}餐廳。`
      });
      return;
    }
    
    // 步驟5：獲取每家餐廳的詳細信息
    console.log(`開始獲取${selectedRestaurants.length}家餐廳的詳細信息`);
    const restaurantDetails = [];
    
    for (const restaurant of selectedRestaurants) {
      try {
        console.log(`正在獲取餐廳詳情，place_id: ${restaurant.place_id}`);
        const details = await getPlaceDetails(restaurant.place_id);
        
        // 檢查返回的詳情是否為空對象
        if (Object.keys(details).length === 0) {
          console.warn(`餐廳詳情為空，使用基本信息代替，place_id: ${restaurant.place_id}`);
          // 使用搜索結果中的基本信息
          restaurantDetails.push({
            name: restaurant.name,
            vicinity: restaurant.vicinity,
            formatted_address: restaurant.vicinity,
            geometry: restaurant.geometry,
            rating: restaurant.rating,
            user_ratings_total: restaurant.user_ratings_total,
            photos: restaurant.photos
          });
        } else {
          restaurantDetails.push(details);
        }
      } catch (error) {
        console.error(`獲取餐廳詳情失敗，place_id: ${restaurant.place_id}`, error);
        // 使用搜索結果中的基本信息
        restaurantDetails.push({
          name: restaurant.name,
          vicinity: restaurant.vicinity,
          formatted_address: restaurant.vicinity,
          geometry: restaurant.geometry,
          rating: restaurant.rating,
          user_ratings_total: restaurant.user_ratings_total,
          photos: restaurant.photos
        });
      }
    }
    
    // 步驟6：為每家餐廳添加 AI 生成的描述
    const enhancedRestaurants = [];
    
    for (let i = 0; i < restaurantDetails.length; i++) {
      const restaurant = {
        ...restaurantDetails[i],
        ...selectedRestaurants[i]
      };
      
      // 使用 Gemini 為餐廳添加描述
      try {
        console.log(`正在生成餐廳描述，餐廳名稱: ${restaurant.name}`);
        const aiDescription = await enhanceRestaurantDescription(restaurant, foodPreference);
        restaurant.aiDescription = aiDescription;
      } catch (error) {
        console.error(`餐廳描述生成錯誤，餐廳名稱: ${restaurant.name}`, error);
        restaurant.aiDescription = `推薦您品嚐這家${foodPreference}餐廳！`;
      }
      
      enhancedRestaurants.push(restaurant);
    }
    
    // 步驟7：創建餐廳 Carousel
    const carouselContents = createRestaurantCarousel(
      enhancedRestaurants,
      diningPurpose,
      foodPreference
    );
    
    // 發送 Carousel 給用戶
    await client.pushMessage(profile.userId, carouselContents);
    
    // 發送 AI 建議訊息，使用實際找到的餐廳資訊
    const restaurantNames = enhancedRestaurants.map(r => r.name).join('、');
    const aiPrompt = `
我剛剛幫用戶搜尋了${foodPreference}的餐廳，找到了這些餐廳：${restaurantNames}。
請根據這些實際找到的餐廳，給用戶一些具體的推薦和建議，讓他們更好地選擇。
請在回覆中明確提及這些餐廳的名稱，並根據它們的特點給出建議。

重要排版要求：
1. 每介紹完一間餐廳後換行，使用兩個換行符分隔不同餐廳的介紹
2. 整體排版要清晰易讀，避免長段落
3. 總字數控制在150字以內

建議應該簡短、活潑、友善，必須使用中文。
`;

    try {
      const aiSuggestion = await generateResponse(aiPrompt);
      await client.pushMessage(profile.userId, {
        type: 'text',
        text: aiSuggestion
      });
    } catch (error) {
      console.error('AI 建議生成錯誤:', error);
    }
    
  } catch (error) {
    console.error('Restaurant search error:', error);
    await client.pushMessage(profile.userId, {
      type: 'text',
      text: '抱歉，搜尋餐廳時發生錯誤。請稍後再試。'
    });
  }
}

// 創建餐廳 Carousel
function createRestaurantCarousel(enhancedRestaurants, diningPurpose, userPreference) {
  // 創建 Carousel 卡片
  const columns = enhancedRestaurants.map(restaurant => {
    // 獲取餐廳照片 URL
    const photoUrl = restaurant.photos && restaurant.photos.length > 0
      ? `https://maps.googleapis.com/maps/api/place/photo?maxwidth=400&photoreference=${restaurant.photos[0].photo_reference}&key=${process.env.GOOGLE_MAPS_API_KEY}`
      : 'https://via.placeholder.com/400x200?text=No+Image';
    
    // 取得簡短地址 (如果與用戶在同一縣市)
    const shortAddress = restaurant.vicinity || restaurant.formatted_address || '未提供地址';
    
    // 取得評分和評論
    const rating = restaurant.rating ? `⭐ ${restaurant.rating} (${restaurant.user_ratings_total}則評論)` : '尚未有評分';
    
    // 步行時間 (只有社畜才顯示)
    let walkingInfo = '';
    if (diningPurpose === 'worker' && restaurant.walkingDuration) {
      const minutes = Math.round(restaurant.walkingDuration / 60);
      walkingInfo = `🚶 步行約 ${minutes} 分鐘\n`;
    }
    
    // 使用 AI 生成的描述或預設描述
    let description;
    if (restaurant.aiDescription) {
      description = restaurant.aiDescription;
    } else {
      // 評論摘要作為備用
      let reviewSummary = '';
      if (restaurant.reviews && restaurant.reviews.length > 0) {
        const topReviews = restaurant.reviews.slice(0, 1);
        reviewSummary = topReviews.map(review => 
          `"${review.text.substring(0, 30)}${review.text.length > 30 ? '...' : ''}"`
        ).join('');
      }
      description = reviewSummary || `推薦您品嚐這家${userPreference}餐廳！`;
    }
    
    // 建立 CTA 按鈕
    const actions = [];
    
    // Google Map 導航按鈕
    actions.push({
      type: 'uri',
      label: '🗺️ Google導航',
      uri: `https://www.google.com/maps/dir/?api=1&destination=${restaurant.geometry.location.lat},${restaurant.geometry.location.lng}&travelmode=walking`
    });
    
    // 外送按鈕 (如果有提供外送)
    if (restaurant.serves_delivery) {
      // UberEats 按鈕 (假設連結格式)
      actions.push({
        type: 'uri',
        label: '🛵 UberEats叫餐',
        uri: `https://www.ubereats.com/search?q=${encodeURIComponent(restaurant.name)}`
      });
      
      // 如果按鈕不超過4個，再加入 Foodpanda 按鈕
      if (actions.length < 4) {
        actions.push({
          type: 'uri',
          label: '🐼 Foodpanda叫餐',
          uri: `https://www.foodpanda.com.tw/search?q=${encodeURIComponent(restaurant.name)}`
        });
      }
    }
    
    // 生成卡片內容
    return {
      thumbnailImageUrl: photoUrl,
      title: restaurant.name.substring(0, 40), // LINE 限制標題長度
      text: `${walkingInfo}${rating}\n${description}`.substring(0, 60), // LINE 限制內文長度
      actions: actions
    };
  });
  
  return {
    type: 'template',
    altText: '為您找到的餐廳',
    template: {
      type: 'carousel',
      columns: columns
    }
  };
}

// 從用戶輸入中提取食物關鍵字
function extractFoodKeyword(text) {
  // 常見的表達想吃某種食物的前綴
  const prefixes = [
    '我想吃', '想吃', '我要吃', '要吃', '我喜歡', '喜歡吃', 
    '我愛', '愛吃', '我想來', '想來', '我要來', '要來',
    '我想點', '想點', '我要點', '要點', '我想要', '想要'
  ];
  
  // 檢查是否包含這些前綴，如果有則提取後面的關鍵字
  for (const prefix of prefixes) {
    if (text.includes(prefix)) {
      const keyword = text.split(prefix)[1].trim();
      if (keyword) {
        return keyword;
      }
    }
  }
  
  // 如果沒有找到前綴，則返回原文本
  return text;
}

module.exports = {
  handleText,
  handleLocation
}; 