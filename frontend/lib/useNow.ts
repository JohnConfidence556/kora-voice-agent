"use client";

import { useEffect, useState } from "react";

// Returns the current time, refreshed on an interval.
// It is null on the very first render so server and browser output always match.
export function useNow(intervalMs = 30_000): Date | null {
  const [now, setNow] = useState<Date | null>(null);
  useEffect(() => {
    setNow(new Date());
    const id = setInterval(() => setNow(new Date()), intervalMs);
    return () => clearInterval(id);
  }, [intervalMs]);
  return now;
}
