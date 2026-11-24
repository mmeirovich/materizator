"use client";

import { useState } from "react";

const btn =
  "rounded-lg border border-zinc-500 px-4 py-2 font-medium hover:bg-zinc-800 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-red-400";

export default function ResultCard({ result }: { result: string }) {
  const [copied, setCopied] = useState(false);
  const canShare = typeof navigator !== "undefined" && typeof navigator.share === "function";

  async function copy() {
    try {
      await navigator.clipboard.writeText(result);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      // clipboard unavailable
    }
  }

  async function share() {
    try {
      await navigator.share({ text: result });
    } catch {
      // user cancelled
    }
  }

  return (
    <section
      aria-labelledby="result-title"
      className="rounded-xl border border-zinc-700 bg-zinc-900 p-4"
    >
      <h2 id="result-title" className="mb-2 text-sm text-zinc-300">
        Результат
      </h2>
      <p aria-live="polite" className="mb-4 text-2xl leading-snug font-semibold break-words">
        {result}
      </p>
      <div className="flex flex-wrap gap-3">
        <button type="button" onClick={copy} className={btn}>
          {copied ? "Скопировано" : "Копировать"}
        </button>
        {canShare && (
          <button type="button" onClick={share} className={btn}>
            Поделиться
          </button>
        )}
      </div>
    </section>
  );
}
