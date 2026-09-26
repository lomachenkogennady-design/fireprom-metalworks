/**
 * Jarvis API — клиент к Ollama на Doogee.
 * Адрес берётся из NEXT_PUBLIC_JARVIS_URL (по умолчанию — IP Doogee в локальной сети).
 */
export const JARVIS_URL =
  process.env.NEXT_PUBLIC_JARVIS_URL ?? "http://192.168.10.21:11434";

export const JARVIS_DEFAULT_MODEL = "qwen3:4b-instruct";

export const JARVIS_SYSTEM_PROMPT =
  "Ты Jarvis — ассистент сотрудника компании ФАЙЕРПРОМ (Санкт-Петербург, металлообработка). " +
  "Отвечай кратко, по делу, на русском языке. Помогаешь с гибкой, лазерной резкой, " +
  "подбором материалов, расчётом стоимости. Если знаешь контекст расчёта — учитывай его.";

export interface JarvisMessage {
  role: "user" | "assistant" | "system";
  content: string;
  time?: string;
}

export interface JarvisContext {
  /** Текущий расчёт (материал, толщина, полки и т.п.) */
  calculation?: Record<string, unknown>;
  /** Страница, на которой открыт Jarvis */
  path?: string;
}

export function buildContextPrompt(ctx?: JarvisContext): string {
  if (!ctx) return "";
  const parts: string[] = [];
  if (ctx.path) parts.push(`Пользователь сейчас на странице: ${ctx.path}`);
  if (ctx.calculation) {
    parts.push("Текущий расчёт пользователя:");
    parts.push(JSON.stringify(ctx.calculation, null, 2));
  }
  return parts.length ? "\n\n" + parts.join("\n") : "";
}

/** Проверка, что Ollama жива */
export async function checkJarvisHealth(): Promise<{
  ok: boolean;
  models: string[];
  error?: string;
}> {
  try {
    const res = await fetch(`${JARVIS_URL}/api/tags`, {
      signal: AbortSignal.timeout(5000),
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = await res.json();
    const models = Array.isArray(data.models)
      ? data.models.map((m: { name: string }) => m.name)
      : [];
    return { ok: true, models };
  } catch (e) {
    return {
      ok: false,
      models: [],
      error: e instanceof Error ? e.message : String(e),
    };
  }
}

/** Основной запрос к LLM */
export async function askJarvis(
  prompt: string,
  history: JarvisMessage[],
  options?: {
    model?: string;
    context?: JarvisContext;
    systemPrompt?: string;
  },
): Promise<string> {
  const model = options?.model ?? JARVIS_DEFAULT_MODEL;
  const sys = (options?.systemPrompt ?? JARVIS_SYSTEM_PROMPT) +
    buildContextPrompt(options?.context);

  // Собираем контекст из последних 10 сообщений
  const ctx = history
    .slice(-10)
    .map((m) =>
      m.role === "user"
        ? `Пользователь: ${m.content}`
        : `Jarvis: ${m.content}`,
    )
    .join("\n");

  const fullPrompt = ctx ? `${ctx}\nПользователь: ${prompt}\nJarvis:` : `Пользователь: ${prompt}\nJarvis:`;

  const res = await fetch(`${JARVIS_URL}/api/generate`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      model,
      prompt: fullPrompt,
      system: sys,
      stream: false,
      options: { temperature: 0.4, num_predict: 400, top_p: 0.9 },
    }),
  });
  if (!res.ok) throw new Error(`Ollama ${res.status}`);
  const data = await res.json();
  return (data.response ?? "").trim();
}
