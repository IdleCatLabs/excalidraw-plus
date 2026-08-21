import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

export async function GET() {
  const apiKey = (process.env.AI_API_KEY || "").trim();
  let baseUrl = (process.env.AI_BASE_URL || "https://opencode.ai/zen/go/v1").trim().replace(/\/+$/, "");
  
  // 精确拼接 Go 套餐的模型接口
  const endpoint = baseUrl.endsWith("/v1") 
    ? `${baseUrl}/models` 
    : `${baseUrl}/v1/models`;

  console.log(`[/api/models] 正在动态拉取 OpenCode Go 官方可用模型: ${endpoint}`);

  try {
    const response = await fetch(endpoint, {
      method: "GET",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
        "User-Agent": "Cline/3.0.0",
      },
      cache: "no-store",
    });

    if (!response.ok) {
      const errText = await response.text();
      console.error(`[/api/models] 上游拉取失败 [HTTP ${response.status}]:`, errText);
      return NextResponse.json(
        { error: `获取模型列表失败 (HTTP ${response.status}): ${errText}` },
        { status: response.status }
      );
    }

    const data = await response.json();
    // 兼容标准 OpenAI 规范 { data: [{ id: "...", ... }] } 或直接数组结构
    const rawList = Array.isArray(data) ? data : (data.data || []);

    const models = rawList
      .map((item: any) => {
        const id = typeof item === "string" ? item : (item.id || item.name || "");
        return {
          label: id,
          value: id,
        };
      })
      .filter((m: any) => Boolean(m.value))
      .sort((a: any, b: any) => a.label.localeCompare(b.label));

    console.log(`[/api/models] 成功拉取到 ${models.length} 个官方模型`);
    return NextResponse.json({ models });
  } catch (error: any) {
    console.error("[/api/models] 请求异常:", error.message);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}