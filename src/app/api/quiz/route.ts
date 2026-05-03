import { getClient } from "@/lib/client";
import { getModelConfig } from "@/lib/models";
import { QUIZ_PROMPT, QUIZ_EXPLAIN_PROMPT } from "@/lib/prompts";

export const dynamic = "force-dynamic";
export const maxDuration = 120;

export async function POST(request: Request) {
  try {
    const { markdown, modelId, action, question, userAnswer, correctAnswer } =
      await request.json();

    if (!markdown) {
      return Response.json(
        { error: "请提供笔记内容" },
        { status: 400 }
      );
    }

    const config = getModelConfig(modelId || "mimo");
    const client = getClient(config);

    let prompt: string;

    if (action === "explain") {
      prompt = `${QUIZ_EXPLAIN_PROMPT}

笔记原文：
${markdown}

题目：${question}
用户选择：${userAnswer}
正确答案：${correctAnswer}

请给出深入解释。`;
    } else {
      prompt = `${QUIZ_PROMPT}\n\n以下是笔记内容：\n\n${markdown}`;
    }

    const response = await client.chat.completions.create({
      model: config.model,
      max_completion_tokens: action === "explain" ? 2048 : 4096,
      messages: [
        {
          role: "system",
          content: `You are ${config.name}, an AI assistant.`,
        },
        { role: "user", content: prompt },
      ],
    });

    const content = response.choices[0]?.message?.content || "";

    if (action === "explain") {
      return Response.json({ explanation: content });
    }

    // Parse quiz JSON from response
    let quiz: unknown;
    try {
      let cleaned = content;

      // Strip markdown code block wrappers: ```json ... ``` or ``` ... ```
      cleaned = cleaned.replace(/^```(?:json)?\s*\n?/i, "").replace(/\n?```\s*$/i, "");

      // Extract JSON array (non-greedy match for top-level [...])
      const jsonMatch = cleaned.match(/\[[\s\S]*?\](?=\s*$|\s*```|\s*\n[^[\s])/);
      const jsonStr = jsonMatch ? jsonMatch[0] : cleaned.trim();

      // First attempt: just remove trailing commas
      const sanitized = jsonStr.replace(/,\s*([\]}])/g, "$1");

      try {
        quiz = JSON.parse(sanitized);
      } catch {
        // Second attempt: also fix unescaped backslashes from LaTeX in LLM output
        // e.g. $\mu$ → $\\mu$, but don't double-escape already valid \\ sequences
        const latexFixed = sanitized
          .replace(/\\(["\\/bfnrt])/g, "\x00ESCAPED$1") // protect valid escapes
          .replace(/\\/g, "\\\\")                          // escape remaining backslashes
          .replace(/\x00ESCAPED(["\\/bfnrt])/g, "\\$1"); // restore valid escapes
        quiz = JSON.parse(latexFixed);
      }
    } catch (e) {
      console.error("Quiz JSON parse error:", e, "Raw content:", content.slice(0, 500));
      return Response.json(
        { error: "题目生成失败，请重试" },
        { status: 500 }
      );
    }

    return Response.json({ quiz });
  } catch (error) {
    console.error("Quiz error:", error);
    const message =
      error instanceof Error ? error.message : "出题过程中发生未知错误";
    return Response.json({ error: message }, { status: 500 });
  }
}
