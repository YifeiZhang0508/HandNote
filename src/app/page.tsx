"use client";

import { useState, useCallback, useEffect, useRef } from "react";
import ImageUploader from "@/components/image-uploader";
import MarkdownViewer from "@/components/markdown-viewer";
import MarkdownEditor from "@/components/markdown-editor";
import ModelSelector from "@/components/model-selector";
import QuizPanel from "@/components/quiz-panel";
import ChatPanel from "@/components/chat-panel";
import AuthGate from "@/components/auth-gate";

interface ImageFile {
  id: string;
  base64: string;
  mimeType: string;
  preview: string;
  name: string;
}

const API_TIMEOUT = 120_000;

async function fetchWithTimeout(
  url: string,
  options: RequestInit,
  timeout = API_TIMEOUT
) {
  const controller = new AbortController();
  const id = setTimeout(() => controller.abort(), timeout);
  try {
    return await fetch(url, { ...options, signal: controller.signal });
  } finally {
    clearTimeout(id);
  }
}

export default function Home() {
  const [markdown, setMarkdown] = useState("");
  const [isProcessing, setIsProcessing] = useState(false);
  const [isRefining, setIsRefining] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [modelId, setModelId] = useState("mimo");
  const [batchCount, setBatchCount] = useState(0);
  const [showQuiz, setShowQuiz] = useState(false);
  const [showChat, setShowChat] = useState(false);
  const [editMode, setEditMode] = useState(false);
  const cursorRef = useRef<HTMLSpanElement>(null);

  // 背景装饰随鼠标微动
  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      const x = e.clientX / window.innerWidth;
      const y = e.clientY / window.innerHeight;
      document.querySelectorAll(".bg-decoration").forEach((el, i) => {
        const speed = 0.5 + i * 0.2;
        const moveX = (x - 0.5) * 20 * speed;
        const moveY = (y - 0.5) * 20 * speed;
        (el as HTMLElement).style.transform = `translate(${moveX}px, ${moveY}px)`;
      });
    };
    document.addEventListener("mousemove", handleMouseMove);
    return () => document.removeEventListener("mousemove", handleMouseMove);
  }, []);

  // 光标点击强调效果
  useEffect(() => {
    const handleClick = () => {
      const cursor = cursorRef.current;
      if (!cursor) return;
      cursor.style.backgroundColor = "#e01b24";
      cursor.style.transform = "scale(1.2)";
      setTimeout(() => {
        cursor.style.backgroundColor = "#1a5fb4";
        cursor.style.transform = "scale(1)";
      }, 200);
    };
    document.addEventListener("click", handleClick);
    return () => document.removeEventListener("click", handleClick);
  }, []);

  // Escape 关闭模态框
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        if (showQuiz) setShowQuiz(false);
        else if (showChat) setShowChat(false);
      }
    };
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [showQuiz, showChat]);

  const handleConfirm = useCallback(
    async (images: ImageFile[]) => {
      setIsProcessing(true);
      setError(null);
      try {
        const res = await fetchWithTimeout("/api/parse", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            images: images.map((img) => ({
              base64: img.base64,
              mimeType: img.mimeType,
            })),
            modelId,
          }),
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || "解析失败");
        setMarkdown((prev) =>
          prev ? prev + `\n\n---\n\n` + data.markdown : data.markdown
        );
        setBatchCount((c) => c + 1);
        if (data.truncated) {
          setError("⚠️ 输出内容较长，部分结果可能被截断。建议减少单次上传图片数量后重试。");
        }
      } catch (err) {
        if (err instanceof DOMException && err.name === "AbortError") {
          setError("请求超时，请减少图片数量或重试");
        } else {
          setError(err instanceof Error ? err.message : "请求失败");
        }
      } finally {
        setIsProcessing(false);
      }
    },
    [modelId]
  );

  const handleClear = useCallback(() => {
    setMarkdown("");
    setBatchCount(0);
    setError(null);
    setEditMode(false);
  }, []);

  const handleMarkdownUpload = useCallback((content: string) => {
    if (!content.trim()) return;
    setMarkdown((prev) => (prev ? prev + `\n\n---\n\n` + content : content));
  }, []);

  const handleMarkdownChange = useCallback((value: string) => {
    setMarkdown(value);
  }, []);

  const handleCopy = useCallback(async () => {
    if (!markdown) return;
    try {
      await navigator.clipboard.writeText(markdown);
    } catch {
      setError("复制失败，请手动选择复制");
    }
  }, [markdown]);

  const handleDownload = useCallback(() => {
    if (!markdown) return;
    const blob = new Blob([markdown], { type: "text/markdown" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "notes.md";
    a.click();
    URL.revokeObjectURL(url);
  }, [markdown]);

  const handleRefine = useCallback(async () => {
    if (!markdown) return;
    setIsRefining(true);
    setError(null);
    try {
      const res = await fetchWithTimeout("/api/refine", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ markdown, modelId }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "整理失败");
      if (!data.markdown?.trim()) throw new Error("整理结果为空，请重试");
      setMarkdown(data.markdown);
      if (data.truncated) {
        setError("⚠️ 整理结果较长，部分输出可能被截断。");
      }
    } catch (err) {
      if (err instanceof DOMException && err.name === "AbortError") {
        setError("整理超时，请重试");
      } else {
        setError(err instanceof Error ? err.message : "整理失败");
      }
    } finally {
      setIsRefining(false);
    }
  }, [markdown, modelId]);

  const handleInsertNote = useCallback(
    (expandIndex: number, noteText: string) => {
      setMarkdown((prev) => {
        const markerRegex = /<!--\s*expand:(.+?)\s*-->/g;
        let count = 0;
        let match: RegExpExecArray | null;
        while ((match = markerRegex.exec(prev)) !== null) {
          if (count === expandIndex) {
            return (
              prev.slice(0, match.index + match[0].length) +
              noteText +
              prev.slice(match.index + match[0].length)
            );
          }
          count++;
        }
        return prev + noteText;
      });
    },
    []
  );

  const handleAppendMarkdown = useCallback((text: string) => {
    setMarkdown((prev) => prev + text);
  }, []);

  const handleAddExpandMarker = useCallback((concept: string) => {
    setMarkdown((prev) => prev + `\n<!-- expand:${concept} -->`);
  }, []);

  const getExportHTML = useCallback((): string => {
    const viewerEl = document.querySelector("[data-markdown-viewer]");
    const bodyHTML = viewerEl?.innerHTML || "";
    return `<!DOCTYPE html>
<html lang="zh-CN">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>HandNote 导出</title>
<link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/katex@0.16.45/dist/katex.min.css">
<style>
body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', 'PingFang SC', 'Microsoft YaHei', sans-serif; max-width: 800px; margin: 0 auto; padding: 2rem; color: #333; line-height: 1.7; }
h1 { font-size: 1.8rem; font-weight: 700; margin: 1.5rem 0 1rem; }
h2 { font-size: 1.4rem; font-weight: 600; margin: 1.3rem 0 0.8rem; }
h3 { font-size: 1.2rem; font-weight: 600; margin: 1.2rem 0 0.6rem; }
ul, ol { margin: 0.5rem 0; padding-left: 1.5rem; }
li { margin: 0.25rem 0; }
blockquote { border-left: 4px solid #3584e4; padding-left: 1rem; color: #666; font-style: italic; margin: 0.8rem 0; }
code { background: #f4f4f5; padding: 0.15rem 0.4rem; border-radius: 4px; font-size: 0.9em; }
pre { background: #18181b; color: #f4f4f5; padding: 1rem; border-radius: 8px; overflow-x: auto; }
pre code { background: transparent; padding: 0; }
table { border-collapse: collapse; width: 100%; margin: 0.8rem 0; }
th, td { border: 1px solid #d4d4d8; padding: 0.5rem 0.75rem; text-align: left; }
th { background: #f4f4f5; font-weight: 600; }
.katex-display { margin: 1em 0; overflow-x: auto; }
.katex { font-size: 1.1em; }
</style>
</head>
<body>
${bodyHTML}
</body>
</html>`;
  }, []);

  const handleExportHTML = useCallback(() => {
    const html = getExportHTML();
    const blob = new Blob([html], { type: "text/html" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "notes.html";
    a.click();
    URL.revokeObjectURL(url);
  }, [getExportHTML]);

  const handleExportPDF = useCallback(() => {
    const html = getExportHTML();
    const win = window.open("", "_blank");
    if (win) {
      win.document.write(html);
      win.document.close();
      win.onload = () => win.print();
    } else {
      setError("弹窗被浏览器拦截，请允许弹窗后重试");
    }
  }, [getExportHTML]);

  return (
    <AuthGate>
    <div className="flex flex-1 flex-col">
      {/* 背景装饰 */}
      <div className="bg-decoration decoration-1" />
      <div className="bg-decoration decoration-2" />
      <div className="bg-decoration decoration-3" />

      {/* Header */}
      <header className="border-b border-zinc-200/60 bg-white/80 px-6 py-3 backdrop-blur-sm">
        <div className="mx-auto flex max-w-7xl items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-gradient-to-br from-[#1a5fb4] to-[#3584e4] text-white">
              <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
              </svg>
            </div>
            <h1 className="text-base font-semibold hero-gradient">HandNote</h1>
          </div>
          <div className="flex items-center gap-3">
            <ModelSelector value={modelId} onChange={setModelId} disabled={isProcessing || isRefining} />
            {markdown && (
              <>
                <button onClick={handleCopy} className="flex items-center gap-1 rounded-lg border border-zinc-200 px-2.5 py-1.5 text-xs transition-colors hover:bg-zinc-100">
                  复制
                </button>
                <button onClick={handleDownload} className="flex items-center gap-1 rounded-lg bg-gradient-to-r from-[#1a5fb4] to-[#3584e4] px-2.5 py-1.5 text-xs text-white shadow-sm transition-all hover:shadow-md">
                  下载 .md
                </button>
                <button onClick={handleExportHTML} className="flex items-center gap-1 rounded-lg border border-zinc-200 px-2.5 py-1.5 text-xs transition-colors hover:bg-zinc-100">
                  导出 HTML
                </button>
                <button onClick={handleExportPDF} className="flex items-center gap-1 rounded-lg border border-zinc-200 px-2.5 py-1.5 text-xs transition-colors hover:bg-zinc-100">
                  导出 PDF
                </button>
                <button onClick={() => setShowChat(true)} className="flex items-center gap-1 rounded-lg border border-emerald-200 bg-emerald-50 px-2.5 py-1.5 text-xs text-emerald-700 transition-colors hover:bg-emerald-100">
                  AI 对话
                </button>
                <button onClick={() => setShowQuiz(true)} disabled={isProcessing || isRefining} className="flex items-center gap-1 rounded-lg border border-amber-200 bg-amber-50 px-2.5 py-1.5 text-xs text-amber-700 transition-colors hover:bg-amber-100 disabled:opacity-50">
                  开始测验
                </button>
                <button onClick={handleRefine} disabled={isRefining || isProcessing} className="flex items-center gap-1 rounded-lg border border-purple-200 bg-purple-50 px-2.5 py-1.5 text-xs text-purple-700 transition-colors hover:bg-purple-100 disabled:opacity-50">
                  {isRefining ? "整理中..." : "一键整理"}
                </button>
              </>
            )}
          </div>
        </div>
      </header>

      {/* Main */}
      <main className="mx-auto flex w-full max-w-7xl flex-1 gap-6 p-6">
        {/* 左侧：标语 + 上传 */}
        <div className="flex w-full flex-col gap-4 lg:w-[420px]">
          {/* 标语 */}
          <div className="animate-fade-in-up text-center lg:text-left">
            <h2 className="slogan-title">HandNote</h2>
            <div className="slogan-divider mx-auto my-2 lg:mx-0" />
            <p className="slogan-subtitle">
              转工管群ISGSNSG
              <span ref={cursorRef} className="cursor-blink" />
            </p>
          </div>

          {/* 上传区 */}
          <div className="animate-fade-in-up-d1">
            <div className="mb-1 flex items-center justify-between">
              <h3 className="text-sm font-medium text-zinc-500">上传笔记图片</h3>
              {batchCount > 0 && (
                <span className="rounded-full bg-blue-100 px-2 py-0.5 text-xs text-blue-600">
                  已处理 {batchCount} 批
                </span>
              )}
            </div>
            <ImageUploader
              onConfirm={handleConfirm}
              isProcessing={isProcessing}
              hasExistingContent={!!markdown}
              onClear={handleClear}
              onMarkdownUpload={handleMarkdownUpload}
            />
            <div className="mt-3 rounded-lg border border-zinc-200/60 bg-zinc-50/80 px-3 py-2.5 text-xs leading-relaxed text-zinc-500">
              <p className="mb-1 font-medium text-zinc-600">使用提示</p>
              <ul className="space-y-0.5 list-disc list-inside">
                <li>支持多张图片同时上传，内容会自动拼接</li>
                <li>支持上传 .md 文件直接导入 Markdown 内容</li>
                <li>AI 圈选解析请在第一次处理完成后再发起第二次</li>
                <li>测验、对话等功能基于当前识别结果生成</li>
              </ul>
            </div>
            {error && (
              <div className="mt-3 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-600">
                {error}
              </div>
            )}
          </div>
        </div>

        {/* 右侧：Markdown 输出 */}
        <div className="flex flex-1 flex-col gap-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <h3 className="text-sm font-medium text-zinc-500">Markdown 输出</h3>
              {markdown && (
                <div className="flex items-center rounded-lg border border-zinc-200 bg-zinc-50 p-0.5">
                  <button
                    onClick={() => setEditMode(false)}
                    className={`flex items-center gap-1 rounded-md px-2.5 py-1 text-xs transition-colors ${
                      !editMode
                        ? "bg-white text-zinc-900 shadow-sm font-medium"
                        : "text-zinc-500 hover:text-zinc-700"
                    }`}
                  >
                    <svg className="h-3.5 w-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                    </svg>
                    预览
                  </button>
                  <button
                    onClick={() => setEditMode(true)}
                    className={`flex items-center gap-1 rounded-md px-2.5 py-1 text-xs transition-colors ${
                      editMode
                        ? "bg-white text-zinc-900 shadow-sm font-medium"
                        : "text-zinc-500 hover:text-zinc-700"
                    }`}
                  >
                    <svg className="h-3.5 w-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                    </svg>
                    编辑
                  </button>
                </div>
              )}
            </div>
            <div className="flex items-center gap-2">
              {isProcessing && (
                <span className="flex items-center gap-1.5 text-xs text-blue-500">
                  <span className="h-3 w-3 animate-spin rounded-full border-2 border-blue-500 border-t-transparent" />
                  正在识别...
                </span>
              )}
              {isRefining && (
                <span className="flex items-center gap-1.5 text-xs text-purple-500">
                  <span className="h-3 w-3 animate-spin rounded-full border-2 border-purple-500 border-t-transparent" />
                  正在整理...
                </span>
              )}
            </div>
          </div>
          <div className="animate-fade-in-up-d2 flex-1 overflow-hidden rounded-xl border border-zinc-200/60 bg-white/80 shadow-sm backdrop-blur-sm">
            {editMode && markdown ? (
              <MarkdownEditor value={markdown} onChange={handleMarkdownChange} />
            ) : (
              <div className="h-full overflow-auto p-6">
                <MarkdownViewer content={markdown} onInsertNote={handleInsertNote} onAppendMarkdown={handleAppendMarkdown} onAddExpandMarker={handleAddExpandMarker} context={markdown} modelId={modelId} />
              </div>
            )}
          </div>
        </div>
      </main>

      {/* Footer */}
      <footer className="border-t border-zinc-200/60 bg-white/60 px-6 py-6 text-center backdrop-blur-sm">
        <div className="mx-auto flex max-w-7xl flex-col items-center gap-3">
          <span className="text-sm font-semibold" style={{ color: "#1a5fb4" }}>转工管群ISGSNSG | 一定要赶上和超过转群先进水平</span>
          <div className="flex flex-wrap items-center justify-center gap-4 text-xs text-zinc-400">
            <a href="http://me.yifeizhang.top/" className="transition-colors hover:text-zinc-600">About me</a>
            <span className="text-zinc-300">|</span>
            <a href="https://github.com/YifeiZhang0508" className="transition-colors hover:text-zinc-600">GitHub</a>
          </div>
          <p className="text-[11px] text-zinc-300">&copy; 2026 HandNote</p>
        </div>
      </footer>

      {/* Quiz Modal */}
      {showQuiz && (
        <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/40 p-4 pt-12 backdrop-blur-sm">
          <div className="w-full max-w-2xl rounded-2xl border border-zinc-200/60 bg-white p-6 shadow-2xl">
            <QuizPanel markdown={markdown} modelId={modelId} onClose={() => setShowQuiz(false)} onAppendMarkdown={handleAppendMarkdown} />
          </div>
        </div>
      )}

      {/* Chat Sidebar */}
      {showChat && (
        <div className="fixed inset-y-0 right-0 z-50 w-96 border-l border-zinc-200/60 bg-white shadow-2xl">
          <ChatPanel context={markdown} modelId={modelId} onClose={() => setShowChat(false)} onAppendMarkdown={handleAppendMarkdown} />
        </div>
      )}
    </div>
    </AuthGate>
  );
}
