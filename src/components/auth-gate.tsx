"use client";

import { useState, useEffect, type ReactNode } from "react";

const AUTH_KEY = "handnote_authed";

export default function AuthGate({ children }: { children: ReactNode }) {
  const [authed, setAuthed] = useState<boolean | null>(null);
  const [input, setInput] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [shake, setShake] = useState(false);

  useEffect(() => {
    setAuthed(sessionStorage.getItem(AUTH_KEY) === "1");
  }, []);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError("");
    try {
      const res = await fetch("/api/auth", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ passphrase: input }),
      });
      const data = await res.json();
      if (data.ok) {
        sessionStorage.setItem(AUTH_KEY, "1");
        setAuthed(true);
      } else {
        setError(data.error || "验证失败");
        setShake(true);
        setTimeout(() => setShake(false), 500);
      }
    } catch {
      setError("网络错误");
      setShake(true);
      setTimeout(() => setShake(false), 500);
    } finally {
      setLoading(false);
    }
  }

  if (authed === null) return null; // hydration guard

  if (authed) return <>{children}</>;

  return (
    <div className="flex flex-1 flex-col items-center justify-center overflow-hidden px-6">
      {/* 背景装饰 */}
      <div className="bg-decoration decoration-1" />
      <div className="bg-decoration decoration-2" />
      <div className="bg-decoration decoration-3" />

      <div
        className={`animate-fade-in-up flex w-full max-w-lg flex-col items-center ${
          shake ? "auth-shake" : ""
        }`}
      >
        {/* 第一行标语 */}
        <h1 className="auth-title">HandNote</h1>

        {/* 装饰分隔线 */}
        <div className="auth-divider" />

        {/* 第二行标语 + 闪烁光标 */}
        <p className="auth-subtitle" style={{ whiteSpace: "nowrap" }}>
          转工管群ISGSNSG | 一定要赶上和超过转群先进水平
          <span className="cursor-blink" />
        </p>

        {/* 表单区域 */}
        <form
          onSubmit={handleSubmit}
          className="animate-fade-in-up-d1 mt-10 flex w-full max-w-sm flex-col items-center gap-5"
        >
          {/* 输入框 */}
          <div className="w-full">
            <input
              type="password"
              value={input}
              onChange={(e) => {
                setInput(e.target.value);
                if (error) setError("");
              }}
              placeholder="输入口令以解锁..."
              autoFocus
              className="auth-input"
            />
            {error && (
              <p className="mt-2.5 text-center text-xs text-red-500">{error}</p>
            )}
          </div>

          {/* 解锁按钮 */}
          <button
            type="submit"
            disabled={loading || !input}
            className="auth-btn"
          >
            {loading ? (
              <span className="flex items-center gap-2">
                <span className="h-4 w-4 animate-spin rounded-full border-2 border-white/40 border-t-white" />
                验证中...
              </span>
            ) : (
              <>
                <svg
                  className="mr-2 h-4 w-4"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z"
                  />
                </svg>
                解锁
              </>
            )}
          </button>
        </form>
      </div>

      {/* 底部水印 */}
      <div className="animate-fade-in-up-d2 absolute bottom-6 text-xs text-zinc-300">
        转工管群ISGSNSG | 一定要赶上和超过转群先进水平
      </div>

      <style>{`
        .auth-title {
          font-size: 3.5rem;
          font-weight: 700;
          color: #1a5fb4;
          line-height: 1.1;
          position: relative;
          display: inline-block;
          margin-bottom: 20px;
        }
        .auth-title::before,
        .auth-title::after {
          content: "";
          position: absolute;
          height: 4px;
          background: linear-gradient(90deg, transparent, #1a5fb4, transparent);
          width: 60%;
          left: 20%;
        }
        .auth-title::before { top: -15px; }
        .auth-title::after { bottom: -15px; }

        .auth-divider {
          height: 2px;
          width: 200px;
          background: linear-gradient(90deg, transparent, #1a5fb4, #62a0ea, transparent);
          margin-bottom: 24px;
        }

        .auth-subtitle {
          font-size: 2.8rem;
          font-weight: 600;
          color: #3584e4;
          line-height: 1.3;
          text-align: center;
        }

        .auth-input {
          width: 100%;
          border-radius: 12px;
          border: 2px solid #e4e4e7;
          background: white;
          padding: 14px 20px;
          font-size: 0.95rem;
          outline: none;
          transition: all 0.3s ease;
          text-align: center;
          letter-spacing: 2px;
        }
        .auth-input::placeholder {
          letter-spacing: 0;
          color: #a1a1aa;
        }
        .auth-input:focus {
          border-color: #1a5fb4;
          box-shadow: 0 0 0 4px rgba(26, 95, 180, 0.1);
        }

        .auth-btn {
          display: inline-flex;
          align-items: center;
          justify-content: center;
          width: 100%;
          padding: 14px 32px;
          background: linear-gradient(135deg, #1a5fb4, #3584e4);
          color: white;
          font-size: 1rem;
          font-weight: 600;
          text-decoration: none;
          border-radius: 12px;
          border: none;
          cursor: pointer;
          transition: all 0.3s ease;
          box-shadow: 0 4px 12px rgba(26, 95, 180, 0.2);
          position: relative;
          overflow: hidden;
        }
        .auth-btn::before {
          content: '';
          position: absolute;
          top: 0;
          left: 0;
          width: 100%;
          height: 100%;
          background: linear-gradient(135deg, rgba(255, 255, 255, 0.1), rgba(255, 255, 255, 0));
          opacity: 0;
          transition: opacity 0.3s ease;
        }
        .auth-btn:hover:not(:disabled) {
          transform: translateY(-3px);
          box-shadow: 0 8px 20px rgba(26, 95, 180, 0.3);
        }
        .auth-btn:hover:not(:disabled)::before {
          opacity: 1;
        }
        .auth-btn:active:not(:disabled) {
          transform: translateY(-1px);
          box-shadow: 0 4px 12px rgba(26, 95, 180, 0.3);
        }
        .auth-btn:disabled {
          opacity: 0.5;
          cursor: not-allowed;
        }

        .auth-shake {
          animation: shake 0.5s ease-in-out;
        }
        @keyframes shake {
          0%, 100% { transform: translateX(0); }
          10%, 50%, 90% { transform: translateX(-6px); }
          30%, 70% { transform: translateX(6px); }
        }

        @media (max-width: 768px) {
          .auth-title { font-size: 2.5rem; }
          .auth-subtitle { font-size: 1.6rem; white-space: normal; }
          .auth-divider { width: 150px; }
        }

        @media (max-width: 480px) {
          .auth-title { font-size: 2rem; }
          .auth-subtitle { font-size: 1.3rem; white-space: normal; }
          .auth-divider { width: 120px; }
          .auth-input { padding: 12px 16px; }
        }
      `}</style>
    </div>
  );
}
