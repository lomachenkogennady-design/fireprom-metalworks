"use client";

import { useEffect, useRef, useState } from "react";
import {
  askJarvis,
  checkJarvisHealth,
  JARVIS_DEFAULT_MODEL,
  type JarvisContext,
  type JarvisMessage,
} from "@/lib/jarvis-api";

interface Props {
  open: boolean;
  onClose: () => void;
  context?: JarvisContext;
}

const MODELS = [
  "qwen3:4b-instruct",
  "qwen3:4b",
  "qwen2.5:1.5b",
  "qwen2.5:3b",
  "llama3.1:8b",
  "phi3:latest",
];

function nowTime() {
  return new Date().toLocaleTimeString("ru-RU", {
    hour: "2-digit",
    minute: "2-digit",
  });
}

export default function JarvisChat({ open, onClose, context }: Props) {
  const [history, setHistory] = useState<JarvisMessage[]>([]);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const [model, setModel] = useState(JARVIS_DEFAULT_MODEL);
  const [status, setStatus] = useState<{ ok: boolean; text: string }>({
    ok: false,
    text: "Проверка связи…",
  });
  const scrollRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  // Загрузка истории из localStorage
  useEffect(() => {
    try {
      const saved = localStorage.getItem("jarvis_history");
      if (saved) setHistory(JSON.parse(saved));
    } catch {
      /* ignore */
    }
  }, []);

  // Сохранение
  useEffect(() => {
    if (history.length > 0) {
      localStorage.setItem("jarvis_history", JSON.stringify(history));
    }
  }, [history]);

  // Проверка связи при открытии
  useEffect(() => {
    if (!open) return;
    checkJarvisHealth().then((r) => {
      if (r.ok) {
        setStatus({
          ok: true,
          text: `✅ Связь с Doogee: OK · моделей ${r.models.length}`,
        });
      } else {
        setStatus({ ok: false, text: `❌ Нет связи: ${r.error}` });
      }
    });
  }, [open]);

  // Скролл вниз
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [history, busy]);

  // Фокус на input при открытии
  useEffect(() => {
    if (open) setTimeout(() => inputRef.current?.focus(), 100);
  }, [open]);

  async function send() {
    const text = input.trim();
    if (!text || busy) return;
    setInput("");
    setBusy(true);

    const userMsg: JarvisMessage = { role: "user", content: text, time: nowTime() };
    const historyWithUser = [...history, userMsg];
    setHistory(historyWithUser);

    try {
      const answer = await askJarvis(text, history, { model, context });
      setHistory((prev) => [
        ...prev,
        { role: "assistant", content: answer, time: nowTime() },
      ]);
    } catch (e) {
      setHistory((prev) => [
        ...prev,
        {
          role: "assistant",
          content: `❌ Ошибка: ${e instanceof Error ? e.message : String(e)}`,
          time: nowTime(),
        },
      ]);
    } finally {
      setBusy(false);
    }
  }

  function clearChat() {
    if (!confirm("Очистить историю?")) return;
    setHistory([]);
    localStorage.removeItem("jarvis_history");
  }

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-[100] flex items-end justify-end bg-black/50 p-0 sm:p-4"
      onClick={onClose}
    >
      <div
        className="flex h-[100dvh] w-full flex-col bg-[#0f172a] text-slate-200 shadow-2xl sm:h-[80vh] sm:max-w-lg sm:rounded-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between border-b border-slate-700 bg-slate-800 px-4 py-3">
          <div className="flex items-center gap-2">
            <span className="text-lg">🧊</span>
            <span className="text-sm font-bold text-amber-500">Jarvis</span>
          </div>
          <div className="flex items-center gap-2">
            <select
              value={model}
              onChange={(e) => setModel(e.target.value)}
              className="rounded-md border border-slate-600 bg-slate-900 px-2 py-1 text-[11px] text-slate-200"
            >
              {MODELS.map((m) => (
                <option key={m} value={m}>{m}</option>
              ))}
            </select>
            <button
              onClick={clearChat}
              className="rounded px-2 py-1 text-[11px] text-slate-400 hover:bg-slate-700 hover:text-slate-200"
              title="Очистить историю"
            >
              очистить
            </button>
            <button
              onClick={onClose}
              className="rounded px-2 py-1 text-slate-400 hover:bg-slate-700 hover:text-slate-200"
            >
              ✕
            </button>
          </div>
        </div>

        {/* Status */}
        <div
          className={`px-4 py-1.5 text-[11px] ${
            status.ok ? "text-emerald-400" : "text-red-400"
          }`}
        >
          {status.text}
        </div>

        {/* Messages */}
        <div
          ref={scrollRef}
          className="flex-1 space-y-3 overflow-y-auto px-4 py-3"
        >
          {history.length === 0 && (
            <div className="mt-8 text-center text-xs text-slate-500">
              Задайте вопрос — например: «Какая матрица для 3мм Ст3?»
            </div>
          )}
          {history.map((m, i) => (
            <div
              key={i}
              className={`flex ${m.role === "user" ? "justify-end" : "justify-start"}`}
            >
              <div
                className={`max-w-[85%] whitespace-pre-wrap break-words rounded-2xl px-3.5 py-2 text-[13px] leading-relaxed ${
                  m.role === "user"
                    ? "bg-amber-500 text-slate-900"
                    : "bg-slate-800 text-slate-200"
                }`}
              >
                {m.content}
                {m.time && (
                  <div className="mt-1 text-[10px] opacity-60">{m.time}</div>
                )}
              </div>
            </div>
          ))}
          {busy && (
            <div className="flex justify-start">
              <div className="rounded-2xl bg-slate-800 px-3.5 py-2 text-[13px] italic text-slate-500">
                ⏳ Думаю…
              </div>
            </div>
          )}
        </div>

        {/* Input */}
        <div className="flex items-end gap-2 border-t border-slate-700 bg-slate-800 p-3">
          <textarea
            ref={inputRef}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                send();
              }
            }}
            placeholder="Спросите что-нибудь…"
            rows={1}
            className="max-h-32 min-h-[40px] flex-1 resize-none rounded-xl border border-slate-600 bg-slate-900 px-3 py-2 text-[13px] text-slate-200 outline-none focus:border-amber-500"
          />
          <button
            onClick={send}
            disabled={busy || !input.trim()}
            className="h-10 w-11 shrink-0 rounded-xl bg-amber-500 text-lg text-slate-900 disabled:opacity-50"
          >
            ➤
          </button>
        </div>
      </div>
    </div>
  );
}
