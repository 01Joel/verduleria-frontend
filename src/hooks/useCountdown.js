import { useEffect, useMemo, useState } from "react";

function pad2(n) {
  return String(n).padStart(2, "0");
}

export function formatRemaining(ms) {
  const total = Math.max(0, Math.floor(ms / 1000));
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;
  return `${pad2(h)}:${pad2(m)}:${pad2(s)}`;
}

/**
 * endsAt: ISO string o Date
 */
export function useCountdown(endsAt) {
  const endMs = useMemo(() => new Date(endsAt).getTime(), [endsAt]);
  const [remainingMs, setRemainingMs] = useState(() => Math.max(0, endMs - Date.now()));

  useEffect(() => {
    if (!Number.isFinite(endMs)) return;

    const id = setInterval(() => {
      setRemainingMs(Math.max(0, endMs - Date.now()));
    }, 1000);

    return () => clearInterval(id);
  }, [endMs]);

  return {
    remainingMs,
    isExpired: remainingMs <= 0,
    label: formatRemaining(remainingMs),
  };
}
