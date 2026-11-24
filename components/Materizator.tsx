"use client";

import { useEffect, useState } from "react";
import History, { type HistoryItem } from "./History";
import ResultCard from "./ResultCard";
import RewriteForm from "./RewriteForm";

const KEY = "materizator:history";
const MAX_ITEMS = 10;

function loadHistory(): HistoryItem[] {
  try {
    const parsed: unknown = JSON.parse(localStorage.getItem(KEY) ?? "[]");
    if (!Array.isArray(parsed)) return [];
    return parsed
      .filter(
        (x): x is HistoryItem => typeof x?.input === "string" && typeof x?.result === "string",
      )
      .slice(0, MAX_ITEMS);
  } catch {
    return [];
  }
}

function saveHistory(items: HistoryItem[]) {
  try {
    localStorage.setItem(KEY, JSON.stringify(items));
  } catch {
    // storage full or unavailable
  }
}

export default function Materizator() {
  const [result, setResult] = useState<string | null>(null);
  const [history, setHistory] = useState<HistoryItem[]>([]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- read browser storage after mount
    setHistory(loadHistory());
  }, []);

  function onResult(input: string, output: string) {
    setResult(output);
    const next = [{ input, result: output }, ...history].slice(0, MAX_ITEMS);
    setHistory(next);
    saveHistory(next);
  }

  function clear() {
    setHistory([]);
    saveHistory([]);
  }

  return (
    <div className="mx-auto flex min-h-dvh max-w-xl flex-col gap-6 px-4 py-8">
      <header>
        <h1 className="text-4xl font-extrabold">Материзатор</h1>
        <p className="mt-1 text-zinc-300">Напишите фразу — получите её в матерной версии.</p>
      </header>
      <main className="flex flex-col gap-6">
        <RewriteForm onResult={onResult} />
        {result && <ResultCard result={result} />}
        <History items={history} onSelect={(item) => setResult(item.result)} onClear={clear} />
      </main>
      <footer className="mt-auto pt-6 text-sm text-zinc-400">
        Языковая игра. Не используйте для травли людей.
      </footer>
    </div>
  );
}
