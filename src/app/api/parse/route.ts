import { getClient } from "@/lib/client";
import { getModelConfig } from "@/lib/models";
import { PARSE_PROMPT } from "@/lib/prompts";

export const dynamic = "force-dynamic";
export const maxDuration = 120;

export async function POST(request: Request) {
  try {
    const { images, modelId } = await request.json();

    if (!images || !Array.isArray(images) || images.length === 0) {
      return Response.json({ error: "请提供至少一张图片" }, { status: 400 });
    }

    const config = getModelConfig(modelId || "mimo");

    if (!config.supportsVision) {
      return Response.json(
        { error: `${config.name} 暂不支持图片识别，请选择支持视觉的模型` },
        { status: 400 }
      );
    }

    const client = getClient(config);

    // Build multimodal content array
    const content: Array<
      | { type: "image_url"; image_url: { url: string } }
      | { type: "text"; text: string }
    > = [];

    for (const img of images) {
      content.push({
        type: "image_url",
        image_url: {
          url: `data:${img.mimeType};base64,${img.base64}`,
        },
      });
    }

    const multiImageHint =
      images.length > 1
        ? `\n\n注意：用户上传了 ${images.length} 张图片，可能是同一页笔记的不同部分或多页笔记。请按顺序识别所有图片内容，合并为一份完整的Markdown文档。如果图片之间有连续性，请保持内容的连贯。`
        : "";

    content.push({
      type: "text",
      text: PARSE_PROMPT + multiImageHint,
    });

    const response = await client.chat.completions.create({
      model: config.model,
      max_completion_tokens: 32768,
      messages: [
        {
          role: "system",
          content: `You are ${config.name}, an AI assistant. Today's date: ${new Date().toISOString().split("T")[0]}.`,
        },
        {
          role: "user",
          content,
        },
      ],
    });

    const choice = response.choices[0];
    const markdown = choice?.message?.content || "";
    const truncated = choice?.finish_reason === "length";

    return Response.json({ markdown, truncated });
  } catch (error) {
    console.error("Parse error:", error);
    const message =
      error instanceof Error ? error.message : "解析过程中发生未知错误";
    return Response.json({ error: message }, { status: 500 });
  }
}
