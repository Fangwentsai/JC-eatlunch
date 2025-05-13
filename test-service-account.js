/**
 * 測試直接讀取服務賬號文件
 */
console.log('開始測試...');

try {
  console.log('嘗試讀取service-account-direct.js...');
  const serviceAccount = require('./service-account-direct.js');
  
  console.log('成功導入模塊');
  console.log('返回值類型:', typeof serviceAccount);
  
  console.log('JSON格式化輸出:');
  console.log(JSON.stringify(serviceAccount, null, 2).substring(0, 500) + '...');
  
  // 直接檢查特定字段
  console.log('\n直接讀取字段:');
  console.log('project_id = ' + serviceAccount.project_id);
  console.log('client_email = ' + serviceAccount.client_email);
  console.log('private_key存在? ' + (serviceAccount.private_key ? '是' : '否'));
  
  if (serviceAccount.private_key) {
    console.log('private_key前50個字符: ' + serviceAccount.private_key.substring(0, 50));
  }
  
  // 測試創建Firebase應用
  console.log('\n嘗試初始化Firebase:');
  const admin = require('firebase-admin');
  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount)
  });
  
  console.log('Firebase初始化成功!');
  
} catch (e) {
  console.error('測試失敗:', e);
} 