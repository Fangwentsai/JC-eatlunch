/**
 * 這個腳本用於從Firebase服務賬號提取關鍵部分
 * 便於在Render.com上設置獨立的環境變數
 */

const fs = require('fs');
const path = require('path');

// 讀取服務賬號文件
const serviceAccountPath = path.join(__dirname, 'Eat2Lunch_firebase.json');

try {
  // 讀取文件
  console.log('讀取服務賬號文件...');
  const serviceAccount = fs.readFileSync(serviceAccountPath, 'utf8');
  const serviceAccountObj = JSON.parse(serviceAccount);

  console.log('\n=== Firebase 憑證分離部分（複製到Render.com環境變數）===\n');
  
  console.log('FIREBASE_PROJECT_ID:');
  console.log(serviceAccountObj.project_id);
  
  console.log('\nFIREBASE_CLIENT_EMAIL:');
  console.log(serviceAccountObj.client_email);
  
  console.log('\nFIREBASE_PRIVATE_KEY (請確保完整複製，包括BEGIN和END標記):');
  // 特別處理私鑰格式，確保換行字符正確
  const processedKey = serviceAccountObj.private_key
    .replace(/\\n/g, '\n')  // 替換可能的轉義換行符
    .trim();                // 去除前後空白
  console.log(processedKey);
  
  console.log('\n=== 請確保FIREBASE_PRIVATE_KEY的格式完全正確，包含所有換行符 ===\n');
  
  // 將每個部分單獨保存到文件
  const outputDir = path.join(__dirname, 'firebase-parts');
  if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir);
  }
  
  fs.writeFileSync(path.join(outputDir, 'project_id.txt'), serviceAccountObj.project_id);
  fs.writeFileSync(path.join(outputDir, 'client_email.txt'), serviceAccountObj.client_email);
  fs.writeFileSync(path.join(outputDir, 'private_key.txt'), processedKey);
  
  console.log(`同時已保存到目錄: ${outputDir}`);

} catch (error) {
  console.error('提取憑證時發生錯誤:', error);
} 