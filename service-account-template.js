/**
 * 服務賬號模板文件
 * 請複製此文件到service-account-direct.js，並填入您的Firebase服務賬號信息
 */

// 替換為您的Firebase服務賬號內容
const serviceAccount = {
  "type": "service_account",
  "project_id": "你的項目ID",
  "private_key_id": "你的私鑰ID",
  "private_key": "-----BEGIN PRIVATE KEY-----\n你的私鑰內容\n-----END PRIVATE KEY-----\n",
  "client_email": "你的客戶端郵件",
  "client_id": "你的客戶端ID",
  "auth_uri": "https://accounts.google.com/o/oauth2/auth",
  "token_uri": "https://oauth2.googleapis.com/token",
  "auth_provider_x509_cert_url": "https://www.googleapis.com/oauth2/v1/certs",
  "client_x509_cert_url": "你的x509證書URL",
  "universe_domain": "googleapis.com"
};

module.exports = serviceAccount; 