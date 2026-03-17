import { useState, useEffect, useRef } from "react";

const STORAGE_KEY = "looping-tool-column-visibility";

interface Props {
  columns: { id: string; label: string }[];
  visibility: Record<string, boolean>;
  onChange: (visibility: Record<string, boolean>) => void;
}

export function useColumnVisibility(
  columnIds: string[]
): [Record<string, boolean>, (v: Record<string, boolean>) => void] {
  const [visibility, setVisibility] = useState<Record<string, boolean>>(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored) return JSON.parse(stored);
    } catch {}
    return Object.fromEntries(columnIds.map((id) => [id, true]));
  });

  const save = (v: Record<string, boolean>) => {
    setVisibility(v);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(v));
  };

  return [visibility, save];
}

export function ColumnVisibility({ columns, visibility, onChange }: Props) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [open]);

  return (
    <div className="relative" ref={ref}>
      <button
        onClick={() => setOpen(!open)}
        className="p-1.5 rounded border border-border bg-surface text-text-secondary hover:text-text-primary transition-colors"
        title="Настроить колонки"
      >
        <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M12.22 2h-.44a2 2 0 0 0-2 2v.18a2 2 0 0 1-1 1.73l-.43.25a2 2 0 0 1-2 0l-.15-.08a2 2 0 0 0-2.73.73l-.22.38a2 2 0 0 0 .73 2.73l.15.1a2 2 0 0 1 1 1.72v.51a2 2 0 0 1-1 1.74l-.15.09a2 2 0 0 0-.73 2.73l.22.38a2 2 0 0 0 2.73.73l.15-.08a2 2 0 0 1 2 0l.43.25a2 2 0 0 1 1 1.73V20a2 2 0 0 0 2 2h.44a2 2 0 0 0 2-2v-.18a2 2 0 0 1 1-1.73l.43-.25a2 2 0 0 1 2 0l.15.08a2 2 0 0 0 2.73-.73l.22-.39a2 2 0 0 0-.73-2.73l-.15-.08a2 2 0 0 1-1-1.74v-.5a2 2 0 0 1 1-1.74l.15-.09a2 2 0 0 0 .73-2.73l-.22-.38a2 2 0 0 0-2.73-.73l-.15.08a2 2 0 0 1-2 0l-.43-.25a2 2 0 0 1-1-1.73V4a2 2 0 0 0-2-2z"/>
          <circle cx="12" cy="12" r="3"/>
        </svg>
      </button>
      {open && (
        <div className="absolute right-0 top-full mt-1 z-50 bg-surface border border-border rounded shadow-lg p-2 min-w-48">
          {columns.map((col) => (
            <label key={col.id} className="flex items-center gap-2 px-2 py-1 text-sm cursor-pointer hover:bg-row-hover rounded">
              <input
                type="checkbox"
                checked={visibility[col.id] !== false}
                onChange={(e) => {
                  onChange({ ...visibility, [col.id]: e.target.checked });
                }}
              />
              {col.label}
            </label>
          ))}
        </div>
      )}
    </div>
  );
}
