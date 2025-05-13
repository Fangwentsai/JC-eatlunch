require('dotenv').config();
const axios = require('axios');

// 顏色代碼
const colors = {
  reset: '\x1b[0m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  magenta: '\x1b[35m',
  cyan: '\x1b[36m',
  white: '\x1b[37m'
};

/**
 * 檢查環境變數
 */
async function checkEnvironment() {
  console.log(`${colors.cyan}===== 上班吃什麼 Line Bot 環境檢查 =====${colors.reset}\n`);
  
  // 檢查必要的環境變數
  const requiredEnvVars = [
    { name: 'LINE_CHANNEL_ACCESS_TOKEN', desc: 'Line 頻道訪問令牌' },
    { name: 'LINE_CHANNEL_SECRET', desc: 'Line 頻道秘密' },
    { name: 'GOOGLE_MAPS_API_KEY', desc: 'Google Maps API 密鑰' },
    { name: 'GEMINI_API_KEY', desc: 'Gemini AI API 密鑰' }
  ];
  
  let allGood = true;
  
  console.log(`${colors.cyan}檢查必要的環境變數:${colors.reset}`);
  for (const envVar of requiredEnvVars) {
    const value = process.env[envVar.name];
    if (!value) {
      console.log(`${colors.red}✗ ${envVar.name} (${envVar.desc})未設置${colors.reset}`);
      allGood = false;
    } else {
      const maskedValue = value.substring(0, 5) + '...' + value.substring(value.length - 3);
      console.log(`${colors.green}✓ ${envVar.name} (${envVar.desc})已設置: ${maskedValue}${colors.reset}`);
    }
  }
  
  console.log('\n');
  
  // 檢查 Firebase 配置
  console.log(`${colors.cyan}檢查 Firebase 配置:${colors.reset}`);
  const firebaseConfigured = process.env.FIREBASE_SERVICE_ACCOUNT || 
                            (process.env.FIREBASE_PROJECT_ID && 
                             process.env.FIREBASE_PRIVATE_KEY && 
                             process.env.FIREBASE_CLIENT_EMAIL);
  
  if (firebaseConfigured) {
    console.log(`${colors.green}✓ Firebase 配置已設置${colors.reset}`);
  } else {
    console.log(`${colors.red}✗ Firebase 配置不完整${colors.reset}`);
    console.log(`  請提供以下其中一種配置:`);
    console.log(`  1. FIREBASE_SERVICE_ACCOUNT (Base64編碼的服務賬號JSON)`);
    console.log(`  2. FIREBASE_PROJECT_ID, FIREBASE_PRIVATE_KEY 和 FIREBASE_CLIENT_EMAIL`);
    allGood = false;
  }
  
  console.log('\n');
  
  // 測試 Google Maps API
  console.log(`${colors.cyan}測試 Google Maps API 連接:${colors.reset}`);
  if (process.env.GOOGLE_MAPS_API_KEY) {
    try {
      // 測試座標 (台北101)
      const lat = 25.033964;
      const lng = 121.564468;
      
      const response = await axios.get('https://maps.googleapis.com/maps/api/place/nearbysearch/json', {
        params: {
          location: `${lat},${lng}`,
          radius: 1000,
          type: 'restaurant',
          key: process.env.GOOGLE_MAPS_API_KEY
        }
      });
      
      if (response.data.status === 'OK' && response.data.results.length > 0) {
        console.log(`${colors.green}✓ Google Maps API 連接成功${colors.reset}`);
        console.log(`  找到 ${response.data.results.length} 家餐廳`);
        console.log(`  第一家餐廳: ${response.data.results[0].name}`);
      } else if (response.data.status === 'OK') {
        console.log(`${colors.yellow}! Google Maps API 連接成功，但未找到餐廳${colors.reset}`);
        console.log(`  API 狀態: ${response.data.status}`);
      } else {
        console.log(`${colors.red}✗ Google Maps API 返回錯誤${colors.reset}`);
        console.log(`  API 狀態: ${response.data.status}`);
        console.log(`  錯誤信息: ${response.data.error_message || '無'}`);
        allGood = false;
      }
    } catch (error) {
      console.log(`${colors.red}✗ 測試 Google Maps API 時發生錯誤${colors.reset}`);
      console.log(`  錯誤信息: ${error.message}`);
      allGood = false;
    }
  } else {
    console.log(`${colors.red}✗ 無法測試 Google Maps API (未設置API密鑰)${colors.reset}`);
    allGood = false;
  }
  
  console.log('\n');
  
  // 總結
  if (allGood) {
    console.log(`${colors.green}✓ 所有檢查通過！您的環境已正確設置。${colors.reset}`);
  } else {
    console.log(`${colors.yellow}! 部分檢查未通過。請修復上述問題後再運行應用。${colors.reset}`);
  }
}

// 運行檢查
checkEnvironment().catch(error => {
  console.error(`${colors.red}檢查過程中發生錯誤:${colors.reset}`, error);
}); 