"use client";

export interface HistoryItem {
  input: string;
  result: string;
}

interface Props {
  items: HistoryItem[];
  onSelect: (item: HistoryItem) => void;
  onClear: () => void;
}

export default function History({ items, onSelect, onClear }: Props) {
  if (items.length === 0) return null;
  return (
    <section aria-labelledby="history-title" className="flex flex-col gap-3">
      <div className="flex items-center justify-between">
        <h2 id="history-title" className="text-lg font-semibold">
          История
        </h2>
        <button
          type="button"
          onClick={onClear}
          className="rounded-lg px-3 py-1 text-zinc-300 underline hover:text-white focus-visible:outline-2 focus-visible:outline-red-400"
        >
          Очистить
        </button>
      </div>
      <ul className="flex flex-col gap-2">
        {items.map((item, i) => (
          <li key={`${i}-${item.input}`}>
            <button
              type="button"
              onClick={() => onSelect(item)}
              className="w-full rounded-lg border border-zinc-700 p-3 text-left hover:bg-zinc-900 focus-visible:outline-2 focus-visible:outline-red-400"
            >
              <span className="block text-sm text-zinc-300">{item.input}</span>
              <span className="block font-medium">{item.result}</span>
            </button>
          </li>
        ))}
      </ul>
    </section>
  );
}
