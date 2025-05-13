# Firebase 認證問題排查指南

您的 Line Bot 正在遇到 Firebase 認證問題，錯誤信息顯示 `Request had invalid authentication credentials`。這表明您的 Firebase 服務賬號憑證可能已經過期或無效。以下是解決此問題的步驟：

## 1. 獲取新的 Firebase 服務賬號密鑰

### 方法一：通過 Firebase 控制台（推薦）

1. 登錄 [Firebase 控制台](https://console.firebase.google.com/)
2. 選擇您的專案
3. 點擊左側導航欄中的 ⚙️（設置）圖標，然後選擇「專案設置」
4. 點擊「服務賬號」標籤
5. 在「Firebase Admin SDK」部分，點擊「生成新的私鑰」按鈕
6. 下載生成的 JSON 文件（這是您的服務賬號密鑰文件）

### 方法二：通過 Google Cloud 控制台（更精細的權限控制）

1. 登錄 [Firebase 控制台](https://console.firebase.google.com/)
2. 點擊左側導航欄中的 ⚙️（設置）圖標，然後選擇「專案設置」
3. 點擊「服務賬號」標籤
4. 點擊「管理服務賬號權限」，這將帶您進入 Google Cloud 控制台
5. 在 Google Cloud 控制台中，創建一個新的服務賬號，並授予其「Firebase Admin SDK 管理員」角色
6. 為新創建的服務賬號生成 JSON 密鑰

## 2. 配置您的環境變數

獲取新的服務賬號密鑰後，您有兩種方式配置 Firebase 認證：

### 方法一：使用分離的環境變數（推薦用於開發環境）

從服務賬號 JSON 文件中提取以下信息，並更新您的 `.env` 文件：

```
FIREBASE_PROJECT_ID=您的Firebase項目ID
FIREBASE_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\n您的Firebase私鑰\n-----END PRIVATE KEY-----"
FIREBASE_CLIENT_EMAIL=您的Firebase客戶端電子郵件
```

注意：私鑰必須包含換行符 `\n` 並用引號括起來。

### 方法二：使用 Base64 編碼的服務賬號 JSON（推薦用於生產環境）

1. 將整個服務賬號 JSON 文件轉換為 Base64 格式：

   **Linux/macOS**:
   ```bash
   cat your-service-account.json | base64
   ```

   **Windows PowerShell**:
   ```powershell
   [Convert]::ToBase64String([IO.File]::ReadAllBytes("your-service-account.json"))
   ```

2. 將生成的 Base64 字符串設置為環境變數：

   ```
   FIREBASE_SERVICE_ACCOUNT=您的Base64編碼的服務賬號JSON
   ```

## 3. 更新 Render 部署環境

如果您在 Render 上部署應用，請確保更新 Render 上的環境變數：

1. 登錄 [Render 控制台](https://dashboard.render.com/)
2. 選擇您的服務
3. 點擊「Environment」標籤
4. 更新 Firebase 相關的環境變數
5. 點擊「Save Changes」並重新部署您的服務

## 4. 測試 Firebase 連接

部署更新後，您可以訪問以下端點來測試 Firebase 連接：

- `/test-firebase` - 測試基本連接
- `/test-firebase-write` - 測試寫入數據功能

如果您仍然遇到問題，請檢查應用日誌以獲取更詳細的錯誤信息。

## 常見問題

1. **私鑰格式問題**：確保私鑰包含正確的換行符 `\n`，並且在環境變數中用引號括起來。

2. **權限問題**：確保您的服務賬號具有足夠的權限訪問 Firestore 數據庫。

3. **專案 ID 不匹配**：確保您使用的是正確的 Firebase 專案 ID。

4. **服務賬號被禁用**：檢查您的服務賬號是否在 Google Cloud 控制台中被禁用。

5. **API 未啟用**：確保已在 Google Cloud 控制台中啟用了 Firestore API。

希望這些步驟能幫助您解決 Firebase 認證問題！ 