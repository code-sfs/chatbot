import { useRef, useCallback } from "react";

interface UsePttButtonHandlersOptions {
  handlePttDown: () => Promise<void> | void;
  handlePttUp: () => Promise<void> | void;
  isConnecting: boolean;
  isCapturing: boolean;
}

export function usePttButtonHandlers({
  handlePttDown,
  handlePttUp,
  isConnecting,
  isCapturing,
}: UsePttButtonHandlersOptions) {
  const btnRef = useRef<HTMLButtonElement>(null);
  const clearingSelectionRef = useRef(false);

  const clearSelection = useCallback(() => {
    const selection = window.getSelection();
    if (selection && selection.rangeCount > 0) selection.removeAllRanges();
  }, []);

  const stopClearingSelection = useCallback(() => {
    if (!clearingSelectionRef.current) return;
    clearingSelectionRef.current = false;
    document.removeEventListener("selectionchange", clearSelection);
    clearSelection();
  }, [clearSelection]);

  const startClearingSelection = useCallback(() => {
    clearSelection();
    if (clearingSelectionRef.current) return;
    clearingSelectionRef.current = true;
    document.addEventListener("selectionchange", clearSelection);
  }, [clearSelection]);

  const releaseCapture = useCallback((e: React.PointerEvent) => {
    const btn = btnRef.current;
    if (btn?.hasPointerCapture(e.pointerId)) {
      btn.releasePointerCapture(e.pointerId);
    }
  }, []);

  const onPointerDown = useCallback(
    (e: React.PointerEvent<HTMLButtonElement>) => {
      e.preventDefault();
      startClearingSelection();
      if (isConnecting && !isCapturing) {
        const stop = () => {
          stopClearingSelection();
          window.removeEventListener("pointerup", stop);
          window.removeEventListener("pointercancel", stop);
        };
        window.addEventListener("pointerup", stop);
        window.addEventListener("pointercancel", stop);
        return;
      }
      try {
        btnRef.current?.setPointerCapture(e.pointerId);
      } catch {
        /* capture unsupported — ignore */
      }
      void handlePttDown();
    },
    [
      handlePttDown,
      isConnecting,
      isCapturing,
      startClearingSelection,
      stopClearingSelection,
    ],
  );

  const onPointerUp = useCallback(
    (e: React.PointerEvent<HTMLButtonElement>) => {
      e.preventDefault();
      stopClearingSelection();
      releaseCapture(e);
      void handlePttUp();
    },
    [handlePttUp, releaseCapture, stopClearingSelection],
  );

  const onPointerCancel = useCallback(
    (e: React.PointerEvent<HTMLButtonElement>) => {
      stopClearingSelection();
      releaseCapture(e);
      void handlePttUp();
    },
    [handlePttUp, releaseCapture, stopClearingSelection],
  );

  const onLostPointerCapture = useCallback(() => {
    stopClearingSelection();
    void handlePttUp();
  }, [handlePttUp, stopClearingSelection]);

  return {
    btnRef,
    onPointerDown,
    onPointerUp,
    onPointerCancel,
    onLostPointerCapture,
  };
}
