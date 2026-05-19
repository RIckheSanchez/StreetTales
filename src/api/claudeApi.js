import Config from 'react-native-config';

const CLAUDE_ENDPOINT = 'https://api.anthropic.com/v1/messages';
const MODEL = 'claude-sonnet-4-20250514';

const IDENTIFY_SYSTEM = `你是一个城市建筑识别专家。
分析图片中指定方位的建筑或地标，返回JSON格式：
{
  "name": "建筑名称或推测名称",
  "type": "建筑类型（历史建筑/宗教场所/商业建筑/政府建筑/其他）",
  "searchKeyword": "用于Wikipedia搜索的关键词",
  "confidence": "high/medium/low",
  "description": "你从图片中观察到的视觉特征，50字以内"
}
如果无法识别，name返回null。只返回JSON，不要其他文字。`;

const STORY_SYSTEM = `你是一个博学风趣的城市故事讲述者，像一个坐在副驾驶的老朋友。
根据提供的建筑信息和历史资料，生成一段适合驾车时收听的故事。
要求：
1. 时长控制在45-60秒朗读量（约150-200字）
2. 语气轻松自然，像朋友聊天，不要像百科全书
3. 优先讲有趣的人物、事件、冷知识，而不是枯燥的年代数据
4. 开头直接进入故事，不要说"好的"或"关于这个建筑"
5. 如果资料不足，根据建筑风格和类型合理推断，但不要编造具体数据
6. 结尾可以留一个让人回味的细节或悬念`;

async function callClaude(systemPrompt, messages) {
  const response = await fetch(CLAUDE_ENDPOINT, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': Config.CLAUDE_API_KEY,
      'anthropic-version': '2023-06-01',
    },
    body: JSON.stringify({
      model: MODEL,
      max_tokens: 1024,
      system: systemPrompt,
      messages,
    }),
  });

  if (!response.ok) {
    const err = await response.text();
    throw new Error(`Claude API error ${response.status}: ${err}`);
  }

  const data = await response.json();
  return data.content[0].text;
}

export async function identifyBuilding(base64Image, direction, userQuestion) {
  try {
    const messages = [
      {
        role: 'user',
        content: [
          {
            type: 'image',
            source: {
              type: 'base64',
              media_type: 'image/jpeg',
              data: base64Image,
            },
          },
          {
            type: 'text',
            text: `图片方位：${direction}，用户问题：${userQuestion}`,
          },
        ],
      },
    ];

    const text = await callClaude(IDENTIFY_SYSTEM, messages);
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      throw new Error('No JSON in Claude response');
    }
    return JSON.parse(jsonMatch[0]);
  } catch (error) {
    console.error('identifyBuilding error:', error);
    return null;
  }
}

export async function generateStory(buildingInfo, wikiContent, userQuestion) {
  try {
    const userPrompt = `建筑信息：${JSON.stringify(buildingInfo)}\n历史资料：${wikiContent || '暂无资料'}\n用户问题：${userQuestion}`;
    const messages = [{role: 'user', content: userPrompt}];
    return await callClaude(STORY_SYSTEM, messages);
  } catch (error) {
    console.error('generateStory error:', error);
    return null;
  }
}
