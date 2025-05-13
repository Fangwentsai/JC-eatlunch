# 上班吃什麼 Line Bot

一個幫助上班族快速找到附近餐廳的 Line Bot，根據用餐目的、料理偏好和步行距離推薦最適合的餐廳選擇。

## 功能特點

- 🍱 支持「我是社畜吃中餐」和「高級商業聚餐」兩種用餐目的
- 🔍 根據料理類型/關鍵字搜尋附近餐廳
- 🚶 針對「社畜」模式，分別推薦 10 分鐘內和 10-15 分鐘的餐廳，按評分高低排序
- ⭐ 顯示餐廳評分和最新評論
- 📸 提供餐廳照片
- 🧭 提供 Google Maps 導航
- 🛵 若餐廳支持外送，提供 UberEats 和 Foodpanda 叫餐選項
- 📝 記錄用戶偏好和選擇，為未來推薦提供依據
- 🤖 透過 ChatGPT-4o-mini 提供個性化餐廳描述和智能推薦
- 💬 可以直接與機器人聊天，詢問餐飲建議和推薦

## 系統架構

- **前端**：LINE Messaging API
- **後端**：Node.js + Express
- **API**：
  - Google Places API
  - Google Distance Matrix API
  - Google Gemini 2.5 Pro API
- **資料庫**：Firebase Firestore

## 環境配置

### 必要條件

- Node.js (建議 v16 以上)
- LINE 開發者帳號和頻道
- Google Cloud 帳號和 API 密鑰
- Firebase 帳號和專案
- OpenAI API 密鑰

### 步驟 1：克隆項目

```bash
git clone <repository-url>
cd lunch-finder-bot
npm install
```

### 步驟 2：設置環境變數

創建一個 `.env` 文件在項目根目錄：

```
# LINE 配置
LINE_CHANNEL_ACCESS_TOKEN=你的Line頻道訪問令牌
LINE_CHANNEL_SECRET=你的Line頻道秘密

# Google API 配置
GOOGLE_MAPS_API_KEY=你的Google地圖API密鑰

# Gemini AI 配置
GEMINI_API_KEY=你的Gemini API密鑰
GEMINI_MODEL=gemini-1.5-pro

# Firebase 配置
FIREBASE_PROJECT_ID=你的Firebase項目ID
FIREBASE_PRIVATE_KEY="你的Firebase私鑰"
FIREBASE_CLIENT_EMAIL=你的Firebase客戶端電子郵件

# 應用設置
PORT=3000
```

> **注意**: Firebase 私鑰通常包含換行符號(`\n`)，因此必須用雙引號（`""`）包圍私鑰或以 Base64 格式提供。

### 步驟 3：設置 Google Cloud 服務

1. 在 [Google Cloud Console](https://console.cloud.google.com/) 創建一個新項目
2. 啟用以下 API：
   - Places API
   - Distance Matrix API
3. 創建 API 密鑰並設置適當的限制

### 步驟 4：設置 Firebase

1. 在 [Firebase Console](https://console.firebase.google.com/) 創建一個新項目
2. 設置 Firestore 數據庫
3. 創建服務帳戶並下載私鑰

### 步驟 5：設置 Gemini API

1. 註冊 [Google AI Studio](https://ai.google.dev/) 帳戶
2. 創建 API 密鑰
3. 確保您的帳戶可以使用 Gemini 1.5 Pro 模型

### 步驟 6：設置 LINE Bot

1. 在 [LINE Developers](https://developers.line.biz/) 創建一個提供者和頻道
2. 獲取頻道訪問令牌和頻道密鑰
3. 設置 Webhook URL 為 `https://你的域名/webhook`

## 運行項目

```bash
# 開發模式
npm run dev

# 生產模式
npm start
```

## 資料庫結構

**Firebase Firestore**:

- **users** (集合)
  - **{userId}** (文檔)
    - **displayName**: 用戶名稱
    - **diningPurpose**: 用餐目的 ('worker' 或 'business')
    - **foodPreference**: 最近的料理偏好
    - **location**: 最近的位置 (latitude, longitude)
    - **lastRestaurantChoice**: 最近選擇的餐廳信息
    - **createdAt**: 首次使用時間
    - **updatedAt**: 更新時間
    
    - **preferenceHistory** (子集合)
      - 記錄歷史料理偏好
    
    - **restaurantChoices** (子集合)
      - 記錄用戶的餐廳選擇歷史

## AI 功能

本 Bot 整合了 Google Gemini 2.5 Pro，用於以下功能：

1. **自然語言處理**：用戶可以用自然語言詢問餐廳推薦
2. **餐廳描述增強**：AI 會根據餐廳信息和用戶偏好，生成有吸引力的餐廳描述
3. **個性化推薦**：分析用戶過去的料理偏好，提供針對性的推薦
4. **搜尋後建議**：在顯示搜尋結果後，AI 會提供一些額外的建議和提示

## API 用量考量

為控制成本，本項目針對 API 調用做了以下優化：

1. **Google API 優化**：
   - 針對「社畜吃中餐」類型，先用 Places API 進行初步搜索，然後在應用程序端按評分進行篩選，減少 Distance Matrix API 的負載
   - 每次選擇 10-12 家最優餐廳進行步行距離計算
   - 對於「高級商業聚餐」類型，不計算步行時間，直接按評分選擇推薦餐廳

2. **Gemini API 優化**：
   - 使用免費的 Gemini 1.5 Pro 模型，無需支付費用
   - 限制最大 token 數量，控制每次調用的成本
   - 只在必要時才調用 AI 生成描述和建議

## 注意事項

- 請確保您的 Google Cloud 帳戶有足夠的配額用於 Places API 和 Distance Matrix API 調用
- OpenAI API 是付費服務，請密切關注您的使用量和費用
- LINE Messaging API 有每月訊息數量的限制，請注意使用頻率 

## 常見問題解決

### Google Maps API 相關問題

如果您遇到餐廳搜尋返回虛構或不正確的數據，請檢查以下事項：

1. **確認 API 密鑰設置**：
   - 確保在 `.env` 文件中正確設置了 `GOOGLE_MAPS_API_KEY`
   - 您可以訪問 `/test-google-maps` 路由來測試 API 連接

2. **檢查 API 啟用狀態**：
   - 登錄 [Google Cloud Console](https://console.cloud.google.com/)
   - 確保以下 API 已啟用：
     - Places API
     - Distance Matrix API
     - Maps JavaScript API
     - Maps Static API

3. **檢查 API 限制**：
   - 確保您的 API 密鑰沒有過於嚴格的限制
   - 檢查 API 配額是否已用盡

### 個性化問候功能

機器人現在支持使用用戶暱稱進行個性化問候。如果您發現個性化問候不起作用，請檢查：

1. **LINE 權限**：確保您的 LINE Bot 有權限訪問用戶的個人資料
2. **Firebase 連接**：確保 Firebase 連接正常，可以通過 `/test-firebase` 路由進行測試

### 部署相關問題

如果在部署過程中遇到問題，特別是與 Firebase 憑證相關的問題：

1. **Firebase 私鑰格式**：
   - 確保私鑰包含正確的換行符
   - 在雲端環境中，可以使用 Base64 編碼的服務賬號 JSON
   - 可以使用 `FIREBASE_SERVICE_ACCOUNT` 環境變數提供完整的服務賬號 JSON

2. **OpenSSL 相關錯誤**：
   - 如果遇到 "DECODER routines::unsupported" 錯誤，代碼已包含自動修復
   - 如果自動修復失敗，請手動添加 `NODE_OPTIONS=--openssl-legacy-provider` 環境變數

如需更多幫助，請參考相關服務的官方文檔或聯繫開發者。 