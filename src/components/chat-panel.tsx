"use client";

import { useState, useCallback, useRef, useEffect } from "react";
import ReactMarkdown from "react-markdown";
import remarkMath from "remark-math";
import remarkGfm from "remark-gfm";
import rehypeKatex from "rehype-katex";

interface Message {
  role: "user" | "assistant";
  content: string;
}

interface ChatPanelProps {
  context: string;
  modelId: string;
  onClose: () => void;
  onAppendMarkdown?: (text: string) => void;
}

export default function ChatPanel({
  context,
  modelId,
  onClose,
  onAppendMarkdown,
}: ChatPanelProps) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [lastFailedMessages, setLastFailedMessages] = useState<Message[] | null>(null);
  const [insertedIndices, setInsertedIndices] = useState<Set<number>>(new Set());
  const listRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    listRef.current?.scrollTo({ top: listRef.current.scrollHeight });
  }, [messages]);

  const handleSend = useCallback(async (retryMessages?: Message[]) => {
    const isRetry = !!retryMessages;
    const text = isRetry ? retryMessages[retryMessages.length - 1].content : input.trim();
    if (!text || loading) return;

    const userMessage: Message = { role: "user", content: text };
    const newMessages = isRetry ? retryMessages! : [...messages, userMessage];
    if (!isRetry) {
      setMessages(newMessages);
      setInput("");
    }
    setLoading(true);
    setError(null);
    setLastFailedMessages(null);

    try {
      // Limit to last 20 messages to avoid token limits
      const recentMessages = newMessages.slice(-20);
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          messages: recentMessages.map((m) => ({ role: m.role, content: m.content })),
          context,
          modelId,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "对话失败");
      setMessages((prev) => [...prev, { role: "assistant", content: data.reply }]);
    } catch (err) {
      setError(err instanceof Error ? err.message : "请求失败");
      if (!isRetry) setLastFailedMessages(newMessages);
    } finally {
      setLoading(false);
      inputRef.current?.focus();
    }
  }, [input, loading, messages, context, modelId]);

  return (
    <div className="flex h-full flex-col">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-zinc-200 px-4 py-3">
        <h3 className="text-sm font-semibold text-zinc-700">AI 对话</h3>
        <button onClick={onClose} className="text-zinc-400 hover:text-zinc-600">
          <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      </div>

      {/* Messages */}
      <div ref={listRef} className="flex-1 overflow-y-auto px-4 py-3 space-y-3">
        {messages.length === 0 && (
          <div className="flex h-full items-center justify-center text-sm text-zinc-400">
            <p>输入问题开始对话</p>
          </div>
        )}
        {messages.map((msg, i) => (
          <div
            key={i}
            className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}
          >
            <div
              className={`max-w-[85%] rounded-2xl px-3.5 py-2 text-sm ${
                msg.role === "user"
                  ? "bg-blue-600 text-white"
                  : "bg-zinc-100 text-zinc-700"
              }`}
            >
              {msg.role === "assistant" ? (
                <>
                  <div className="prose prose-sm prose-zinc max-w-none [&>:first-child]:mt-0 [&>:last-child]:mb-0">
                    <ReactMarkdown
                      remarkPlugins={[remarkMath, remarkGfm]}
                      rehypePlugins={[rehypeKatex]}
                    >
                      {msg.content}
                    </ReactMarkdown>
                  </div>
                  {onAppendMarkdown && (
                    <button
                      onClick={() => {
                        const userMsg = i > 0 && messages[i - 1].role === "user" ? messages[i - 1].content : "";
                        const truncated = userMsg.length > 50 ? userMsg.slice(0, 50) + "..." : userMsg;
                        const quotedAnswer = msg.content
                          .split("\n")
                          .map((line) => `> ${line}`)
                          .join("\n");
                        const noteBlock = `\n\n**AI对话** (${truncated})\n\n**问**: ${userMsg}\n\n${quotedAnswer}\n`;
                        onAppendMarkdown(noteBlock);
                        setInsertedIndices((prev) => new Set(prev).add(i));
                      }}
                      disabled={insertedIndices.has(i)}
                      className={`mt-1.5 flex items-center gap-1 rounded-md px-2 py-0.5 text-xs transition-colors ${
                        insertedIndices.has(i)
                          ? "bg-green-100 text-green-700"
                          : "bg-blue-100 text-blue-700 hover:bg-blue-200"
                      }`}
                    >
                      {insertedIndices.has(i) ? "已插入" : "插入笔记"}
                    </button>
                  )}
                </>
              ) : (
                msg.content
              )}
            </div>
          </div>
        ))}
        {loading && (
          <div className="flex justify-start">
            <div className="rounded-2xl bg-zinc-100 px-3.5 py-2">
              <div className="flex items-center gap-1.5">
                <span className="h-2 w-2 animate-bounce rounded-full bg-zinc-400 [animation-delay:0ms]" />
                <span className="h-2 w-2 animate-bounce rounded-full bg-zinc-400 [animation-delay:150ms]" />
                <span className="h-2 w-2 animate-bounce rounded-full bg-zinc-400 [animation-delay:300ms]" />
              </div>
            </div>
          </div>
        )}
        {error && (
          <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-600">
            {error}
            <button onClick={() => lastFailedMessages && handleSend(lastFailedMessages)} className="ml-2 underline hover:no-underline">重试</button>
          </div>
        )}
      </div>

      {/* Input */}
      <div className="border-t border-zinc-200 px-4 py-3">
        <div className="flex items-center gap-2">
          <input
            ref={inputRef}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                handleSend();
              }
            }}
            placeholder="输入问题..."
            className="flex-1 rounded-lg border border-zinc-300 px-3 py-2 text-sm outline-none transition-colors focus:border-blue-500"
            disabled={loading}
          />
          <button
            onClick={() => handleSend()}
            disabled={!input.trim() || loading}
            className="rounded-lg bg-blue-600 p-2 text-white transition-colors hover:bg-blue-700 disabled:opacity-40"
          >
            <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 12h14M12 5l7 7-7 7" />
            </svg>
          </button>
        </div>
      </div>
    </div>
  );
}
