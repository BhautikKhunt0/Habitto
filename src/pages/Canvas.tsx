import { useEffect } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { Shapes } from "lucide-react";

import { Stage } from "../canvas/Stage";
import { Toolbar } from "../canvas/Toolbar";
import { ZoomControls } from "../canvas/ZoomControls";
import { parseDoc } from "../canvas/persist";
import { useCanvas } from "../canvas/store";
import { CANVAS_STORAGE_KEY } from "../canvas/types";

const SAVE_DELAY_MS = 350;

export function Canvas(): JSX.Element {
  const orderCount = useCanvas((state) => state.order.length);
  const textCount = useCanvas((state) => state.textOrder.length);

  // Hydrate once on mount. Corrupted / foreign payloads are silently ignored
  // so a bad localStorage entry can never crash the page.
  useEffect(() => {
    let raw: string | null = null;
    try {
      raw = window.localStorage.getItem(CANVAS_STORAGE_KEY);
    } catch {
      return; // storage unavailable (private mode, blocked, â€¦)
    }
    if (!raw) return; // nothing saved yet â†’ keep the fresh empty canvas

    try {
      const parsed: unknown = JSON.parse(raw);
      const doc = parseDoc(parsed);
      if (doc) useCanvas.getState().loadDoc(doc);
    } catch {
      // Unparseable payload â†’ start fresh.
    }
  }, []);

  // Debounced autosave + immediate flush on page unload.
  useEffect(() => {
    let timer: ReturnType<typeof setTimeout> | null = null;

    const flush = () => {
      if (timer !== null) {
        clearTimeout(timer);
        timer = null;
      }
      try {
        window.localStorage.setItem(
          CANVAS_STORAGE_KEY,
          JSON.stringify(useCanvas.getState().getDoc()),
        );
      } catch {
        // Quota exceeded / storage unavailable â€” persistence is best-effort.
      }
    };

    const scheduleSave = () => {
      if (timer !== null) clearTimeout(timer);
      timer = setTimeout(flush, SAVE_DELAY_MS);
    };

    const unsub = useCanvas.subscribe((state, prev) => {
      if (
        state.boxes !== prev.boxes ||
        state.edges !== prev.edges ||
        state.order !== prev.order ||
        state.viewport !== prev.viewport ||
        state.texts !== prev.texts ||
        state.textOrder !== prev.textOrder
      ) {
        scheduleSave();
      }
    });

    const onBeforeUnload = () => flush();
    window.addEventListener("beforeunload", onBeforeUnload);

    return () => {
      unsub();
      window.removeEventListener("beforeunload", onBeforeUnload);
      flush(); // clear the pending timer and persist whatever is left
    };
  }, []);

  // Global keyboard shortcuts (stage-level keys are the Stage's business).
  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      const state = useCanvas.getState();

      // Never steal keys while a box or a text node is being typed intoâ€¦
      if (state.editingId !== null || state.editingTextId !== null) return;
      // â€¦or while any other text field / editable region has focus.
      const target = event.target;
      if (target instanceof HTMLInputElement || target instanceof HTMLTextAreaElement) return;
      if (target instanceof HTMLElement && target.isContentEditable) return;

      const key = event.key;
      const mod = event.ctrlKey || event.metaKey;

      // Delete / Backspace â†’ remove the current selection
      if (key === "Delete" || key === "Backspace") {
        if (state.selection.length > 0 || state.selectedEdgeId !== null) {
          event.preventDefault();
        }
        state.deleteSelection();
        return;
      }

      // Ctrl/Cmd+Z â†’ undo, Ctrl/Cmd+Shift+Z / Ctrl/Cmd+Y â†’ redo
      if (mod && (key === "z" || key === "Z")) {
        event.preventDefault();
        if (event.shiftKey) state.redo();
        else state.undo();
        return;
      }
      if (mod && (key === "y" || key === "Y")) {
        event.preventDefault();
        state.redo();
        return;
      }

      // Ctrl/Cmd+D â†’ duplicate
      if (mod && (key === "d" || key === "D")) {
        event.preventDefault();
        state.duplicateSelection();
        return;
      }

      // Escape â†’ clear selection
      if (key === "Escape") {
        state.clearSelection();
        return;
      }

      // Single-letter shortcuts: V select Â· B box Â· H pan Â· T add text
      if (!mod && !event.altKey && key.length === 1) {
        const lower = key.toLowerCase();
        if (lower === "v") {
          state.setTool("select");
          return;
        }
        if (lower === "b") {
          state.setTool("box");
          return;
        }
        if (lower === "h") {
          state.setTool("pan");
          return;
        }
        if (lower === "t") {
          const id = state.addText();
          state.setTextEditing(id);
          return;
        }
      }

      // Zoom â€” never fight the browser's own zoom shortcuts.
      if (!mod && (key === "+" || key === "=")) {
        state.zoomBy(1.15);
        return;
      }
      if (!mod && key === "-") {
        state.zoomBy(1 / 1.15);
        return;
      }

      // Shift+1 â†’ fit everything in view
      if (!mod && event.shiftKey && (event.code === "Digit1" || key === "1" || key === "!")) {
        state.fitView();
      }
    };

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, []);

  return (
    <motion.div
      className="w-full h-full font-canvas"
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ type: "spring", stiffness: 260, damping: 26 }}
    >
      <div className="relative w-full h-full overflow-hidden">
        <Stage />

        {/*
          Vignette â€” intentionally SLIGHT: one continuous radial ramp that only
          touches the outermost ~10% of the screen (edges ~22% veiled, corners
          softly ~90%). Single layer + long multi-stop fade = no seams/layers.
        */}
        <div
          className="pointer-events-none absolute inset-0 z-10"
          style={{
            backgroundImage: `radial-gradient(ellipse 100% 100% at 50% 50%,
              transparent 0%,
              transparent 42%,
              color-mix(in srgb, var(--bg-color) 22%, transparent) 50%,
              color-mix(in srgb, var(--bg-color) 50%, transparent) 57%,
              color-mix(in srgb, var(--bg-color) 75%, transparent) 64%,
              color-mix(in srgb, var(--bg-color) 90%, transparent) 71%,
              var(--bg-color) 78%)`,
          }}
        />

        <Toolbar />
        <ZoomControls />

        {/* Empty state */}
        {orderCount === 0 && textCount === 0 && (
          <div className="absolute inset-0 z-20 flex flex-col items-center justify-center gap-4 pointer-events-none">
            <div className="flex h-14 w-14 items-center justify-center rounded-2xl border border-theme-border bg-theme-surface shadow-lg">
              <Shapes className="w-6 h-6 text-theme-muted" />
            </div>
            <p className="font-medium text-theme-text">Start your canvas</p>
            <p className="text-sm text-theme-muted">
              Add a box, or double-click anywhere to write text â€” then drag text onto a box to link it.
            </p>
            <div className="pointer-events-auto flex items-center gap-3">
              <button
                type="button"
                onClick={() => {
                  const id = useCanvas.getState().addBox();
                  useCanvas.getState().setEditing(id);
                }}
                className="pointer-events-auto rounded-full bg-theme-text px-5 py-2.5 text-sm font-semibold text-theme-bg transition hover:opacity-90 active:scale-95"
              >
                Add your first box
              </button>
              <button
                type="button"
                onClick={() => {
                  const id = useCanvas.getState().addText();
                  useCanvas.getState().setTextEditing(id);
                }}
                className="pointer-events-auto rounded-full border border-theme-border bg-theme-surface/80 px-5 py-2.5 text-sm font-semibold text-theme-text backdrop-blur transition hover:bg-theme-surface"
              >
                Add text
              </button>
            </div>
          </div>
        )}

        {/* First-steps hint â€” fades away once the canvas grows */}
        <AnimatePresence>
          {orderCount + textCount > 0 && orderCount + textCount < 4 && (
            <motion.div
              key="canvas-hint"
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 8 }}
              transition={{ duration: 0.25 }}
              className="absolute bottom-6 left-6 z-20 pointer-events-none rounded-full border border-theme-border bg-theme-surface/80 px-3 py-1.5 text-[11px] text-theme-muted shadow-sm backdrop-blur"
            >
              Double-click to edit Â· Drag dots to connect Â· Drag text onto a box to link
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </motion.div>
  );
}
