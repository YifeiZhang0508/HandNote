import { getClient } from "@/lib/client";
import { getModelConfig } from "@/lib/models";
import { CHAT_PROMPT } from "@/lib/prompts";

export const dynamic = "force-dynamic";
export const maxDuration = 120;

export async function POST(request: Request) {
  try {
    const { messages, context, modelId } = await request.json();

    if (!messages || !Array.isArray(messages) || messages.length === 0) {
      return Response.json(
        { error: "请提供对话内容" },
        { status: 400 }
      );
    }

    const config = getModelConfig(modelId || "mimo");
    const client = getClient(config);

    const systemMessage = `${CHAT_PROMPT}

笔记内容：
${context || "（无笔记内容）"}`;

    const response = await client.chat.completions.create({
      model: config.model,
      max_completion_tokens: 2048,
      messages: [
        { role: "system", content: systemMessage },
        ...messages.map((m: { role: string; content: string }) => ({
          role: m.role as "user" | "assistant",
          content: m.content,
        })),
      ],
    });

    const reply = response.choices[0]?.message?.content || "";

    return Response.json({ reply });
  } catch (error) {
    console.error("Chat error:", error);
    const message =
      error instanceof Error ? error.message : "对话过程中发生未知错误";
    return Response.json({ error: message }, { status: 500 });
  }
}
