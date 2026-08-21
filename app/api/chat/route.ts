import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

// 鲁棒 JSON 提取器（自动剔除 Markdown 标记、前后文本干扰并修复常见 JSON 尾逗号）
function extractJson(raw: string): any {
  if (!raw) return null;
  let str = raw.replace(/```json/gi, "").replace(/```/g, "").trim();

  try {
    return JSON.parse(str);
  } catch (e) {
    // 提取最外层的 { ... } 区块
    const start = str.indexOf("{");
    const end = str.lastIndexOf("}");
    if (start !== -1 && end !== -1 && end > start) {
      const sub = str.substring(start, end + 1);
      try {
        return JSON.parse(sub);
      } catch (e2) {
        // 清理末尾逗号与非法控制字符
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

// 模型协议路由
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
    const { prompt, model } = await req.json();
    const apiKey = (process.env.AI_API_KEY || "").trim();
    const baseUrl = (process.env.AI_BASE_URL || "https://opencode.ai/zen/go/v1").trim();

    const targetModel = model || "deepseek-v4-flash";
    const config = getModelEndpointConfig(targetModel, baseUrl);

    const systemPrompt = `你是一个专业的 UI/UX 架构师与 Excalidraw 矢量图表设计专家。
请根据用户的输入严格以 JSON 格式输出：

【规则】：
1. 意图分类：
   - 若用户打招呼/闲聊/咨询非绘图内容：
     { "type": "chat", "reply": "你的友好回答", "elements": [] }
   - 若用户要求绘制界面、架构图、流程图：
     { "type": "draw", "summary": "简要设计说明", "elements": [矢量元素列表] }

2. 绘图元素规范 (type 仅限: rectangle, ellipse, diamond, text, line, arrow)：
   - 所有元素颜色字段统一使用 strokeColor 与 backgroundColor（不要使用 color）。
   - 线条 (line/arrow) 支持提供 x1, y1, x2, y2 坐标。
   - 绘制手机 App 时，首先画一个外层深色背景矩形 (如 x:100, y:100, width:375, height:720, backgroundColor:"#0f172a", strokeColor:"#334155")，文字颜色使用 "#ffffff" 或 "#94a3b8"。
3. 只能输出纯 JSON，绝对不要输出任何 markdown 格式或开场白。`;

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

      if (!resp.ok) throw new Error(`上游 Anthropic 接口异常 (HTTP ${resp.status}): ${await resp.text()}`);
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

      if (!resp.ok) throw new Error(`上游 API 异常 (HTTP ${resp.status}): ${await resp.text()}`);
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