"use client";

import { useState, useCallback, useMemo, useRef, useEffect } from "react";
import ReactMarkdown from "react-markdown";
import remarkMath from "remark-math";
import remarkGfm from "remark-gfm";
import rehypeKatex from "rehype-katex";
import rehypeHighlight from "rehype-highlight";
import ExpandPanel from "./expand-panel";
import AnalysisPanel from "./analysis-panel";

interface MarkdownViewerProps {
  content: string;
  onInsertNote?: (expandIndex: number, noteText: string) => void;
  onAppendMarkdown?: (text: string) => void;
  onAddExpandMarker?: (concept: string) => void;
  context: string;
  modelId: string;
}

type Segment =
  | { type: "markdown"; text: string }
  | { type: "admonition"; admonitionType: string; title: string; body: string };

/**
 * Preprocess markdown to extract `!!! type "title"` blocks into segments.
 * Each segment is either plain markdown or an admonition block.
 */
function splitAdmonitions(md: string): Segment[] {
  const segments: Segment[] = [];
  const lines = md.split("\n");
  let i = 0;
  let buf: string[] = [];

  const flush = () => {
    const text = buf.join("\n");
    if (text.trim()) segments.push({ type: "markdown", text });
    buf = [];
  };

  while (i < lines.length) {
    const match = lines[i].match(/^!!!\s*(\w+)\s*(?:"([^"]*)"|([^\s].*))?\s*$/);
    if (match) {
      flush();
      const admonitionType = match[1] || "note";
      const title = match[2] || match[3] || "";
      i++;
      const bodyLines: string[] = [];
      while (i < lines.length) {
        const line = lines[i];
        if (line.match(/^(\s{4}|\t)/)) {
          bodyLines.push(line.replace(/^(\s{4}|\t)/, ""));
          i++;
        } else if (line.trim() === "" && i + 1 < lines.length && lines[i + 1].match(/^(\s{4}|\t)/)) {
          bodyLines.push("");
          i++;
        } else {
          break;
        }
      }
      const body = bodyLines.join("\n").trim();
      segments.push({ type: "admonition", admonitionType, title, body: body || title });
    } else {
      buf.push(lines[i]);
      i++;
    }
  }
  flush();
  return segments;
}

/**
 * Extract selected text from a Range, reconstructing KaTeX formulas
 * back to LaTeX $...$ / $$...$$ notation using the <annotation> tag
 * that KaTeX embeds in its rendered output.
 */
function extractSelectedTextWithFormulas(range: Range): string {
  const fragment = range.cloneContents();
  const tempDiv = document.createElement("div");
  tempDiv.appendChild(fragment);

  function processNode(node: ChildNode): string {
    if (node.nodeType === Node.TEXT_NODE) {
      return node.textContent || "";
    }
    if (node.nodeType !== Node.ELEMENT_NODE) return "";
    const el = node as HTMLElement;

    if (el.classList.contains("katex-display")) {
      const ann = el.querySelector('annotation[encoding="application/x-tex"]');
      return ann ? `\n$$${ann.textContent}$$\n` : "";
    }
    if (el.classList.contains("katex")) {
      const ann = el.querySelector('annotation[encoding="application/x-tex"]');
      return ann ? `$${ann.textContent}$` : "";
    }

    let result = "";
    for (const child of Array.from(el.childNodes)) {
      result += processNode(child);
    }
    return result;
  }

  let text = processNode(tempDiv);
  text = text.replace(/\n{3,}/g, "\n\n");
  return text.trim();
}

const MARKDOWN_COMPONENTS = {
  h1: ({ children }: any) => (
    <h1 className="mb-4 mt-6 text-2xl font-bold">{children}</h1>
  ),
  h2: ({ children }: any) => (
    <h2 className="mb-3 mt-5 text-xl font-semibold">{children}</h2>
  ),
  h3: ({ children }: any) => (
    <h3 className="mb-2 mt-4 text-lg font-semibold">{children}</h3>
  ),
  ul: ({ children }: any) => (
    <ul className="mb-3 ml-6 list-disc space-y-1">{children}</ul>
  ),
  ol: ({ children }: any) => (
    <ol className="mb-3 ml-6 list-decimal space-y-1">{children}</ol>
  ),
  blockquote: ({ children }: any) => (
    <blockquote className="mb-3 border-l-4 border-blue-400 pl-4 italic text-zinc-600">
      {children}
    </blockquote>
  ),
  strong: ({ children }: any) => (
    <strong className="font-semibold text-zinc-900">{children}</strong>
  ),
  code: ({ className, children, ...props }: any) => {
    const isInline = !className;
    if (isInline) {
      return (
        <code className="rounded bg-zinc-100 px-1.5 py-0.5 text-sm" {...props}>
          {children}
        </code>
      );
    }
    return (
      <code className={className} {...props}>
        {children}
      </code>
    );
  },
  pre: ({ children }: any) => (
    <pre className="mb-3 overflow-x-auto rounded-lg bg-zinc-900 p-4 text-sm text-zinc-100">
      {children}
    </pre>
  ),
  table: ({ children }: any) => (
    <div className="mb-3 overflow-x-auto">
      <table className="min-w-full border-collapse border border-zinc-300">
        {children}
      </table>
    </div>
  ),
  th: ({ children }: any) => (
    <th className="border border-zinc-300 bg-zinc-100 px-3 py-2 text-left text-sm font-semibold">
      {children}
    </th>
  ),
  td: ({ children }: any) => (
    <td className="border border-zinc-300 px-3 py-2 text-sm">{children}</td>
  ),
};

const ADMONITION_STYLES: Record<string, { border: string; bg: string; titleColor: string }> = {
  note: { border: "#bfdbfe", bg: "rgba(239,246,255,0.5)", titleColor: "#1d4ed8" },
  warning: { border: "#fde68a", bg: "rgba(255,251,235,0.5)", titleColor: "#b45309" },
  tip: { border: "#bbf7d0", bg: "rgba(240,253,244,0.5)", titleColor: "#15803d" },
  info: { border: "#a5b4fc", bg: "rgba(238,242,255,0.5)", titleColor: "#4338ca" },
};

function AdmonitionBlock({
  admonitionType,
  title,
  body,
}: {
  admonitionType: string;
  title: string;
  body: string;
}) {
  const style = ADMONITION_STYLES[admonitionType] || ADMONITION_STYLES.note;
  return (
    <div
      className="mb-4 overflow-x-hidden rounded-lg border"
      style={{ borderColor: style.border, backgroundColor: style.bg }}
    >
      <div
        className="border-b px-4 py-2 text-sm font-semibold"
        style={{
          borderColor: style.border,
          color: style.titleColor,
          backgroundColor: style.bg,
        }}
      >
        {title || admonitionType.toUpperCase()}
      </div>
      <div
        className="prose prose-sm prose-zinc max-w-none px-4 py-3"
        style={{ overflowWrap: "break-word", wordBreak: "break-word" }}
      >
        <ReactMarkdown
          remarkPlugins={[remarkMath, remarkGfm]}
          rehypePlugins={[rehypeKatex]}
          components={MARKDOWN_COMPONENTS}
        >
          {body}
        </ReactMarkdown>
      </div>
    </div>
  );
}

export default function MarkdownViewer({
  content,
  onInsertNote,
  onAppendMarkdown,
  onAddExpandMarker,
  context,
  modelId,
}: MarkdownViewerProps) {
  const viewerRef = useRef<HTMLDivElement>(null);
  const markerInputRef = useRef<HTMLInputElement>(null);
  const selectionTextRef = useRef<string>("");
  const justSelectedRef = useRef(false);
  const [expandedConcepts, setExpandedConcepts] = useState<
    Map<number, string>
  >(new Map());
  const [selectionInfo, setSelectionInfo] = useState<{
    text: string;
    rect: DOMRect;
  } | null>(null);
  const [showAnalysis, setShowAnalysis] = useState(false);
  const [analysisText, setAnalysisText] = useState("");
  const [showMarkerInput, setShowMarkerInput] = useState(false);
  const [markerConcept, setMarkerConcept] = useState("");

  const handleExpand = useCallback((index: number, concept: string) => {
    setExpandedConcepts((prev) => {
      const next = new Map(prev);
      if (next.has(index)) {
        next.delete(index);
      } else {
        next.set(index, concept);
      }
      return next;
    });
  }, []);

  const handleInsertAndClose = useCallback(
    (expandIndex: number, noteText: string) => {
      onInsertNote?.(expandIndex, noteText);
      setExpandedConcepts((prev) => {
        const next = new Map(prev);
        next.delete(expandIndex);
        return next;
      });
    },
    [onInsertNote]
  );

  useEffect(() => {
    const handleMouseUp = () => {
      const sel = window.getSelection();
      if (!sel || sel.isCollapsed || sel.toString().trim() === "") return;
      const range = sel.getRangeAt(0);
      if (!viewerRef.current?.contains(range.commonAncestorContainer)) return;
      const text = extractSelectedTextWithFormulas(range);
      if (!text) return;
      selectionTextRef.current = text;
      justSelectedRef.current = true;
      setShowAnalysis(false);
      setShowMarkerInput(false);
      setSelectionInfo({ text, rect: range.getBoundingClientRect() });
    };
    const handleClickDismiss = (e: MouseEvent) => {
      if (justSelectedRef.current) {
        justSelectedRef.current = false;
        return;
      }
      const target = e.target as HTMLElement;
      if (
        viewerRef.current &&
        !viewerRef.current.contains(target) &&
        !target.closest("[data-ai-analyze-btn]")
      ) {
        setSelectionInfo(null);
        setShowMarkerInput(false);
        setMarkerConcept("");
      }
    };
    document.addEventListener("mouseup", handleMouseUp);
    document.addEventListener("click", handleClickDismiss);
    return () => {
      document.removeEventListener("mouseup", handleMouseUp);
      document.removeEventListener("click", handleClickDismiss);
    };
  }, []);

  const segments = useMemo(() => splitAdmonitions(content), [content]);

  if (!content) {
    return (
      <div className="flex h-full items-center justify-center text-zinc-400">
        <p>识别结果将显示在这里</p>
      </div>
    );
  }

  // Split each markdown segment by expand markers, then interleave
  const renderedParts: React.ReactNode[] = [];
  let expandIndex = 0;

  for (let s = 0; s < segments.length; s++) {
    const seg = segments[s];

    if (seg.type === "admonition") {
      renderedParts.push(
        <AdmonitionBlock
          key={`adm-${s}`}
          admonitionType={seg.admonitionType}
          title={seg.title}
          body={seg.body}
        />
      );
      continue;
    }

    // Split markdown segment by expand markers
    const parts = seg.text.split(/(<!--\s*expand:(.+?)\s*-->)/g);
    for (let i = 0; i < parts.length; i++) {
      if (i % 3 === 0) {
        if (parts[i]) {
          renderedParts.push(
            <ReactMarkdown
              key={`md-${s}-${i}`}
              remarkPlugins={[remarkMath, remarkGfm]}
              rehypePlugins={[rehypeKatex, rehypeHighlight]}
              components={MARKDOWN_COMPONENTS}
            >
              {parts[i]}
            </ReactMarkdown>
          );
        }
      } else if (i % 3 === 1) {
        const concept = parts[i + 1];
        const currentIndex = expandIndex++;
        renderedParts.push(
          <div key={`expand-${s}-${i}`} className="my-2">
            <button
              onClick={() => handleExpand(currentIndex, concept)}
              className="inline-flex items-center gap-1 rounded-full bg-blue-100 px-3 py-1 text-xs font-medium text-blue-700 transition-colors hover:bg-blue-200"
            >
              <svg
                className="h-3 w-3"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M13 16h-1v-4h-1m1-4h.01M12 2a10 10 0 100 20 10 10 0 000-20z"
                />
              </svg>
              {concept}
            </button>
            {expandedConcepts.has(currentIndex) && (
              <div className="mt-2">
                <ExpandPanel
                  concept={concept}
                  context={content}
                  modelId={modelId}
                  onClose={() => handleExpand(currentIndex, concept)}
                  onInsert={
                    onInsertNote
                      ? (noteText) =>
                          handleInsertAndClose(currentIndex, noteText)
                      : undefined
                  }
                />
              </div>
            )}
          </div>
        );
        i++;
      }
    }
  }

  return (
    <div className="relative">
      <div
        ref={viewerRef}
        data-markdown-viewer
        className="prose prose-zinc max-w-none"
        style={{
          overflowWrap: "break-word",
          wordBreak: "break-word",
        }}
        onMouseDown={(e) => {
          if (!(e.target as HTMLElement).closest("[data-ai-analyze-btn]")) {
            requestAnimationFrame(() => {
              if (justSelectedRef.current) {
                justSelectedRef.current = false;
                return;
              }
              setSelectionInfo(null);
              setShowMarkerInput(false);
            });
          }
        }}
      >
        {renderedParts}
      </div>

      {/* Floating toolbar near selection */}
      {selectionInfo && !showAnalysis && !showMarkerInput && viewerRef.current && (() => {
        const viewerRect = viewerRef.current!.getBoundingClientRect();
        const left =
          selectionInfo.rect.left -
          viewerRect.left +
          selectionInfo.rect.width / 2;
        const topRaw = selectionInfo.rect.top - viewerRect.top - 40;
        const top = topRaw < 0
          ? selectionInfo.rect.bottom - viewerRect.top + 8
          : topRaw;
        return (
          <div
            data-ai-analyze-btn
            className="absolute z-50 flex items-center gap-1 rounded-lg bg-white px-1.5 py-1 shadow-lg border border-zinc-200"
            style={{ left, top, transform: "translateX(-50%)" }}
          >
            <button
              onClick={() => {
                setAnalysisText(selectionTextRef.current);
                setShowAnalysis(true);
                setSelectionInfo(null);
                window.getSelection()?.removeAllRanges();
              }}
              className="flex items-center gap-1 rounded-md bg-blue-600 px-2.5 py-1 text-xs text-white transition-colors hover:bg-blue-700"
            >
              <svg className="h-3 w-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
              </svg>
              AI 解析
            </button>
            {onAddExpandMarker && (
              <button
                onClick={() => {
                  setMarkerConcept(selectionTextRef.current.slice(0, 30));
                  setShowMarkerInput(true);
                }}
                className="flex items-center gap-1 rounded-md bg-emerald-600 px-2.5 py-1 text-xs text-white transition-colors hover:bg-emerald-700"
              >
                <svg className="h-3 w-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                </svg>
                添加标记
              </button>
            )}
          </div>
        );
      })()}

      {/* Inline marker concept input */}
      {showMarkerInput && selectionInfo && viewerRef.current && (() => {
        const viewerRect = viewerRef.current!.getBoundingClientRect();
        const left =
          selectionInfo.rect.left -
          viewerRect.left +
          selectionInfo.rect.width / 2;
        const topRaw = selectionInfo.rect.top - viewerRect.top - 40;
        const top = topRaw < 0
          ? selectionInfo.rect.bottom - viewerRect.top + 8
          : topRaw;
        return (
          <div
            data-ai-analyze-btn
            className="absolute z-50 flex items-center gap-1.5 rounded-lg bg-white px-2 py-1.5 shadow-lg border border-zinc-200"
            style={{ left, top, transform: "translateX(-50%)" }}
          >
            <input
              ref={markerInputRef}
              autoFocus
              value={markerConcept}
              onChange={(e) => setMarkerConcept(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && markerConcept.trim()) {
                  onAddExpandMarker?.(markerConcept.trim());
                  setShowMarkerInput(false);
                  setSelectionInfo(null);
                  setMarkerConcept("");
                  window.getSelection()?.removeAllRanges();
                } else if (e.key === "Escape") {
                  setShowMarkerInput(false);
                  setMarkerConcept("");
                }
              }}
              className="w-40 rounded border border-zinc-300 px-2 py-0.5 text-xs outline-none focus:border-emerald-500"
              placeholder="概念名称"
            />
            <button
              onClick={() => {
                if (markerConcept.trim()) {
                  onAddExpandMarker?.(markerConcept.trim());
                  setShowMarkerInput(false);
                  setSelectionInfo(null);
                  setMarkerConcept("");
                  window.getSelection()?.removeAllRanges();
                }
              }}
              className="rounded bg-emerald-600 px-2 py-0.5 text-xs text-white hover:bg-emerald-700"
            >
              确认
            </button>
            <button
              onClick={() => {
                setShowMarkerInput(false);
                setMarkerConcept("");
              }}
              className="rounded px-1.5 py-0.5 text-xs text-zinc-500 hover:bg-zinc-100"
            >
              取消
            </button>
          </div>
        );
      })()}

      {/* Analysis panel below content */}
      {showAnalysis && (
        <div className="mt-4">
          <AnalysisPanel
            selectedText={analysisText}
            context={context}
            modelId={modelId}
            onClose={() => setShowAnalysis(false)}
            onInsert={onAppendMarkdown}
          />
        </div>
      )}
    </div>
  );
}
