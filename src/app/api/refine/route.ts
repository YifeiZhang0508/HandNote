import { getClient } from "@/lib/client";
import { getModelConfig } from "@/lib/models";
import { REFINE_PROMPT } from "@/lib/prompts";

export const dynamic = "force-dynamic";
export const maxDuration = 120;

export async function POST(request: Request) {
  try {
    const { markdown, modelId } = await request.json();

    if (!markdown) {
      return Response.json({ error: "请提供需要整理的Markdown内容" }, { status: 400 });
    }

    const config = getModelConfig(modelId || "mimo");
    const client = getClient(config);

    const response = await client.chat.completions.create({
      model: config.model,
      max_completion_tokens: 32768,
      messages: [
        {
          role: "system",
          content: `You are ${config.name}, an AI assistant.`,
        },
        {
          role: "user",
          content: `${REFINE_PROMPT}\n\n以下是需要整理的Markdown笔记：\n\n${markdown}`,
        },
      ],
    });

    const choice = response.choices[0];
    const refined = choice?.message?.content || "";
    const truncated = choice?.finish_reason === "length";

    return Response.json({ markdown: refined, truncated });
  } catch (error) {
    console.error("Refine error:", error);
    const message =
      error instanceof Error ? error.message : "整理过程中发生未知错误";
    return Response.json({ error: message }, { status: 500 });
  }
}
