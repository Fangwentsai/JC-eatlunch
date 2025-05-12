const admin = require('firebase-admin');

let db;

/**
 * 初始化 Firebase Admin SDK
 */
function initializeFirebase() {
  try {
    console.log('開始初始化Firebase...');
    
    let serviceAccount;
    
    // 使用最直接的方式 - 檢查服務賬戶JSON文件
    if (process.env.GOOGLE_APPLICATION_CREDENTIALS) {
      // 如果配置了憑證文件路徑
      console.log('使用GOOGLE_APPLICATION_CREDENTIALS環境變數初始化Firebase');
      // 不需要額外操作，firebase-admin會自動載入
      admin.initializeApp();
    } 
    else if (process.env.FIREBASE_SERVICE_ACCOUNT) {
      // 如果提供了完整的JSON服務賬戶
      try {
        console.log('嘗試解析FIREBASE_SERVICE_ACCOUNT環境變數...');
        serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT);
        console.log('成功解析服務賬戶JSON');
        admin.initializeApp({
          credential: admin.credential.cert(serviceAccount)
        });
      } catch (e) {
        console.error('解析服務賬戶JSON失敗:', e);
        throw e; // 重新拋出錯誤，因為這是關鍵錯誤
      }
    } 
    else {
      // 最後嘗試使用分離的環境變數
      console.log('使用分離的環境變數初始化Firebase...');
      
      // 檢查必要的環境變數是否存在
      if (!process.env.FIREBASE_PROJECT_ID || 
          !process.env.FIREBASE_PRIVATE_KEY || 
          !process.env.FIREBASE_CLIENT_EMAIL) {
        throw new Error('缺少必要的Firebase憑證環境變數');
      }
      
      // 處理私鑰 - 直接取代所有可能的轉義字符
      let privateKey = process.env.FIREBASE_PRIVATE_KEY;
      console.log('原始私鑰長度:', privateKey.length);
      
      // 將轉義的換行符(\n)替換為實際換行符
      if (privateKey.includes('\\n')) {
        privateKey = privateKey.replace(/\\n/g, '\n');
        console.log('已處理換行符，處理後私鑰長度:', privateKey.length);
      }
      
      // 檢查私鑰格式
      if (!privateKey.includes('-----BEGIN PRIVATE KEY-----')) {
        console.error('私鑰格式不正確，缺少開始標記');
        console.log('私鑰前100個字符:', privateKey.substring(0, 100));
      }
      
      if (!privateKey.includes('-----END PRIVATE KEY-----')) {
        console.error('私鑰格式不正確，缺少結束標記');
      }
      
      // 初始化Firebase
      try {
        admin.initializeApp({
          credential: admin.credential.cert({
            projectId: process.env.FIREBASE_PROJECT_ID,
            privateKey: privateKey,
            clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
          }),
        });
      } catch (error) {
        console.error('使用憑證初始化失敗:', error);
        throw error;
      }
    }

    // 如果成功初始化
    db = admin.firestore();
    console.log('Firebase 初始化成功');
  } catch (error) {
    console.error('Firebase 初始化失敗:', error);
    throw error;
  }
}

/**
 * 保存或更新用戶資料
 * @param {string} userId - LINE 用戶 ID
 * @param {string} displayName - 用戶顯示名稱
 * @param {object} additionalData - 其他要保存的資料
 */
async function saveUserData(userId, displayName, additionalData = {}) {
  if (!db) {
    console.error('Firebase 未初始化');
    return;
  }

  try {
    // 參考用戶文檔
    const userRef = db.collection('users').doc(userId);
    
    // 獲取現有資料（如果有）
    const userDoc = await userRef.get();
    
    // 準備要保存的資料
    const userData = {
      displayName,
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
      ...additionalData
    };
    
    // 如果是新用戶，添加創建時間
    if (!userDoc.exists) {
      userData.createdAt = admin.firestore.FieldValue.serverTimestamp();
    }
    
    // 保存資料
    await userRef.set(userData, { merge: true });
  } catch (error) {
    console.error('保存用戶資料失敗:', error);
  }
}

/**
 * 保存用戶的料理偏好
 * @param {string} userId - LINE 用戶 ID
 * @param {string} preference - 用戶的料理偏好
 */
async function saveUserPreference(userId, preference) {
  if (!db) {
    console.error('Firebase 未初始化');
    return;
  }

  try {
    // 參考用戶文檔
    const userRef = db.collection('users').doc(userId);
    
    // 保存偏好
    await userRef.set({
      foodPreference: preference,
      lastPreferenceUpdate: admin.firestore.FieldValue.serverTimestamp()
    }, { merge: true });
    
    // 同時記錄到偏好歷史
    await userRef.collection('preferenceHistory').add({
      preference: preference,
      timestamp: admin.firestore.FieldValue.serverTimestamp()
    });
  } catch (error) {
    console.error('保存用戶偏好失敗:', error);
  }
}

/**
 * 保存用戶的餐廳選擇
 * @param {string} userId - LINE 用戶 ID
 * @param {string} placeId - Google Place ID
 * @param {string} actionType - 選擇的操作類型（導航、外送等）
 */
async function saveUserChoice(userId, placeId, actionType) {
  if (!db) {
    console.error('Firebase 未初始化');
    return;
  }

  try {
    // 參考用戶文檔
    const userRef = db.collection('users').doc(userId);
    
    // 記錄用戶的餐廳選擇
    await userRef.collection('restaurantChoices').add({
      placeId: placeId,
      actionType: actionType,
      timestamp: admin.firestore.FieldValue.serverTimestamp()
    });
    
    // 更新用戶資料中的最後選擇
    await userRef.set({
      lastRestaurantChoice: {
        placeId: placeId,
        actionType: actionType,
        timestamp: admin.firestore.FieldValue.serverTimestamp()
      }
    }, { merge: true });
  } catch (error) {
    console.error('保存用戶選擇失敗:', error);
  }
}

/**
 * 獲取用戶資料
 * @param {string} userId - LINE 用戶 ID
 * @returns {object|null} 用戶資料，如果不存在則返回 null
 */
async function getUserData(userId) {
  if (!db) {
    console.error('Firebase 未初始化');
    return null;
  }

  try {
    // 參考用戶文檔
    const userRef = db.collection('users').doc(userId);
    
    // 獲取文檔
    const userDoc = await userRef.get();
    
    // 如果用戶存在，返回資料
    if (userDoc.exists) {
      return userDoc.data();
    } else {
      return null;
    }
  } catch (error) {
    console.error('獲取用戶資料失敗:', error);
    return null;
  }
}

// 導出測試Firebase連接的函數
async function testFirebaseConnection() {
  try {
    // 嘗試獲取一個不存在的文檔，測試連接是否成功
    const testRef = db.collection('test').doc('test');
    await testRef.get();
    console.log('Firebase 連接測試成功');
    return { success: true, message: 'Firebase 連接成功' };
  } catch (error) {
    console.error('Firebase 連接測試失敗:', error);
    return { 
      success: false, 
      message: 'Firebase 連接失敗', 
      error: error.message,
      stack: error.stack
    };
  }
}

module.exports = {
  initializeFirebase,
  saveUserData,
  saveUserPreference,
  saveUserChoice,
  getUserData,
  testFirebaseConnection
}; 