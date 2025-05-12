const admin = require('firebase-admin');

// 嘗試禁用OpenSSL FIPS模式，這可以修復一些解碼器問題
try {
  process.env.NODE_OPTIONS = process.env.NODE_OPTIONS || '';
  if (!process.env.NODE_OPTIONS.includes('--openssl-legacy-provider')) {
    process.env.NODE_OPTIONS += ' --openssl-legacy-provider';
    console.log('已設置OpenSSL傳統提供者模式');
  }
} catch (e) {
  console.log('設置OpenSSL配置失敗:', e.message);
}

let db;
let isInitialized = false;

/**
 * 初始化 Firebase Admin SDK
 */
function initializeFirebase() {
  // 檢查是否已初始化
  if (isInitialized) {
    console.log('Firebase 已經初始化過，跳過重複初始化');
    return { success: true, message: 'Firebase已經初始化' };
  }

  // 檢查是否有默認應用存在
  try {
    const existingApp = admin.app();
    if (existingApp) {
      console.log('發現已存在的Firebase應用實例，使用現有實例');
      db = admin.firestore();
      isInitialized = true;
      return { success: true, message: '使用現有Firebase實例' };
    }
  } catch (e) {
    // app()會在沒有初始化時拋出錯誤，這是正常的
    console.log('沒有找到現有的Firebase應用實例，將創建新實例');
  }

  try {
    console.log('開始初始化Firebase...');

    // 檢測當前環境
    const isCloudEnvironment = process.env.RENDER || process.env.VERCEL || process.env.HEROKU;
    console.log(`檢測到的環境: ${isCloudEnvironment ? '雲端環境' : '本地環境'}`);
    
    // 雲環境下優先使用環境變數
    if (isCloudEnvironment && process.env.FIREBASE_SERVICE_ACCOUNT) {
      console.log('在雲端環境使用FIREBASE_SERVICE_ACCOUNT環境變數');
      let serviceAccount;
      
      try {
        // 嘗試解析為JSON
        serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT);
        console.log('成功解析FIREBASE_SERVICE_ACCOUNT JSON');
      } catch (e) {
        console.log('直接JSON解析失敗，嘗試base64解碼...');
        try {
          // 移除可能的不必要字符
          let rawValue = process.env.FIREBASE_SERVICE_ACCOUNT
            .replace(/\\n/g, '\n')
            .trim();
            
          // 嘗試base64解碼
          const decoded = Buffer.from(rawValue, 'base64').toString('utf8');
          serviceAccount = JSON.parse(decoded);
          console.log('成功通過base64解碼解析服務賬戶');
        } catch (e2) {
          console.error('Base64解碼失敗:', e2);
          throw new Error(`無法解析服務賬戶: ${e.message}, base64解碼也失敗: ${e2.message}`);
        }
      }
      
      // 確保私鑰格式正確
      if (serviceAccount.private_key) {
        console.log('原始私鑰長度:', serviceAccount.private_key.length);
        serviceAccount.private_key = serviceAccount.private_key.replace(/\\n/g, '\n');
        console.log('處理後私鑰長度:', serviceAccount.private_key.length);
        
        // 檢查私鑰格式
        if (!serviceAccount.private_key.includes('-----BEGIN PRIVATE KEY-----')) {
          console.log('警告：私鑰可能缺少標準開頭標記');
        }
      }
      
      // 初始化Firebase
      try {
        admin.initializeApp({
          credential: admin.credential.cert(serviceAccount)
        });
        console.log('使用環境變數初始化Firebase成功');
        isInitialized = true;
      } catch (initError) {
        console.error('Firebase初始化失敗:', initError);
        
        // 輸出更多診斷信息
        console.log('服務賬戶JSON結構:', Object.keys(serviceAccount));
        console.log('project_id:', serviceAccount.project_id);
        console.log('client_email:', serviceAccount.client_email);
        
        throw initError;
      }
    }
    // 本地開發環境嘗試使用本地文件
    else if (!isCloudEnvironment) {
      try {
        const serviceAccountPath = './Eat2Lunch_firebase.json';
        console.log(`嘗試使用本地文件: ${serviceAccountPath}`);
        const serviceAccount = require(serviceAccountPath);
        admin.initializeApp({
          credential: admin.credential.cert(serviceAccount)
        });
        console.log('使用本地文件初始化Firebase成功');
        isInitialized = true;
      } catch (localError) {
        console.error('本地文件初始化失敗:', localError);
        // 繼續嘗試其他初始化方法
      }
    }
    // 最後嘗試其他標準方法
    else if (process.env.GOOGLE_APPLICATION_CREDENTIALS) {
      console.log('使用GOOGLE_APPLICATION_CREDENTIALS初始化');
      admin.initializeApp();
      isInitialized = true;
    }
    // 如果上述方法都失敗，嘗試使用分離的環境變數
    else if (process.env.FIREBASE_PROJECT_ID && 
             process.env.FIREBASE_PRIVATE_KEY && 
             process.env.FIREBASE_CLIENT_EMAIL) {
      console.log('使用分離的環境變數初始化Firebase');
      
      // 處理私鑰 - 確保所有轉義字符正確處理
      let privateKey = process.env.FIREBASE_PRIVATE_KEY;
      console.log('原始私鑰長度:', privateKey.length);
      
      // 將轉義的換行符(\n)替換為實際換行符
      privateKey = privateKey.replace(/\\n/g, '\n');
      console.log('處理後私鑰長度:', privateKey.length);
      
      admin.initializeApp({
        credential: admin.credential.cert({
          projectId: process.env.FIREBASE_PROJECT_ID,
          privateKey: privateKey,
          clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
        }),
      });
      isInitialized = true;
    }
    else {
      throw new Error('找不到有效的Firebase憑證設置');
    }

    // 如果成功初始化
    db = admin.firestore();
    console.log('Firebase 初始化成功');
    isInitialized = true;
    return { success: true, message: 'Firebase初始化成功' };
  } catch (error) {
    console.error('Firebase 初始化失敗:', error);
    return { success: false, message: `Firebase初始化失敗: ${error.message}`, error: error };
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
    const initResult = initializeFirebase();
    if (!initResult.success) {
      console.error('Firebase 未初始化且無法初始化');
      return { success: false, error: 'Firebase未初始化' };
    }
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
    return { success: true };
  } catch (error) {
    console.error('保存用戶資料失敗:', error);
    return { success: false, error: error.message };
  }
}

/**
 * 保存用戶的料理偏好
 * @param {string} userId - LINE 用戶 ID
 * @param {string} preference - 用戶的料理偏好
 */
async function saveUserPreference(userId, preference) {
  if (!db) {
    const initResult = initializeFirebase();
    if (!initResult.success) {
      console.error('Firebase 未初始化且無法初始化');
      return { success: false, error: 'Firebase未初始化' };
    }
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
    
    return { success: true };
  } catch (error) {
    console.error('保存用戶偏好失敗:', error);
    return { success: false, error: error.message };
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
    const initResult = initializeFirebase();
    if (!initResult.success) {
      console.error('Firebase 未初始化且無法初始化');
      return { success: false, error: 'Firebase未初始化' };
    }
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
    
    return { success: true };
  } catch (error) {
    console.error('保存用戶選擇失敗:', error);
    return { success: false, error: error.message };
  }
}

/**
 * 獲取用戶資料
 * @param {string} userId - LINE 用戶 ID
 * @returns {object|null} 用戶資料，如果不存在則返回 null
 */
async function getUserData(userId) {
  if (!db) {
    const initResult = initializeFirebase();
    if (!initResult.success) {
      console.error('Firebase 未初始化且無法初始化');
      return null;
    }
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
    // 輸出環境診斷信息
    console.log('=========== 診斷信息開始 ===========');
    console.log('Node.js版本:', process.version);
    console.log('平台:', process.platform, process.arch);
    
    // 嘗試獲取OpenSSL版本
    try {
      const crypto = require('crypto');
      console.log('OpenSSL版本:', crypto.constants.OPENSSL_VERSION_TEXT);
    } catch (e) {
      console.log('獲取OpenSSL版本失敗:', e.message);
    }
    
    // 檢查Firebase Admin SDK版本
    try {
      console.log('Firebase Admin版本:', require('firebase-admin/package.json').version);
    } catch (e) {
      console.log('獲取Firebase Admin版本失敗');
    }
    
    console.log('環境變數檢查:');
    console.log('- RENDER環境變數:', process.env.RENDER ? '已設置' : '未設置');
    console.log('- FIREBASE_SERVICE_ACCOUNT長度:', 
                process.env.FIREBASE_SERVICE_ACCOUNT ? 
                process.env.FIREBASE_SERVICE_ACCOUNT.length : '未設置');
    console.log('- GOOGLE_APPLICATION_CREDENTIALS:', 
                process.env.GOOGLE_APPLICATION_CREDENTIALS || '未設置');
    console.log('=========== 診斷信息結束 ===========');
    
    // 如果已經初始化過，直接進行連接測試
    if (isInitialized || admin.apps.length > 0) {
      console.log('Firebase 已初始化，直接進行連接測試');
      if (!db) {
        db = admin.firestore();
      }
    } else {
      // 未初始化，進行初始化
      const initResult = initializeFirebase();
      if (!initResult.success) {
        return initResult;
      }
    }
    
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