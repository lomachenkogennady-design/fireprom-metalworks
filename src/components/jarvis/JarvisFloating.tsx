"use client";

import { useState } from "react";
import { usePathname } from "next/navigation";
import JarvisChat from "./JarvisChat";
import type { JarvisContext } from "@/lib/jarvis-api";

interface Props {
  context?: JarvisContext;
}

export default function JarvisFloating({ context }: Props) {
  const [open, setOpen] = useState(false);
  const pathname = usePathname();

  const ctx: JarvisContext = {
    ...context,
    path: context?.path ?? pathname,
  };

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        title="Jarvis — ассистент"
        className="fixed bottom-4 right-4 z-[90] flex h-14 w-14 items-center justify-center rounded-full bg-amber-500 text-2xl text-slate-900 shadow-lg transition hover:scale-105 hover:bg-amber-400 active:scale-95"
        style={{ bottom: "calc(1rem + env(safe-area-inset-bottom))" }}
      >
        🧊
      </button>
      <JarvisChat open={open} onClose={() => setOpen(false)} context={ctx} />
    </>
  );
}
