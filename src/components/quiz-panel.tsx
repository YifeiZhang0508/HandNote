"use client";

import { useState, useCallback, useEffect } from "react";
import ReactMarkdown from "react-markdown";
import remarkMath from "remark-math";
import remarkGfm from "remark-gfm";
import rehypeKatex from "rehype-katex";

interface QuizQuestion {
  question: string;
  options: string[];
  answer: number;
  explanation: string;
  relatedConcept: string;
}

interface QuizState {
  questions: QuizQuestion[];
  currentIndex: number;
  selectedAnswer: number | null;
  isRevealed: boolean;
  deepExplanation: string | null;
  isExplaining: boolean;
  scores: (boolean | null)[]; // null = not answered yet
  selectedAnswers: (number | null)[];
}

interface QuizPanelProps {
  markdown: string;
  modelId: string;
  onClose: () => void;
  onAppendMarkdown?: (text: string) => void;
}

export default function QuizPanel({
  markdown,
  modelId,
  onClose,
  onAppendMarkdown,
}: QuizPanelProps) {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [quiz, setQuiz] = useState<QuizState | null>(null);
  const [insertedQuestions, setInsertedQuestions] = useState<Set<number>>(new Set());

  // Generate quiz on mount
  useEffect(() => {
    generateQuiz();
  }, []);

  async function generateQuiz() {
    try {
      setLoading(true);
      setError(null);
      const res = await fetch("/api/quiz", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ markdown, modelId }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "出题失败");

      setQuiz({
        questions: data.quiz,
        currentIndex: 0,
        selectedAnswer: null,
        isRevealed: false,
        deepExplanation: null,
        isExplaining: false,
        scores: new Array(data.quiz.length).fill(null),
        selectedAnswers: new Array(data.quiz.length).fill(null),
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : "出题失败");
    } finally {
      setLoading(false);
    }
  }

  function handleSelect(optionIndex: number) {
    if (!quiz || quiz.isRevealed) return;
    setQuiz((prev) => {
      if (!prev) return prev;
      const newAnswers = [...prev.selectedAnswers];
      newAnswers[prev.currentIndex] = optionIndex;
      return { ...prev, selectedAnswer: optionIndex, selectedAnswers: newAnswers };
    });
  }

  function handleSubmit() {
    if (!quiz || quiz.selectedAnswer === null) return;
    const isCorrect =
      quiz.selectedAnswer === quiz.questions[quiz.currentIndex].answer;
    setQuiz((prev) => {
      if (!prev) return prev;
      const newScores = [...prev.scores];
      newScores[prev.currentIndex] = isCorrect;
      return { ...prev, isRevealed: true, scores: newScores };
    });
  }

  function handleGiveUp() {
    if (!quiz) return;
    setQuiz((prev) => {
      if (!prev) return prev;
      const newScores = [...prev.scores];
      newScores[prev.currentIndex] = false;
      return {
        ...prev,
        selectedAnswer: prev.questions[prev.currentIndex].answer,
        isRevealed: true,
        scores: newScores,
      };
    });
  }

  function handleNext() {
    if (!quiz) return;
    const nextIdx = quiz.currentIndex + 1;
    if (nextIdx < quiz.questions.length) {
      setQuiz((prev) =>
        prev
          ? {
              ...prev,
              currentIndex: nextIdx,
              selectedAnswer: prev.selectedAnswers[nextIdx],
              isRevealed: prev.scores[nextIdx] !== null,
              deepExplanation: null,
            }
          : prev
      );
    }
  }

  function handlePrev() {
    if (!quiz) return;
    const prevIdx = quiz.currentIndex - 1;
    if (prevIdx >= 0) {
      setQuiz((prev) =>
        prev
          ? {
              ...prev,
              currentIndex: prevIdx,
              selectedAnswer: prev.selectedAnswers[prevIdx],
              isRevealed: prev.scores[prevIdx] !== null,
              deepExplanation: null,
            }
          : prev
      );
    }
  }

  async function handleDeepExplain() {
    if (!quiz) return;
    const q = quiz.questions[quiz.currentIndex];
    setQuiz((prev) =>
      prev ? { ...prev, isExplaining: true } : prev
    );

    try {
      const res = await fetch("/api/quiz", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          markdown,
          modelId,
          action: "explain",
          question: q.question + "\n" + q.options.join("\n"),
          userAnswer:
            quiz.selectedAnswer !== null
              ? q.options[quiz.selectedAnswer]
              : "放弃",
          correctAnswer: q.options[q.answer],
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "解释失败");
      setQuiz((prev) =>
        prev ? { ...prev, deepExplanation: data.explanation } : prev
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : "解释失败");
    } finally {
      setQuiz((prev) =>
        prev ? { ...prev, isExplaining: false } : prev
      );
    }
  }

  function handleInsertQuestion() {
    if (!quiz || !onAppendMarkdown) return;
    const q = quiz.questions[quiz.currentIndex];
    const optionsText = q.options
      .map((opt) => `> ${opt}`)
      .join("\n");
    const correctOption = q.options[q.answer].replace(/^[A-D]\.\s*/, "");
    const quotedExplanation = q.explanation
      .split("\n")
      .map((line) => `> ${line}`)
      .join("\n");
    const noteBlock = `\n\n**题目** (${q.relatedConcept})\n\n${q.question}\n\n${optionsText}\n\n> **正确答案**: ${String.fromCharCode(65 + q.answer)}. ${correctOption}\n\n${quotedExplanation}\n`;
    onAppendMarkdown(noteBlock);
    setInsertedQuestions((prev) => new Set(prev).add(quiz.currentIndex));
  }

  // ---- Render ----

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center gap-4 py-16">
        <div className="h-8 w-8 animate-spin rounded-full border-3 border-purple-500 border-t-transparent" />
        <p className="text-sm text-zinc-500">正在出题...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex flex-col items-center gap-4 py-12">
        <p className="text-sm text-red-500">{error}</p>
        <button
          onClick={generateQuiz}
          className="rounded-lg bg-purple-600 px-4 py-2 text-sm text-white hover:bg-purple-700"
        >
          重新出题
        </button>
      </div>
    );
  }

  if (!quiz || quiz.questions.length === 0) return null;

  const q = quiz.questions[quiz.currentIndex];
  const isCorrect = quiz.selectedAnswer === q.answer;
  const correctCount = quiz.scores.filter((s) => s === true).length;
  const answeredCount = quiz.scores.filter((s) => s !== null).length;
  const allDone = answeredCount === quiz.questions.length;

  return (
    <div className="flex flex-col gap-5">
      {/* Header bar */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <h3 className="text-sm font-semibold text-purple-700">
            第 {quiz.currentIndex + 1} / {quiz.questions.length} 题
          </h3>
          <span className="text-xs text-zinc-400">
            {q.relatedConcept}
          </span>
        </div>
        <div className="flex items-center gap-2">
          <span className="rounded-full bg-purple-100 px-2.5 py-0.5 text-xs font-medium text-purple-700">
            {correctCount} / {answeredCount} 正确
          </span>
          <button
            onClick={onClose}
            className="text-zinc-400 hover:text-zinc-600"
          >
            <svg
              className="h-5 w-5"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M6 18L18 6M6 6l12 12"
              />
            </svg>
          </button>
        </div>
      </div>

      {/* Question progress dots */}
      <div className="flex items-center gap-1.5">
        {quiz.questions.map((_, idx) => {
          const score = quiz.scores[idx];
          let color = "bg-zinc-200"; // not answered
          if (score === true) color = "bg-green-500";
          else if (score === false) color = "bg-red-400";
          return (
            <button
              key={idx}
              onClick={() =>
                setQuiz((prev) =>
                  prev
                    ? {
                        ...prev,
                        currentIndex: idx,
                        selectedAnswer: prev.selectedAnswers[idx],
                        isRevealed: prev.scores[idx] !== null,
                        deepExplanation: null,
                      }
                    : prev
                )
              }
              className={`h-2 w-2 rounded-full transition-colors ${
                idx === quiz.currentIndex
                  ? "ring-2 ring-purple-400 ring-offset-1"
                  : ""
              } ${color}`}
            />
          );
        })}
      </div>

      {/* Question */}
      <div className="prose prose-sm prose-zinc max-w-none rounded-lg bg-zinc-50 p-4">
        <ReactMarkdown
          remarkPlugins={[remarkMath, remarkGfm]}
          rehypePlugins={[rehypeKatex]}
        >
          {q.question}
        </ReactMarkdown>
      </div>

      {/* Options */}
      <div className="flex flex-col gap-2">
        {q.options.map((opt, idx) => {
          const isSelected = quiz.selectedAnswer === idx;
          const isAnswer = idx === q.answer;
          let style =
            "border-zinc-200 bg-white hover:border-purple-300 hover:bg-purple-50";

          if (quiz.isRevealed) {
            if (isAnswer) {
              style =
                "border-green-400 bg-green-50";
            } else if (isSelected && !isAnswer) {
              style =
                "border-red-400 bg-red-50";
            } else {
              style =
                "border-zinc-200 bg-zinc-50 opacity-60";
            }
          } else if (isSelected) {
            style =
              "border-purple-400 bg-purple-50";
          }

          return (
            <button
              key={idx}
              onClick={() => handleSelect(idx)}
              disabled={quiz.isRevealed}
              className={`flex items-start gap-3 rounded-lg border px-4 py-3 text-left text-sm transition-colors ${style}`}
            >
              <span
                className={`mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full border text-xs font-medium ${
                  isSelected
                    ? "border-purple-500 bg-purple-500 text-white"
                    : "border-zinc-300"
                }`}
              >
                {String.fromCharCode(65 + idx)}
              </span>
              <span className="flex-1 prose prose-sm prose-zinc max-w-none [&>:first-child]:mt-0 [&>:last-child]:mb-0">
                <ReactMarkdown
                  remarkPlugins={[remarkMath, remarkGfm]}
                  rehypePlugins={[rehypeKatex]}
                  components={{
                    p: ({ children }) => <span>{children}</span>,
                  }}
                >
                  {opt.replace(/^[A-D]\.\s*/, "")}
                </ReactMarkdown>
              </span>
              {quiz.isRevealed && isAnswer && (
                <svg
                  className="h-5 w-5 shrink-0 text-green-500"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M5 13l4 4L19 7"
                  />
                </svg>
              )}
              {quiz.isRevealed && isSelected && !isAnswer && (
                <svg
                  className="h-5 w-5 shrink-0 text-red-500"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M6 18L18 6M6 6l12 12"
                  />
                </svg>
              )}
            </button>
          );
        })}
      </div>

      {/* Action buttons */}
      <div className="flex items-center gap-2">
        {!quiz.isRevealed ? (
          <>
            <button
              onClick={handleSubmit}
              disabled={quiz.selectedAnswer === null}
              className="flex-1 rounded-lg bg-purple-600 px-4 py-2.5 text-sm font-medium text-white transition-colors hover:bg-purple-700 disabled:opacity-40"
            >
              提交答案
            </button>
            <button
              onClick={handleGiveUp}
              className="rounded-lg border border-zinc-200 px-4 py-2.5 text-sm text-zinc-500 transition-colors hover:bg-zinc-100"
            >
              放弃
            </button>
          </>
        ) : (
          <>
            {!allDone && (
              <button
                onClick={handleNext}
                className="flex-1 rounded-lg bg-purple-600 px-4 py-2.5 text-sm font-medium text-white transition-colors hover:bg-purple-700"
              >
                下一题
              </button>
            )}
            {quiz.currentIndex > 0 && (
              <button
                onClick={handlePrev}
                className="rounded-lg border border-zinc-200 px-4 py-2.5 text-sm transition-colors hover:bg-zinc-100"
              >
                上一题
              </button>
            )}
            {onAppendMarkdown && (
              <button
                onClick={handleInsertQuestion}
                disabled={insertedQuestions.has(quiz.currentIndex)}
                className={`rounded-lg border px-4 py-2.5 text-sm transition-colors ${
                  insertedQuestions.has(quiz.currentIndex)
                    ? "border-green-200 bg-green-50 text-green-700"
                    : "border-blue-200 bg-blue-50 text-blue-700 hover:bg-blue-100"
                }`}
              >
                {insertedQuestions.has(quiz.currentIndex) ? "已插入" : "插入笔记"}
              </button>
            )}
          </>
        )}
      </div>

      {/* Explanation (shown after reveal) */}
      {quiz.isRevealed && (
        <div
          className={`rounded-lg border p-4 ${
            isCorrect
              ? "border-green-200 bg-green-50/50"
              : "border-amber-200 bg-amber-50/50"
          }`}
        >
          <div className="mb-2 flex items-center justify-between">
            <h4
              className={`text-sm font-semibold ${
                isCorrect
                  ? "text-green-700"
                  : "text-amber-700"
              }`}
            >
              {isCorrect ? "回答正确!" : "回答错误"}
            </h4>
            <button
              onClick={handleDeepExplain}
              disabled={quiz.isExplaining}
              className="flex items-center gap-1 rounded-md bg-purple-100 px-2.5 py-1 text-xs font-medium text-purple-700 transition-colors hover:bg-purple-200 disabled:opacity-50"
            >
              {quiz.isExplaining ? (
                <>
                  <span className="h-3 w-3 animate-spin rounded-full border-2 border-purple-500 border-t-transparent" />
                  生成中...
                </>
              ) : (
                <>
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
                  进一步解释
                </>
              )}
            </button>
          </div>
          <div className="prose prose-sm prose-zinc max-w-none text-sm leading-relaxed">
            <ReactMarkdown
              remarkPlugins={[remarkMath, remarkGfm]}
              rehypePlugins={[rehypeKatex]}
            >
              {q.explanation}
            </ReactMarkdown>
          </div>
        </div>
      )}

      {/* Deep explanation */}
      {quiz.deepExplanation && (
        <div className="rounded-lg border border-purple-200 bg-purple-50/50 p-4">
          <h4 className="mb-2 text-sm font-semibold text-purple-700">
            深入解析
          </h4>
          <div className="prose prose-sm prose-zinc max-w-none text-sm leading-relaxed">
            <ReactMarkdown
              remarkPlugins={[remarkMath, remarkGfm]}
              rehypePlugins={[rehypeKatex]}
            >
              {quiz.deepExplanation}
            </ReactMarkdown>
          </div>
        </div>
      )}

      {/* Summary when all done */}
      {allDone && (
        <div className="rounded-lg border border-purple-200 bg-purple-50 p-4 text-center">
          <p className="text-lg font-semibold text-purple-700">
            测验完成！
          </p>
          <p className="mt-1 text-sm text-zinc-600">
            正确率：{correctCount} / {quiz.questions.length}（
            {Math.round((correctCount / quiz.questions.length) * 100)}%）
          </p>
          <button
            onClick={generateQuiz}
            className="mt-3 rounded-lg bg-purple-600 px-4 py-2 text-sm text-white hover:bg-purple-700"
          >
            重新出题
          </button>
        </div>
      )}
    </div>
  );
}
