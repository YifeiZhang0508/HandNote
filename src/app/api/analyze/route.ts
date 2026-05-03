import { getClient } from "@/lib/client";
import { getModelConfig } from "@/lib/models";
import { ANALYZE_PROMPT } from "@/lib/prompts";

export const dynamic = "force-dynamic";
export const maxDuration = 120;

export async function POST(request: Request) {
  try {
    const { text, context, modelId } = await request.json();

    if (!text) {
      return Response.json(
        { error: "请提供需要分析的内容" },
        { status: 400 }
      );
    }

    const config = getModelConfig(modelId || "mimo");
    const client = getClient(config);

    const response = await client.chat.completions.create({
      model: config.model,
      max_completion_tokens: 2048,
      messages: [
        {
          role: "system",
          content: `You are ${config.name}, an AI assistant.`,
        },
        {
          role: "user",
          content: `${ANALYZE_PROMPT}

笔记全文上下文：
${context || "（无上下文）"}

用户选中的内容：
${text}`,
        },
      ],
    });

    const explanation = response.choices[0]?.message?.content || "";

    return Response.json({ explanation });
  } catch (error) {
    console.error("Analyze error:", error);
    const message =
      error instanceof Error ? error.message : "分析过程中发生未知错误";
    return Response.json({ error: message }, { status: 500 });
  }
}
