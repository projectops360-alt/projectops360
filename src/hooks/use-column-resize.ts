"use client";

import { useCallback, useRef } from "react";
import type { TaskStatus } from "@/types/database";
import { MIN_COLUMN_WIDTH, MAX_COLUMN_WIDTH } from "@/hooks/use-workboard-preferences";

// ── Types ──────────────────────────────────────────────────────────────────────

interface UseColumnResizeOptions {
  status: TaskStatus;
  currentWidth: number;
  onResize: (status: TaskStatus, newWidth: number) => void;
  onReset: (status: TaskStatus) => void;
  onResizeStart?: () => void;
  onResizeEnd?: () => void;
}

interface ResizeHandleProps {
  onMouseDown: (e: React.MouseEvent) => void;
  onDoubleClick: (e: React.MouseEvent) => void;
}

// ── Hook ───────────────────────────────────────────────────────────────────────

export function useColumnResize({
  status,
  currentWidth,
  onResize,
  onReset,
  onResizeStart,
  onResizeEnd,
}: UseColumnResizeOptions): ResizeHandleProps {

  const startXRef = useRef(0);
  const startWidthRef = useRef(0);

  const handleMouseDown = useCallback(
    (e: React.MouseEvent) => {
      e.preventDefault();
      e.stopPropagation(); // Prevent DnD from capturing this event

      startXRef.current = e.clientX;
      startWidthRef.current = currentWidth;

      // Disable text selection and show resize cursor globally
      document.body.style.cursor = "col-resize";
      document.body.style.userSelect = "none";

      onResizeStart?.();

      const handleMouseMove = (moveEvent: MouseEvent) => {
        const delta = moveEvent.clientX - startXRef.current;
        const newWidth = Math.max(MIN_COLUMN_WIDTH, Math.min(MAX_COLUMN_WIDTH, startWidthRef.current + delta));
        onResize(status, newWidth);
      };

      const handleMouseUp = () => {
        window.removeEventListener("mousemove", handleMouseMove);
        window.removeEventListener("mouseup", handleMouseUp);

        // Restore body styles
        document.body.style.cursor = "";
        document.body.style.userSelect = "";

        onResizeEnd?.();
      };

      window.addEventListener("mousemove", handleMouseMove);
      window.addEventListener("mouseup", handleMouseUp);
    },
    [status, currentWidth, onResize, onResizeStart, onResizeEnd]
  );

  const handleDoubleClick = useCallback(
    (e: React.MouseEvent) => {
      e.preventDefault();
      e.stopPropagation();
      onReset(status);
    },
    [status, onReset]
  );

  return {
    onMouseDown: handleMouseDown,
    onDoubleClick: handleDoubleClick,
  };
}