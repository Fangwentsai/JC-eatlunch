const { OpenAI } = require('openai');

// 初始化 OpenAI 客戶端
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

/**
 * 使用 OpenAI GPT-4o-mini 產生回覆
 * @param {string} prompt - 提示詞
 * @param {array} history - 對話歷史
 * @returns {string} - AI 產生的回覆
 */
async function generateResponse(prompt, history = []) {
  try {
    // 構建消息歷史
    const messages = [...history, { role: 'user', content: prompt }];
    
    // 請求 OpenAI API
    const completion = await openai.chat.completions.create({
      model: process.env.OPENAI_MODEL || 'gpt-4o-mini',
      messages: messages,
      temperature: 0.7,
      max_tokens: 1000,
    });
    
    // 返回生成的回覆
    return completion.choices[0].message.content.trim();
  } catch (error) {
    console.error('OpenAI API 錯誤:', error);
    return '抱歉，我現在無法處理您的請求。請稍後再試。';
  }
}

/**
 * 使用 OpenAI 進行餐廳回覆的增強
 * @param {object} restaurantInfo - 餐廳信息
 * @param {string} userPreference - 用戶的偏好
 * @returns {string} - 增強的描述
 */
async function enhanceRestaurantDescription(restaurantInfo, userPreference) {
  try {
    const prompt = `
你是一個專業的餐廳推薦專家。根據以下餐廳信息，生成一個簡短、吸引人的描述（限制在100字以內）：

餐廳名稱：${restaurantInfo.name}
評分：${restaurantInfo.rating || '無評分'}
地址：${restaurantInfo.vicinity || restaurantInfo.formatted_address}
步行時間：${restaurantInfo.walkingDuration ? Math.round(restaurantInfo.walkingDuration / 60) + '分鐘' : '未提供'}
提供外送：${restaurantInfo.serves_delivery ? '是' : '否'}

使用者喜好：${userPreference}

請提供一個簡短的、吸引人的描述，重點強調餐廳的特色和與用戶喜好的匹配度。不要重複已有的數據，而是提供更多價值。
回覆必須是中文，風格要活潑但專業。
`;

    const response = await openai.chat.completions.create({
      model: process.env.OPENAI_MODEL || 'gpt-4o-mini',
      messages: [{ role: 'user', content: prompt }],
      temperature: 0.7,
      max_tokens: 150,
    });

    return response.choices[0].message.content.trim();
  } catch (error) {
    console.error('OpenAI 增強餐廳描述錯誤:', error);
    return ''; // 返回空字符串，以便在出錯時可以使用默認描述
  }
}

/**
 * 分析用戶偏好的函數
 * @param {object} userData - 用戶的歷史數據
 * @returns {object} - 分析結果
 */
async function analyzeUserPreference(userData) {
  if (!userData || !userData.preferenceHistory || userData.preferenceHistory.length === 0) {
    return { preferences: [], suggestion: null };
  }

  try {
    const preferences = userData.preferenceHistory.map(p => p.preference).join(', ');
    const prompt = `
分析以下用戶的餐飲偏好歷史，並提出推薦：

歷史偏好：${preferences}

請提供：
1. 這個用戶可能喜歡的3種料理類型（按可能性排序）
2. 一個基於這些偏好的具體推薦（具體的一種料理）

以JSON格式回覆，格式如下：
{
  "preferredCuisines": ["類型1", "類型2", "類型3"],
  "recommendation": "具體推薦的料理"
}
`;

    const response = await openai.chat.completions.create({
      model: process.env.OPENAI_MODEL || 'gpt-4o-mini',
      messages: [{ role: 'user', content: prompt }],
      temperature: 0.7,
      max_tokens: 250,
      response_format: { type: 'json_object' }
    });

    // 解析 JSON 回覆
    const analysisResult = JSON.parse(response.choices[0].message.content);
    return {
      preferences: analysisResult.preferredCuisines,
      suggestion: analysisResult.recommendation
    };
  } catch (error) {
    console.error('分析用戶偏好錯誤:', error);
    return { preferences: [], suggestion: null };
  }
}

module.exports = {
  generateResponse,
  enhanceRestaurantDescription,
  analyzeUserPreference
}; 