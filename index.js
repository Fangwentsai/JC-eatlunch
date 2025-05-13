// 嘗試禁用OpenSSL FIPS模式，修復DECODER routines::unsupported錯誤
try {
  process.env.NODE_OPTIONS = process.env.NODE_OPTIONS || '';
  if (!process.env.NODE_OPTIONS.includes('--openssl-legacy-provider')) {
    process.env.NODE_OPTIONS += ' --openssl-legacy-provider';
    console.log('已設置OpenSSL傳統提供者模式');
  }
} catch (e) {
  console.log('設置OpenSSL配置失敗:', e.message);
}

require('dotenv').config();
const express = require('express');
const line = require('@line/bot-sdk');
const { initializeFirebase, saveUserData, saveUserPreference, saveUserChoice, testFirebaseConnection, testWriteData } = require('./firebase');
const { handleText, handleLocation } = require('./messageHandler');

// LINE Bot SDK 配置
const lineConfig = {
  channelAccessToken: process.env.LINE_CHANNEL_ACCESS_TOKEN,
  channelSecret: process.env.LINE_CHANNEL_SECRET
};

// 初始化 Express 和 LINE Bot
const app = express();
const client = new line.Client(lineConfig);

// 初始化 Firebase
initializeFirebase();

// 解析 LINE 的 Webhook
app.post('/webhook', line.middleware(lineConfig), (req, res) => {
  Promise.all(req.body.events.map(handleEvent))
    .then((result) => res.json(result))
    .catch((err) => {
      console.error(err);
      res.status(500).end();
    });
});

// 處理來自 LINE 的事件
async function handleEvent(event) {
  if (event.type !== 'message' && event.type !== 'postback') {
    // 忽略非消息和非postback事件
    return Promise.resolve(null);
  }
  
  const userId = event.source.userId;
  
  try {
    // 獲取用戶資料
    const profile = await client.getProfile(userId);
    
    // 根據事件類型處理
    if (event.type === 'message') {
      const message = event.message;
      
      switch (message.type) {
        case 'text':
          return handleText(client, event, profile);
        case 'location':
          return handleLocation(client, event, profile);
        default:
          // 處理其他類型的消息
          return client.replyMessage(event.replyToken, {
            type: 'text',
            text: '很抱歉，我只能處理文字訊息和位置訊息。'
          });
      }
    } 
    else if (event.type === 'postback') {
      // 處理 postback 事件
      const { data } = event.postback;
      return handlePostback(client, event, profile, data);
    }
  } catch (error) {
    console.error('Error handling event:', error);
    
    // 返回錯誤訊息給用戶
    return client.replyMessage(event.replyToken, {
      type: 'text',
      text: '抱歉，處理您的請求時發生錯誤。'
    });
  }
}

// 處理 postback 事件的函數
async function handlePostback(client, event, profile, data) {
  const postbackData = new URLSearchParams(data);
  const action = postbackData.get('action');
  const placeId = postbackData.get('placeId');
  
  // 根據不同的 action 處理不同的 postback
  switch (action) {
    case 'navigate':
      // 記錄用戶選擇了導航
      await saveUserChoice(profile.userId, placeId, 'navigate');
      return Promise.resolve(null); // 用戶將被重定向到 Google Maps，不需回復
    
    case 'uberEats':
      // 記錄用戶選擇了 UberEats
      await saveUserChoice(profile.userId, placeId, 'uberEats');
      return Promise.resolve(null); // 用戶將被重定向到 UberEats，不需回復
    
    case 'foodpanda':
      // 記錄用戶選擇了 Foodpanda
      await saveUserChoice(profile.userId, placeId, 'foodpanda');
      return Promise.resolve(null); // 用戶將被重定向到 Foodpanda，不需回復
    
    case 'diningPurpose':
      const purpose = postbackData.get('purpose');
      // 保存用戶的用餐目的，並標記正在等待食物偏好
      await saveUserData(profile.userId, profile.displayName, { diningPurpose: purpose, awaitingFoodPreference: true });
      
      // 使用用戶暱稱進行個性化問候
      const nickname = profile.displayName ? `${profile.displayName}，` : '';
      
      // 回覆詢問用戶想吃什麼
      return client.replyMessage(event.replyToken, {
        type: 'text',
        text: `好的${nickname}是${purpose === 'worker' ? '🍱 我是社畜吃中餐' : '🍽️ 高級商業聚餐'}！那今天想吃點什麼呢？例如：飯類、麵食、日式、泰式、或其他你想到的關鍵字？`
      });
    
    default:
      return client.replyMessage(event.replyToken, {
        type: 'text',
        text: '抱歉，我無法處理這個請求。'
      });
  }
}

// 添加Firebase測試路由
app.get('/test-firebase', async (req, res) => {
  try {
    const result = await testFirebaseConnection();
    res.json(result);
  } catch (error) {
    res.status(500).json({
      success: false,
      message: '測試Firebase連接時發生錯誤',
      error: error.message,
      stack: error.stack
    });
  }
});

// 添加Firebase數據寫入測試路由
app.get('/test-firebase-write', async (req, res) => {
  try {
    const result = await testWriteData();
    res.json(result);
  } catch (error) {
    res.status(500).json({
      success: false,
      message: '測試Firebase寫入數據時發生錯誤',
      error: error.message,
      stack: error.stack
    });
  }
});

// 添加Google Maps API測試路由
app.get('/test-google-maps', async (req, res) => {
  try {
    const { searchNearbyPlaces } = require('./googleApi');
    
    // 測試座標 (台北101)
    const lat = 25.033964;
    const lng = 121.564468;
    
    // 測試搜索附近餐廳
    const results = await searchNearbyPlaces(lat, lng, '餐廳', 1000, null, null);
    
    if (results && results.length > 0) {
      res.json({
        success: true,
        message: '成功連接Google Maps API',
        restaurantsFound: results.length,
        firstRestaurant: results[0]
      });
    } else {
      res.json({
        success: false,
        message: 'Google Maps API連接成功，但未找到餐廳',
        apiKey: process.env.GOOGLE_MAPS_API_KEY ? '已設置' : '未設置',
        apiKeyFirstChars: process.env.GOOGLE_MAPS_API_KEY ? `${process.env.GOOGLE_MAPS_API_KEY.substring(0, 5)}...` : '無'
      });
    }
  } catch (error) {
    res.status(500).json({
      success: false,
      message: '測試Google Maps API時發生錯誤',
      error: error.message,
      apiKey: process.env.GOOGLE_MAPS_API_KEY ? '已設置' : '未設置',
      apiKeyFirstChars: process.env.GOOGLE_MAPS_API_KEY ? `${process.env.GOOGLE_MAPS_API_KEY.substring(0, 5)}...` : '無'
    });
  }
});

// 啟動 Express 服務器
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`服務器運行於端口 ${PORT}`);
}); 