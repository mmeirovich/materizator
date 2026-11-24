"use client";

import { useEffect, useRef, useState } from "react";
import { ERROR_NOT_RUSSIAN, MAX_LENGTH, validateInput } from "@/lib/validate";

interface Props {
  onResult: (input: string, result: string) => void;
}

export default function RewriteForm({ onResult }: Props) {
  const [text, setText] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [popup, setPopup] = useState<string | null>(null);
  const okRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (popup) okRef.current?.focus();
  }, [popup]);

  /** "Not Russian" errors open a popup; everything else stays inline. */
  function showError(message: string) {
    if (message === ERROR_NOT_RUSSIAN) {
      setError(null);
      setPopup(message);
    } else {
      setError(message);
    }
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (loading) return;
    const v = validateInput(text);
    if (!v.ok) {
      showError(v.error);
      return;
    }
    setError(null);
    setLoading(true);
    try {
      const res = await fetch("/api/rewrite", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ text: v.text }),
      });
      const data = (await res.json().catch(() => ({}))) as { result?: string; error?: string };
      if (!res.ok || !data.result) {
        showError(data.error ?? "Что-то пошло не так. Попробуйте ещё раз");
      } else {
        onResult(v.text, data.result);
      }
    } catch {
      setError("Нет связи с сервером. Попробуйте ещё раз");
    } finally {
      setLoading(false);
    }
  }

  return (
    <form onSubmit={submit} className="flex flex-col gap-3" noValidate>
      <label htmlFor="phrase" className="font-medium">
        Ваша фраза
      </label>
      <textarea
        id="phrase"
        value={text}
        maxLength={MAX_LENGTH}
        rows={4}
        placeholder="Введите фразу..."
        onChange={(e) => setText(e.target.value)}
        aria-describedby="phrase-count phrase-error"
        aria-invalid={error ? true : undefined}
        className="w-full resize-none rounded-xl border border-zinc-600 bg-zinc-900 p-3 text-lg placeholder:text-zinc-400 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-red-400"
      />
      <div className="flex items-start justify-between gap-3">
        <p id="phrase-error" role="alert" className="min-h-6 text-red-400">
          {error}
        </p>
        <span id="phrase-count" className="shrink-0 text-sm text-zinc-300">
          {text.length}/{MAX_LENGTH}
        </span>
      </div>
      <button
        type="submit"
        disabled={loading}
        className="flex items-center justify-center gap-2 rounded-xl bg-red-600 px-6 py-3 text-lg font-semibold text-white hover:bg-red-500 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white disabled:cursor-not-allowed disabled:opacity-60"
      >
        {loading && (
          <span
            aria-hidden="true"
            className="size-5 animate-spin rounded-full border-2 border-white border-t-transparent"
          />
        )}
        Переписать
      </button>
      {popup && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-6">
          <div
            role="alertdialog"
            aria-modal="true"
            aria-labelledby="popup-text"
            onKeyDown={(e) => e.key === "Escape" && setPopup(null)}
            className="w-full max-w-sm rounded-2xl border border-red-500 bg-zinc-900 p-6 text-center"
          >
            <p id="popup-text" className="mb-6 text-xl font-bold">
              {popup}
            </p>
            <button
              ref={okRef}
              type="button"
              onClick={() => setPopup(null)}
              className="rounded-xl bg-red-600 px-8 py-2 font-semibold text-white hover:bg-red-500 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white"
            >
              Понял
            </button>
          </div>
        </div>
      )}
    </form>
  );
}
