/**
 * 這個腳本用於將Firebase服務賬號JSON文件轉換為base64格式
 * 便於在Render.com等雲平台上設置為環境變數
 */

const fs = require('fs');
const path = require('path');

// 讀取服務賬號文件
const serviceAccountPath = path.join(__dirname, 'Eat2Lunch_firebase.json');

try {
  // 讀取文件
  console.log('讀取服務賬號文件...');
  const serviceAccount = fs.readFileSync(serviceAccountPath, 'utf8');

  // 轉換為標準格式的JSON字符串（去除可能的格式化空白）
  const serviceAccountObj = JSON.parse(serviceAccount);
  const standardJson = JSON.stringify(serviceAccountObj);

  // 轉換為base64
  console.log('轉換為base64格式...');
  const base64Encoded = Buffer.from(standardJson).toString('base64');

  // 輸出到控制台
  console.log('\n=== Base64編碼的服務賬號（複製到Render.com的FIREBASE_SERVICE_ACCOUNT環境變數）===\n');
  console.log(base64Encoded);
  console.log('\n=== 複製上面的base64編碼到Render.com環境變數 ===\n');

  // 保存到文件
  const outputPath = path.join(__dirname, 'firebase-base64.txt');
  fs.writeFileSync(outputPath, base64Encoded);
  console.log(`同時已保存到文件: ${outputPath}`);

} catch (error) {
  console.error('轉換服務賬號時發生錯誤:', error);
} 