import { useState } from "react";

const STORAGE_KEY = "looping-tool-column-visibility";

export function useColumnVisibility(
  columnIds: string[]
): [Record<string, boolean>, (v: Record<string, boolean>) => void] {
  const [visibility, setVisibility] = useState<Record<string, boolean>>(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored) return JSON.parse(stored);
    } catch {
      // ignore parse errors, use defaults
    }
    return Object.fromEntries(columnIds.map((id) => [id, true]));
  });

  const save = (v: Record<string, boolean>) => {
    setVisibility(v);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(v));
  };

  return [visibility, save];
}
