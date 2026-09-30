/**
 * TextNode — a naked text node on the Habitto canvas (text directly on the
 * canvas, no box).
 *
 * Renders one entry from the canvas store in WORLD coordinates (the Stage wraps
 * everything in a zoom/pan transform layer). Handles pointer drag with live
 * attach detection (drop it onto a box to link it), inline editing through a
 * WYSIWYG auto-sizing textarea, and one undo gesture per edit session — the
 * session pattern mirrors BoxNode.
 */
import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import type {
  ChangeEvent as ReactChangeEvent,
  CSSProperties,
  JSX,
  KeyboardEvent as ReactKeyboardEvent,
  PointerEvent as ReactPointerEvent,
} from "react";
import { cn } from "../lib/utils";
import { useCanvas } from "./store";
import { ATTACH_GAP, MIN_TEXT_H, type ID, type TextNode as TextNodeData } from "./types";

/** Screen-px movement before a pointerdown counts as a real drag (not a click). */
const DRAG_THRESHOLD_PX = 3;
/** p-0.5 → 2px top + 2px bottom, added to the editor's content height. */
const VERTICAL_PADDING = 4;

interface DragState {
  pointerId: number;
  startClient: { x: number; y: number };
  startNode: { x: number; y: number };
  /** latest pointer position (client px), coalesced into rAF paints */
  latest: { x: number; y: number };
  /** passed the click threshold — only then do we move / drop */
  moved: boolean;
  raf: number | null;
  /** Multi-select drag: every selected member moving with this gesture. */
  group?: ID[];
  /** Start position of each group member (world), captured at pointer-down. */
  starts?: Record<ID, { x: number; y: number }>;
}

export function TextNode({ textId }: { textId: string }): JSX.Element {
  // ---- store selectors: primitives / stable references only ----
  const text = useCanvas((s) => s.texts[textId]);
  const isSelected = useCanvas((s) => s.selection.includes(textId));
  const isEditing = useCanvas((s) => s.editingTextId === textId);
  const zoom = useCanvas((s) => s.viewport.zoom);
  const tool = useCanvas((s) => s.tool);
  // null unless THIS node is the one being hovered over a box mid-drag
  const myPreview = useCanvas((s) => (s.attachPreview?.textId === textId ? s.attachPreview : null));

  const updateText = useCanvas((s) => s.updateText);
  const restoreText = useCanvas((s) => s.restoreText);
  const deleteTexts = useCanvas((s) => s.deleteTexts);
  const attachText = useCanvas((s) => s.attachText);
  const detachText = useCanvas((s) => s.detachText);
  const moveGroup = useCanvas((s) => s.moveGroup);
  const setAttachPreview = useCanvas((s) => s.setAttachPreview);
  const setTextEditing = useCanvas((s) => s.setTextEditing);
  const selectBoxes = useCanvas((s) => s.selectBoxes);
  const toggleSelect = useCanvas((s) => s.toggleSelect);
  const beginGesture = useCanvas((s) => s.beginGesture);
  const endGesture = useCanvas((s) => s.endGesture);

  // ---- local UI state ----
  const [isDragging, setIsDragging] = useState(false);
  const [draft, setDraft] = useState("");
  const [editingSession, setEditingSession] = useState<string | null>(null);

  // ---- refs ----
  const taRef = useRef<HTMLTextAreaElement | null>(null);
  const draftRef = useRef("");
  const dragRef = useRef<DragState | null>(null);
  const closedRef = useRef(false); // current edit session already committed/cancelled
  const pendingRef = useRef(false); // this node owns an open edit session
  const sessionRef = useRef<TextNodeData | null>(null); // node captured when the session started (cancel restores it)

  const applyDraft = (next: string) => {
    draftRef.current = next;
    setDraft(next);
  };

  /** WYSIWYG: the textarea must occupy exactly the display text's box. */
  const sizeToContent = (el: HTMLTextAreaElement) => {
    el.style.height = "auto";
    const h = el.scrollHeight;
    el.style.height = `${h}px`;
    return h;
  };

  // ---- inline editing: commit / cancel ----
  //
  // The text is written to the store LIVE on every keystroke (handleEditorInput),
  // so nothing depends on blur-vs-unmount ordering at confirm time. Commit only
  // handles the two remaining rules: an EMPTY text node is deleted (double-click
  // → leave blank → nothing litters the canvas) and the measured height is
  // guaranteed to fit the final content.
  const commit = useCallback(() => {
    if (closedRef.current) return;
    closedRef.current = true;
    const el = taRef.current;
    const value = el ? el.value : draftRef.current;
    const cur = useCanvas.getState().texts[textId];
    setTextEditing(null);

    if (value.trim() === "") {
      // Blank result → drop the node. The edit session produced nothing worth
      // an undo entry, so its gesture is aborted (not ended) — otherwise undo
      // would resurrect an empty placeholder.
      pendingRef.current = false;
      if (cur) deleteTexts([textId], { history: false });
      useCanvas.setState({ gesture: null });
      return;
    }
    if (cur) {
      const h = el ? Math.max(el.scrollHeight + VERTICAL_PADDING, MIN_TEXT_H) : cur.h;
      if (h > cur.h) updateText(textId, { h }); // plain — the session's gesture owns history
    }
  }, [textId, setTextEditing, updateText, deleteTexts]);

  const cancel = useCallback(() => {
    if (closedRef.current) return;
    closedRef.current = true;
    const snap = sessionRef.current;
    if (!snap || snap.text.trim() === "") {
      // Cancelled a session that started from a blank node (double-click → Esc,
      // or typed-then-cleared → Esc): the node itself goes away.
      pendingRef.current = false;
      setTextEditing(null);
      if (snap) deleteTexts([textId], { history: false });
      useCanvas.setState({ gesture: null });
      return;
    }
    // Put the exact session-start object back (text AND live-synced h).
    // Value-equal → endGesture leaves no undo entry.
    restoreText(snap);
    setTextEditing(null);
  }, [restoreText, setTextEditing, deleteTexts, textId]);

  // Session flags: reset when editing starts; flush the draft if the session
  // ends without a local commit/cancel (e.g. a background click cleared the
  // selection), then ALWAYS release the gesture — endGesture is a no-op when
  // nothing changed (JSON equality), so cancel→restore leaves no junk undo step.
  useEffect(() => {
    if (isEditing) {
      closedRef.current = false;
      pendingRef.current = true;
      const snap = useCanvas.getState().texts[textId] ?? null;
      sessionRef.current = snap;
      beginGesture();
      return;
    }
    if (pendingRef.current) {
      pendingRef.current = false;
      if (!closedRef.current) commit();
      endGesture();
    }
  }, [isEditing, commit, textId, beginGesture, endGesture]);

  // Editor mount: size the textarea to its content (WYSIWYG — the node's height
  // must not jump when the display text swaps for the textarea; layout effect
  // so the height lands before the browser paints) and put the caret at the
  // end, mirroring BoxNode.
  useLayoutEffect(() => {
    if (!isEditing) return;
    const el = taRef.current;
    if (!el) return;
    sizeToContent(el);
    const end = el.value.length;
    el.focus();
    el.setSelectionRange(end, end);
  }, [isEditing]);

  // Unmount cleanup: cancel pending animation frames and, if this node is torn
  // down mid-gesture (deleted node, undo, doc load), abort the gesture this
  // node owns so the store's `gesture` / `attachPreview` don't stay stuck.
  useEffect(
    () => () => {
      const d = dragRef.current;
      if (d && d.raf !== null) cancelAnimationFrame(d.raf);
      if (d || pendingRef.current) useCanvas.setState({ gesture: null, attachPreview: null });
    },
    []
  );

  // Initialize the local edit buffer synchronously when a session starts so the
  // textarea never flashes a stale value; reset the session marker afterwards.
  if (isEditing) {
    if (editingSession !== textId) {
      setEditingSession(textId);
      applyDraft(text ? text.text : "");
    }
  } else if (editingSession !== null) {
    setEditingSession(null);
  }

  if (!text) return null;

  // ---- attach detection while dragging ----
  const detectAttachTarget = (clientX: number, clientY: number) => {
    // The dragged node itself sits under the cursor, so a single
    // elementFromPoint() would always return THIS node and never the box
    // underneath — walk the whole hit stack instead.
    const stack = document.elementsFromPoint(clientX, clientY);
    let boxEl: Element | null = null;
    for (const el of stack) {
      const hit = el.closest("[data-box-id]");
      if (hit) {
        boxEl = hit;
        break;
      }
    }
    const boxId = boxEl ? boxEl.getAttribute("data-box-id") : null;
    const box = boxId ? useCanvas.getState().boxes[boxId] : null;
    if (!boxEl || !boxId || !box) {
      setAttachPreview(null);
      return;
    }
    // Side comes from the WORLD cursor Y vs the box center. Derive the
    // screen→world scale from the box's own rect so this needs no stage origin:
    // screenY = worldY * scale + origin is monotonic, and rect.height/box.h
    // equals the viewport zoom.
    const rect = boxEl.getBoundingClientRect();
    const scale =
      box.h > 0 && rect.height > 0 ? rect.height / box.h : useCanvas.getState().viewport.zoom;
    const worldCursorY = box.y + (clientY - rect.top) / scale;
    const side: "top" | "bottom" = worldCursorY < box.y + box.h / 2 ? "top" : "bottom";
    setAttachPreview({ textId, boxId, side });
  };

  // ---- drag to move (rAF-coalesced) ----
  const applyDrag = () => {
    const d = dragRef.current;
    if (!d || !d.moved) return;
    const state = useCanvas.getState();
    const cur = state.texts[textId];
    if (!cur) return;
    const dx = (d.latest.x - d.startClient.x) / state.viewport.zoom;
    const dy = (d.latest.y - d.startClient.y) / state.viewport.zoom;

    // Rigid group first — cascade may touch THIS node when its box is in the
    // group, so the primary is re-read (fresh) right after.
    if (d.group && d.group.length > 1 && d.starts) {
      const others = d.group.filter((id) => id !== textId);
      if (others.length) moveGroup({ ids: others, from: d.starts, dx, dy });
    }

    const nx = d.startNode.x + dx;
    const ny = d.startNode.y + dy;
    // plain — the gesture owns history. attachTo is deliberately NOT cleared
    // here: only the drop (attachText / detachText) decides the final state.
    const after = useCanvas.getState().texts[textId];
    if (after && (after.x !== nx || after.y !== ny)) updateText(textId, { x: nx, y: ny });
    detectAttachTarget(d.latest.x, d.latest.y);
  };

  const scheduleDrag = () => {
    const d = dragRef.current;
    if (!d || d.raf !== null) return;
    d.raf = requestAnimationFrame(() => {
      const cur = dragRef.current;
      if (!cur) return;
      cur.raf = null;
      applyDrag();
    });
  };

  // ---- root pointer handlers (drag to move / link onto a box) ----
  const handleRootPointerDown = (e: ReactPointerEvent<HTMLDivElement>) => {
    // Stage handles panning for these — do NOT stop propagation.
    if (tool === "pan" || e.button === 1) return;
    if (e.button !== 0) return;
    if (isEditing) return; // never drag while editing

    e.stopPropagation();

    if (isSelected && e.shiftKey) toggleSelect(textId, true);
    else if (!isSelected) selectBoxes([textId]);

    // Multi-select drag: an already-selected node keeps the selection, so the
    // whole group moves as one rigid unit. Anything else drags alone.
    const st = useCanvas.getState();
    const group = st.selection.includes(textId) ? [...st.selection] : [textId];
    const starts: Record<ID, { x: number; y: number }> = {};
    for (const id of group) {
      const b = st.boxes[id];
      const t = st.texts[id];
      if (b) starts[id] = { x: b.x, y: b.y };
      else if (t) starts[id] = { x: t.x, y: t.y };
    }

    beginGesture();
    e.currentTarget.setPointerCapture(e.pointerId);
    dragRef.current = {
      pointerId: e.pointerId,
      startClient: { x: e.clientX, y: e.clientY },
      startNode: { x: text.x, y: text.y },
      latest: { x: e.clientX, y: e.clientY },
      moved: false,
      raf: null,
      group,
      starts,
    };
    setIsDragging(true);
  };

  const handleRootPointerMove = (e: ReactPointerEvent<HTMLDivElement>) => {
    const d = dragRef.current;
    if (!d || d.pointerId !== e.pointerId) return;
    d.latest = { x: e.clientX, y: e.clientY };
    if (!d.moved) {
      const gx = d.latest.x - d.startClient.x;
      const gy = d.latest.y - d.startClient.y;
      if (Math.hypot(gx, gy) > DRAG_THRESHOLD_PX) d.moved = true;
    }
    scheduleDrag();
  };

  const handleRootPointerEnd = (e: ReactPointerEvent<HTMLDivElement>) => {
    const d = dragRef.current;
    if (!d || d.pointerId !== e.pointerId) return;
    if (d.raf !== null) {
      cancelAnimationFrame(d.raf);
      d.raf = null;
    }
    if (d.moved) {
      applyDrag(); // flush the final frame (position + attach target) before dropping
      const preview = useCanvas.getState().attachPreview;
      if (preview && preview.textId === textId) attachText(textId, preview.boxId, preview.side);
      else detachText(textId); // no-op when this node was never attached
    }
    // A plain click never reaches detach/drop, so an attached node stays put.
    dragRef.current = null;
    setAttachPreview(null);
    try {
      e.currentTarget.releasePointerCapture(e.pointerId);
    } catch {
      // capture already released
    }
    endGesture();
    setIsDragging(false);
  };

  // ---- inline editor input / key handling ----
  const handleEditorInput = (e: ReactChangeEvent<HTMLTextAreaElement>) => {
    const el = e.currentTarget;
    applyDraft(el.value);
    // WYSIWYG: grow/shrink the editor to its content on every keystroke so the
    // node's height never jumps while typing.
    const contentH = sizeToContent(el);
    // Live-write text + measured height (PLAIN, no history: the session is one
    // gesture). Writing the text live means a confirm/blur that never fires can
    // still never lose the typed content — the store always matches the editor.
    // (When attached, updateText re-derives x/y from the box if h changed.)
    const nextH = Math.max(contentH + VERTICAL_PADDING, MIN_TEXT_H);
    const cur = useCanvas.getState().texts[textId];
    if (!cur) return;
    const patch: Partial<Omit<TextNodeData, "id">> = {};
    if (el.value !== cur.text) patch.text = el.value;
    if (cur.h !== nextH) patch.h = nextH;
    if (patch.text !== undefined || patch.h !== undefined) updateText(textId, patch);
  };

  const handleEditorKeyDown = (e: ReactKeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      commit();
    } else if (e.key === "Escape") {
      e.preventDefault();
      e.stopPropagation();
      cancel();
    }
    // Shift+Enter keeps the default behaviour (newline)
  };

  // ---- preview position (this node hovered over a box during its own drag) ----
  const previewBox = myPreview ? useCanvas.getState().boxes[myPreview.boxId] : null;
  const isPreview = myPreview !== null && previewBox !== null;

  let drawX = text.x;
  let drawY = text.y;
  if (myPreview && previewBox) {
    // Same clamp attachText() applies on drop, so the drop lands exactly where
    // the preview shows it. (The box itself draws the drop-zone band.)
    const maxOff = previewBox.w - text.w;
    const off = maxOff >= 0 ? Math.min(Math.max(text.x - previewBox.x, 0), maxOff) : maxOff / 2;
    drawX = previewBox.x + off;
    drawY =
      myPreview.side === "top"
        ? previewBox.y - text.h - ATTACH_GAP
        : previewBox.y + previewBox.h + ATTACH_GAP;
  }

  // Selection / preview outlines are counter-scaled so they stay crisp at any
  // zoom. While editing the textarea owns the focus, so no outline is drawn.
  const outlineStyle: CSSProperties = isEditing
    ? {}
    : isPreview
      ? {
          outline: `${1 / zoom}px solid rgb(var(--accent-rgb) / 0.45)`,
          outlineOffset: `${3 / zoom}px`,
          borderRadius: `${4 / zoom}px`,
        }
      : isSelected
        ? {
            outline: `${1 / zoom}px dashed rgb(var(--accent-rgb))`,
            outlineOffset: `${4 / zoom}px`,
            borderRadius: `${4 / zoom}px`,
          }
        : {};

  return (
    <div
      data-text-id={textId}
      className={cn(
        "group absolute left-0 top-0 box-border touch-none",
        isEditing ? "cursor-text" : tool === "select" && "cursor-move"
      )}
      style={{
        width: text.w, // height stays content-driven
        transform: `translate3d(${drawX}px, ${drawY}px, 0)${isPreview ? " scale(1.02)" : ""}`,
        opacity: isPreview ? 0.95 : undefined,
        // Nodes render BELOW boxes in the world layer (a box dragged over a
        // text hides it). Interacting nodes — mid-drag, editing, or previewing
        // an attach — must stay visible above the box they're about to link to.
        zIndex: isDragging || isEditing || isPreview ? 50 : undefined,
        willChange: isDragging ? "transform" : "auto",
        ...outlineStyle,
      }}
      onPointerDown={handleRootPointerDown}
      onPointerMove={handleRootPointerMove}
      onPointerUp={handleRootPointerEnd}
      onPointerCancel={handleRootPointerEnd}
      onDoubleClick={(e) => {
        // CRITICAL: Stage spawns a new text on background double-clicks.
        e.stopPropagation();
        if (!isEditing) setTextEditing(textId);
      }}
    >
      {isEditing ? (
        <textarea
          ref={taRef}
          rows={1}
          autoFocus
          value={draft}
          onChange={handleEditorInput}
          onKeyDown={handleEditorKeyDown}
          onPointerDown={(e) => e.stopPropagation()}
          onBlur={commit}
          className="block w-full resize-none overflow-hidden border-0 bg-transparent p-0.5 text-center text-[15px] leading-snug text-theme-text whitespace-pre-wrap break-words outline-none"
        />
      ) : (
        <div className="p-0.5 text-center text-[15px] leading-snug text-theme-text whitespace-pre-wrap break-words select-none">
          {text.text === "" ? (
            <span className="text-theme-muted opacity-50">Type…</span>
          ) : (
            text.text
          )}
        </div>
      )}
    </div>
  );
}
