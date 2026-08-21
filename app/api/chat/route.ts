import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

function extractJson(raw: string): any {
  if (!raw) return null;
  let str = raw.replace(/```json/gi, "").replace(/```/g, "").trim();

  try {
    return JSON.parse(str);
  } catch (e) {
    const start = str.indexOf("{");
    const end = str.lastIndexOf("}");
    if (start !== -1 && end !== -1 && end > start) {
      const sub = str.substring(start, end + 1);
      try {
        return JSON.parse(sub);
      } catch (e2) {
        const cleaned = sub
          .replace(/,\s*([\}\]])/g, "$1")
          .replace(/[\u0000-\u001F\u007F-\u009F]/g, "");
        try {
          return JSON.parse(cleaned);
        } catch (e3) {
          return null;
        }
      }
    }
    return null;
  }
}

function getModelEndpointConfig(model: string, baseUrl: string) {
  const cleanBase = baseUrl.replace(/\/+$/, "");
  const m = model.toLowerCase();

  if (m.startsWith("qwen") || m.startsWith("minimax")) {
    return { type: "anthropic", url: `${cleanBase}/messages` };
  }
  if (m.startsWith("grok") || m.startsWith("gpt-5.6") || m.startsWith("muse-spark")) {
    return { type: "responses", url: `${cleanBase}/responses` };
  }
  return { type: "openai", url: `${cleanBase}/chat/completions` };
}

export async function POST(req: Request) {
  const startTime = Date.now();
  try {
    const { prompt, model, currentElements = [] } = await req.json();
    const apiKey = (process.env.AI_API_KEY || "").trim();
    const baseUrl = (process.env.AI_BASE_URL || "https://opencode.ai/zen/go/v1").trim();

    const targetModel = model || "deepseek-v4-flash";
    const config = getModelEndpointConfig(targetModel, baseUrl);

    const hasExistingCanvas = Array.isArray(currentElements) && currentElements.length > 0;

    const systemPrompt = `你是一个专业的 UI/UX 架构师与 Excalidraw 矢量图表设计专家。
请根据用户的输入和当前画布状态严格以 JSON 格式输出：

【当前画布状态】：
${hasExistingCanvas ? `画布当前已有 ${currentElements.length} 个元素，精简结构如下：\n${JSON.stringify(currentElements)}` : "画布目前为空。"}

【严格输出规则】：
1. 意图分类：
   - 若用户仅打招呼、闲聊或提问非画图内容：
     { "type": "chat", "reply": "你的回答", "elements": [] }
   - 若用户提出画图/改图需求：
     { "type": "draw", "mode": "replace"|"append", "summary": "修改或绘制说明", "elements": [矢量元素列表] }

2. 模式判断（关键）：
   - 【局部修改/调整】（如“字体缩小”、“修改时间为09:00”、“把开关改成关/灰色”、“删掉第三个闹钟”）：
     * 设置 "mode": "replace"
     * 必须保留当前画布中其他不需要修改的元素，仅修改目标元素（如调整对应 text 的 fontSize、修改文字或删除），返回完整的更新后元素列表。
   - 【追加新页面/组件】（如“在右边画一个设置页”）：
     * 设置 "mode": "append"
     * 计算 X 轴偏移（在当前元素最大 X 坐标右侧 100px 处开始绘制，如 x: 550），避免覆盖已有界面。
   - 【全新重画】（当画布为空或用户明确说“重新画一个...”）：
     * 设置 "mode": "replace"

3. 格式约束：
   - 只能输出纯 JSON，绝对不要输出任何 markdown 代码块或废话。`;

    let rawText = "";
    let reasoningContent = "";
    let usageData = { prompt_tokens: 0, completion_tokens: 0, total_tokens: 0 };

    if (config.type === "anthropic") {
      const resp = await fetch(config.url, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-api-key": apiKey,
          "Authorization": `Bearer ${apiKey}`,
          "anthropic-version": "2023-06-01",
          "User-Agent": "Cline/3.0.0",
        },
        body: JSON.stringify({
          model: targetModel,
          max_tokens: 4096,
          system: systemPrompt,
          messages: [{ role: "user", content: prompt }],
        }),
      });

      if (!resp.ok) throw new Error(`Anthropic 异常 (HTTP ${resp.status}): ${await resp.text()}`);
      const raw = await resp.json();
      rawText = raw.content?.[0]?.text || "{}";
      if (raw.usage) {
        usageData = {
          prompt_tokens: raw.usage.input_tokens || 0,
          completion_tokens: raw.usage.output_tokens || 0,
          total_tokens: (raw.usage.input_tokens || 0) + (raw.usage.output_tokens || 0),
        };
      }
    } else {
      const resp = await fetch(config.url, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${apiKey}`,
          "User-Agent": "Cline/3.0.0",
        },
        body: JSON.stringify({
          model: targetModel,
          messages: [
            { role: "system", content: systemPrompt },
            { role: "user", content: prompt },
          ],
          temperature: 0.2,
          max_tokens: 4096,
        }),
      });

      if (!resp.ok) throw new Error(`API 异常 (HTTP ${resp.status}): ${await resp.text()}`);
      const raw = await resp.json();
      const choice = raw.choices?.[0]?.message;
      rawText = choice?.content || "{}";
      reasoningContent = choice?.reasoning_content || "";
      if (raw.usage) usageData = raw.usage;
    }

    const duration = ((Date.now() - startTime) / 1000).toFixed(1);
    const parsedData = extractJson(rawText);

    if (parsedData && (parsedData.type === "draw" || (Array.isArray(parsedData.elements) && parsedData.elements.length > 0))) {
      return NextResponse.json({
        type: "draw",
        mode: parsedData.mode || "replace",
        summary: parsedData.summary || "生成了矢量草图",
        elements: parsedData.elements || [],
        reasoning: reasoningContent,
        usage: usageData,
        duration: `${duration}s`,
      });
    }

    return NextResponse.json({
      type: "chat",
      reply: parsedData?.reply || parsedData?.summary || rawText,
      elements: [],
      reasoning: reasoningContent,
      usage: usageData,
      duration: `${duration}s`,
    });
  } catch (error: any) {
    console.error("[/api/chat] 错误:", error.message);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}