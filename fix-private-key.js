/**
 * 這個腳本專門用於修復Firebase私鑰格式問題
 * 將標準私鑰轉換為適合在Render.com環境變數中使用的格式
 */

const fs = require('fs');
const path = require('path');

try {
  // 讀取私鑰文件
  const keyPath = path.join(__dirname, 'firebase-parts', 'private_key.txt');
  let privateKey = fs.readFileSync(keyPath, 'utf8');
  
  console.log('原始私鑰長度:', privateKey.length);
  console.log('原始私鑰的前30個字符:', privateKey.substring(0, 30));
  
  // 處理換行符，轉換為字面量 \n 字符串 (這對Render.com環境變數非常重要)
  privateKey = privateKey.replace(/\r?\n/g, '\\n');
  
  console.log('\n處理後私鑰長度:', privateKey.length);
  console.log('處理後私鑰的前30個字符:', privateKey.substring(0, 30));
  
  // 將處理後的私鑰保存到文件
  const outputPath = path.join(__dirname, 'firebase-parts', 'private_key_for_env.txt');
  fs.writeFileSync(outputPath, privateKey);
  
  console.log('\n=== 請複製下面的私鑰到Render.com的FIREBASE_PRIVATE_KEY環境變數 ===\n');
  console.log(privateKey);
  console.log('\n=== 私鑰結束 ===');
  console.log(`\n已保存到文件: ${outputPath}`);
  
} catch (error) {
  console.error('處理私鑰時發生錯誤:', error);
} 