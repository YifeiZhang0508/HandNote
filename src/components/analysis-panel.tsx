"use client";

import { useState, useEffect } from "react";
import ReactMarkdown from "react-markdown";
import remarkMath from "remark-math";
import rehypeKatex from "rehype-katex";

interface AnalysisPanelProps {
  selectedText: string;
  context: string;
  modelId: string;
  onClose: () => void;
  onInsert?: (noteText: string) => void;
}

export default function AnalysisPanel({
  selectedText,
  context,
  modelId,
  onClose,
  onInsert,
}: AnalysisPanelProps) {
  const [explanation, setExplanation] = useState<string>("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [inserted, setInserted] = useState(false);

  useEffect(() => {
    fetchAnalysis();
  }, []);

  async function fetchAnalysis() {
    try {
      setLoading(true);
      setError(null);
      const res = await fetch("/api/analyze", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text: selectedText, context, modelId }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "分析失败");
      setExplanation(data.explanation);
    } catch (err) {
      setError(err instanceof Error ? err.message : "请求失败");
    } finally {
      setLoading(false);
    }
  }

  function handleInsert() {
    if (!onInsert || !explanation) return;
    const cleanTitle = selectedText
      .replace(/\$\$[\s\S]*?\$\$/g, "")
      .replace(/\$[^$]*?\$/g, "")
      .replace(/\s+/g, " ")
      .trim();
    const title = cleanTitle.length > 30 ? cleanTitle.slice(0, 30) + "..." : cleanTitle || "AI解析";
    const quotedExplanation = explanation
      .split("\n")
      .map((line) => `> ${line}`)
      .join("\n");
    const noteBlock = `\n\n**AI解析** (${title})\n\n${quotedExplanation}\n`;
    onInsert(noteBlock);
    setInserted(true);
  }

  if (inserted) {
    return (
      <div className="flex items-center gap-2 rounded-lg border border-green-200 bg-green-50 px-4 py-2 text-sm text-green-700">
        <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
        </svg>
        已插入笔记
      </div>
    );
  }

  return (
    <div className="rounded-lg border border-blue-200 bg-blue-50 p-4">
      <div className="mb-2 flex items-center justify-between">
        <h4 className="text-sm font-semibold text-blue-700">AI 解析</h4>
        <div className="flex items-center gap-2">
          {onInsert && explanation && (
            <button
              onClick={handleInsert}
              className="flex items-center gap-1 rounded-md bg-blue-600 px-2.5 py-1 text-xs text-white transition-colors hover:bg-blue-700"
            >
              <svg className="h-3 w-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
              </svg>
              插入笔记
            </button>
          )}
          <button onClick={onClose} className="text-zinc-400 hover:text-zinc-600">
            <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
      </div>

      <div className="mb-3 rounded border border-blue-100 bg-white/60 px-3 py-2 text-xs text-zinc-500">
        <span className="font-medium text-zinc-600">选中内容：</span>
        {selectedText.length > 120 ? selectedText.slice(0, 120) + "..." : selectedText}
      </div>

      {loading && (
        <div className="flex items-center gap-2 text-sm text-zinc-500">
          <div className="h-4 w-4 animate-spin rounded-full border-2 border-blue-500 border-t-transparent" />
          正在分析...
        </div>
      )}

      {error && (
        <div className="text-sm text-red-600">
          {error}
          <button onClick={fetchAnalysis} className="ml-2 underline hover:no-underline">
            重试
          </button>
        </div>
      )}

      {explanation && (
        <div className="prose prose-sm prose-zinc max-w-none text-sm leading-relaxed text-zinc-700">
          <ReactMarkdown
            remarkPlugins={[remarkMath]}
            rehypePlugins={[rehypeKatex]}
          >
            {explanation}
          </ReactMarkdown>
        </div>
      )}
    </div>
  );
}
