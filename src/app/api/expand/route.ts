import { getClient } from "@/lib/client";
import { getModelConfig } from "@/lib/models";
import { EXPAND_PROMPT } from "@/lib/prompts";

export const dynamic = "force-dynamic";
export const maxDuration = 120;

export async function POST(request: Request) {
  try {
    const { concept, context, modelId } = await request.json();

    if (!concept) {
      return Response.json(
        { error: "请提供需要扩展的概念" },
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
          content: `${EXPAND_PROMPT}

笔记上下文：
${context || "（无上下文）"}

请解释以下概念：${concept}`,
        },
      ],
    });

    const explanation = response.choices[0]?.message?.content || "";

    return Response.json({ explanation });
  } catch (error) {
    console.error("Expand error:", error);
    const message =
      error instanceof Error ? error.message : "扩展过程中发生未知错误";
    return Response.json({ error: message }, { status: 500 });
  }
}
