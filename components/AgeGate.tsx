"use client";

import { useEffect, useState } from "react";

const KEY = "materizator:adult";
type State = "loading" | "ask" | "ok" | "denied";

export default function AgeGate({ children }: { children: React.ReactNode }) {
  const [state, setState] = useState<State>("loading");

  useEffect(() => {
    let adult = false;
    try {
      adult = localStorage.getItem(KEY) === "1";
    } catch {
      // storage unavailable: ask every time
    }
    // eslint-disable-next-line react-hooks/set-state-in-effect -- read browser storage after mount
    setState(adult ? "ok" : "ask");
  }, []);

  if (state === "loading") return null;
  if (state === "ok") return <>{children}</>;

  return (
    <main className="fixed inset-0 z-50 flex flex-col items-center justify-center gap-8 bg-[#0b0b0f] p-6 text-center">
      {state === "denied" ? (
        <p className="text-2xl font-bold">Сайт только для взрослых</p>
      ) : (
        <>
          <h1 className="text-3xl font-bold">Мне есть 18 лет</h1>
          <p className="max-w-sm text-zinc-300">
            Сайт содержит ненормативную лексику. Подтвердите, что вы достигли совершеннолетия.
          </p>
          <div className="flex gap-4">
            <button
              type="button"
              onClick={() => {
                try {
                  localStorage.setItem(KEY, "1");
                } catch {
                  // ignore
                }
                setState("ok");
              }}
              className="min-w-28 rounded-xl bg-red-600 px-6 py-3 font-semibold text-white hover:bg-red-500 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white"
            >
              Да
            </button>
            <button
              type="button"
              onClick={() => setState("denied")}
              className="min-w-28 rounded-xl border border-zinc-500 px-6 py-3 font-semibold hover:bg-zinc-800 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white"
            >
              Нет
            </button>
          </div>
        </>
      )}
    </main>
  );
}
