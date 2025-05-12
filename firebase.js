const admin = require('firebase-admin');

let db;

/**
 * 初始化 Firebase Admin SDK
 */
function initializeFirebase() {
  try {
    // 處理私鑰中的換行符 - 方法1
    let privateKey = process.env.FIREBASE_PRIVATE_KEY;
    if (privateKey && privateKey.includes('\\n')) {
      privateKey = privateKey.replace(/\\n/g, '\n');
    }
    
    // 備選方法2 - 通過JSON解析
    if (process.env.FIREBASE_PRIVATE_KEY_JSON) {
      try {
        const keyData = JSON.parse(process.env.FIREBASE_PRIVATE_KEY_JSON);
        privateKey = keyData.privateKey;
      } catch (e) {
        console.error('解析JSON私鑰失敗:', e);
      }
    }
    
    // 使用環境變數進行初始化
    admin.initializeApp({
      credential: admin.credential.cert({
        projectId: process.env.FIREBASE_PROJECT_ID,
        privateKey: privateKey,
        clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
      }),
    });

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