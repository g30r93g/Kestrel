"use client";

import { useCallback, useEffect, useRef, useState } from "react";

interface UndoPending {
  label: string;
  onUndo: () => void;
}

export function useUndoAction(ttlMs = 6000) {
  const [pending, setPending] = useState<UndoPending | null>(null);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const dismiss = useCallback(() => {
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = null;
    setPending(null);
  }, []);

  const trigger = useCallback(
    (label: string, onUndo: () => void) => {
      if (timerRef.current) clearTimeout(timerRef.current);
      setPending({ label, onUndo });
      timerRef.current = setTimeout(dismiss, ttlMs);
    },
    [ttlMs, dismiss],
  );

  const undo = useCallback(() => {
    pending?.onUndo();
    dismiss();
  }, [pending, dismiss]);

  useEffect(() => () => { if (timerRef.current) clearTimeout(timerRef.current); }, []);

  return { pending, trigger, undo, dismiss };
}
