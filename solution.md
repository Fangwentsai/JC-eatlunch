# 解決方案

## 問題診斷

### 1. Gemini API模型錯誤
錯誤信息：`GoogleGenerativeAIError: [404 Not Found] models/gemini-2.5-pro-exp-03-25 is not found for API version v1`

原因：部署環境中的環境變數`GEMINI_MODEL`設置為不存在的模型名稱`gemini-2.5-pro-exp-03-25`。

**測試結果**：我們已確認本地環境中的API密鑰可以正常訪問Gemini API，且可用的模型包括`gemini-1.5-pro`、`gemini-1.5-pro-001`和`gemini-1.5-pro-002`，但沒有`gemini-2.5-pro-exp-03-25`這個模型。

### 2. Google Maps API錯誤
錯誤信息：`Google Place Details API 返回錯誤: INVALID_REQUEST`

可能原因：
- API密鑰權限設置不正確
- 請求參數格式錯誤
- API配額限制或地區限制

**測試結果**：我們已確認本地環境中的Google Maps API密鑰可以正常工作，使用相同的API密鑰和標準Place ID進行測試返回了正確的結果。這表明API密鑰本身是有效的，問題可能出在請求參數或部署環境的設置上。

**已實施的修復**：我們已經修改了`googleApi.js`中的`getPlaceDetails`函數，簡化了fields參數，只保留基本必要字段，並添加了更詳細的錯誤處理和日誌。同時，在`messageHandler.js`中添加了更健壯的錯誤處理機制，確保即使某些餐廳詳情獲取失敗也能繼續處理其他餐廳。

## 解決步驟

### 修復Gemini模型錯誤
1. 在部署環境中更新環境變數`GEMINI_MODEL`為`gemini-1.5-pro`
   - 如使用Render.com，在Dashboard中找到環境變數設置並更新
   - 如使用Heroku，使用`heroku config:set GEMINI_MODEL=gemini-1.5-pro`
   - 如使用其他平台，請參考相應平台的環境變數設置方法

2. 本地已更新的`.env`文件（已確認可用）：
   ```
   GEMINI_MODEL=gemini-1.5-pro
   ```

3. 確認代碼中的模型名稱設置（已確認正確）：
   ```javascript
   const model = genAI.getGenerativeModel({
     model: process.env.GEMINI_MODEL || 'gemini-1.5-pro',
   });
   ```

### 修復Google Maps API錯誤
1. 已實施的修改：
   - 簡化了Place Details API的fields參數，只保留必要字段：
     ```javascript
     const fields = [
       'name',
       'formatted_address',
       'geometry',
       'rating',
       'user_ratings_total',
       'photos',
       'vicinity'
     ];
     ```
   - 添加了後備請求機制，當帶fields參數的請求失敗時，嘗試不帶fields參數再次請求
   - 添加了更詳細的錯誤日誌，記錄完整的請求參數和響應
   - 在`messageHandler.js`中添加了更健壯的錯誤處理，確保即使部分餐廳詳情獲取失敗也能繼續處理

2. 檢查Google Cloud Console中的API密鑰設置
   - 確認已啟用Places API、Distance Matrix API等所需API
   - 確認API密鑰沒有IP地址或HTTP引用者限制，或已將部署服務器的IP添加到白名單
   - 檢查是否有API使用限制（地區、請求類型等）

## 部署後驗證
1. 更新部署環境中的環境變數後重新部署應用
2. 使用日誌監控系統檢查是否還有相同的錯誤
3. 進行簡單的功能測試，確認Gemini API和Google Maps API是否正常工作
4. 如果Google Maps API錯誤持續，考慮實施以下臨時解決方案：
   - 添加重試機制（已實施）
   - 添加錯誤處理，在API返回錯誤時提供備用響應（已實施）
   - 考慮使用不同的Google Maps API密鑰

## 長期解決方案
1. 設置適當的監控和警報，及時發現API錯誤
2. 實施更健壯的錯誤處理機制
3. 考慮使用Google Cloud的配額增加請求，如果確定是配額問題
4. 定期檢查和更新API密鑰和模型名稱，確保它們與最新的API版本兼容
