/**
 * BoxNode — a single interactive node on the Habitto canvas.
 *
 * Renders one box from the canvas store in WORLD coordinates (the Stage wraps
 * everything in a zoom/pan transform layer). Handles pointer drag with edge
 * snapping, 8 resize handles, 4 connection ports and inline text editing.
 */
import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import type {
  CSSProperties,
  JSX,
  KeyboardEvent as ReactKeyboardEvent,
  PointerEvent as ReactPointerEvent,
} from "react";
import { Link2 } from "lucide-react";
import { cn } from "../lib/utils";
import { useCanvas } from "./store";
import { MIN_BOX_H, MIN_BOX_W, type Box, type Guide, type ID, type Port } from "./types";

/** Resize handle direction: 4 corners + 4 edge midpoints. */
type ResizeDir = "nw" | "n" | "ne" | "e" | "se" | "s" | "sw" | "w";

interface Pt {
  x: number;
  y: number;
}

interface GestureState {
  pointerId: number;
  startClient: Pt;
  startBox: { x: number; y: number; w: number; h: number };
  latest: Pt;
  moved: boolean;
  raf: number | null;
  /** Multi-select drag: every selected member moving with this gesture. */
  group?: ID[];
  /** Start position of each group member (world), captured at pointer-down. */
  starts?: Record<ID, Pt>;
}

interface ResizeState extends GestureState {
  dir: ResizeDir;
}

const SNAP_PX = 8; // snap threshold (screen px → converted to world px via zoom)
const HANDLE_PX = 10; // handle CSS size (world px → 10px on screen after counter-scale)
const PORT_PX = 10; // port CSS size (world px → 10px on screen after counter-scale)
const TEXT_VERTICAL_PADDING = 2 * 16; // p-4 top + bottom the box must fit around the text block

const HANDLES: ReadonlyArray<{ dir: ResizeDir; left: string; top: string; cursor: string }> = [
  { dir: "nw", left: "0%", top: "0%", cursor: "cursor-nwse-resize" },
  { dir: "n", left: "50%", top: "0%", cursor: "cursor-ns-resize" },
  { dir: "ne", left: "100%", top: "0%", cursor: "cursor-nesw-resize" },
  { dir: "e", left: "100%", top: "50%", cursor: "cursor-ew-resize" },
  { dir: "se", left: "100%", top: "100%", cursor: "cursor-nwse-resize" },
  { dir: "s", left: "50%", top: "100%", cursor: "cursor-ns-resize" },
  { dir: "sw", left: "0%", top: "100%", cursor: "cursor-nesw-resize" },
  { dir: "w", left: "0%", top: "50%", cursor: "cursor-ew-resize" },
];

const PORTS: ReadonlyArray<{ port: Port; left: string; top: string }> = [
  { port: "top", left: "50%", top: "0%" },
  { port: "right", left: "100%", top: "50%" },
  { port: "bottom", left: "50%", top: "100%" },
  { port: "left", left: "0%", top: "50%" },
];

/**
 * Fit an auto-height textarea to its content and return that content height.
 * `height: auto` (with `rows={1}`) makes the box shrink back to a single line,
 * so `scrollHeight` is always exactly the height of the typed text block —
 * i.e. the same block the display layer renders when centered.
 */
const sizeEditor = (el: HTMLTextAreaElement): number => {
  el.style.height = "auto";
  const h = el.scrollHeight;
  el.style.height = `${h}px`;
  return h;
};

export function BoxNode({ boxId }: { boxId: string }): JSX.Element {
  // ---- store selectors: primitives / stable references only (no cross-box re-renders) ----
  const box = useCanvas((s) => s.boxes[boxId]);
  const isSelected = useCanvas((s) => s.selection.includes(boxId));
  const isEditing = useCanvas((s) => s.editingId === boxId);
  const zoom = useCanvas((s) => s.viewport.zoom);
  const isConnectSource = useCanvas((s) => s.connecting?.fromId === boxId);
  const isConnectTarget = useCanvas((s) => s.connecting?.hoverId === boxId);
  const tool = useCanvas((s) => s.tool);
  // Only re-renders this box while a dragged text node hovers it (null for all others).
  const attachSide = useCanvas((s) => (s.attachPreview && s.attachPreview.boxId === boxId ? s.attachPreview.side : null));

  const updateBox = useCanvas((s) => s.updateBox);
  const moveGroup = useCanvas((s) => s.moveGroup);
  const restoreBox = useCanvas((s) => s.restoreBox);
  const beginGesture = useCanvas((s) => s.beginGesture);
  const endGesture = useCanvas((s) => s.endGesture);
  const selectBoxes = useCanvas((s) => s.selectBoxes);
  const toggleSelect = useCanvas((s) => s.toggleSelect);
  const setEditing = useCanvas((s) => s.setEditing);
  const startConnect = useCanvas((s) => s.startConnect);
  const setGuides = useCanvas((s) => s.setGuides);

  // ---- local UI state ----
  const [hovered, setHovered] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const [isResizing, setIsResizing] = useState(false);
  const [draft, setDraft] = useState("");
  const [editingSession, setEditingSession] = useState<string | null>(null);

  const isInteracting = isDragging || isResizing;

  // ---- refs ----
  const rootRef = useRef<HTMLDivElement | null>(null);
  const taRef = useRef<HTMLTextAreaElement | null>(null);
  const draftRef = useRef("");
  const dragRef = useRef<GestureState | null>(null);
  const resizeRef = useRef<ResizeState | null>(null);
  const guideCacheRef = useRef<Record<string, Guide>>({});
  const closedRef = useRef(false); // current edit session already committed/cancelled
  const pendingEditRef = useRef(false); // this box entered an edit session
  const sessionBoxRef = useRef<Box | null>(null); // pre-edit box object captured when the session started (cancel restores it)
  const lastContentHRef = useRef(0); // last measured editor content height (commit fallback)

  const applyDraft = (next: string) => {
    draftRef.current = next;
    setDraft(next);
  };

  // ---- inline editing: commit / cancel ----
  //
  // The typed text is written to the store LIVE on every keystroke (see
  // handleEditorInput), so "click outside to confirm" can never lose it — even
  // if blur never fires or the textarea unmounts before commit runs. Commit
  // therefore only guarantees the final height fits the content.
  const commitEdit = useCallback(() => {
    if (closedRef.current) return;
    closedRef.current = true;
    const el = taRef.current;
    const current = useCanvas.getState().boxes[boxId];
    if (current) {
      // el may already be unmounted in the flush path — fall back to the last
      // height we measured live while typing.
      const contentH = el ? el.scrollHeight : lastContentHRef.current;
      const neededH = contentH + TEXT_VERTICAL_PADDING;
      if (neededH > current.h) updateBox(boxId, { h: Math.max(neededH, MIN_BOX_H) }); // plain — gesture owns history
    }
    setEditing(null);
  }, [boxId, setEditing, updateBox]);

  const cancelEdit = useCallback(() => {
    if (closedRef.current) return;
    closedRef.current = true;
    // Put the exact pre-edit object back: original text AND original height
    // (undoes the live auto-grow). Value-equal → endGesture leaves no undo entry.
    const original = sessionBoxRef.current;
    if (original) restoreBox(original);
    setEditing(null);
  }, [restoreBox, setEditing]);

  // Live-write the text AND grow the box on every keystroke so long text is
  // never clipped. The box grows downward; the text stays centered in the grown
  // box, exactly as it renders after commit. Plain writes (no history flag) —
  // the session's single gesture owns undo. Writing text live (instead of only
  // at commit) is what makes blur-vs-flush ordering irrelevant: the store
  // always holds what the user sees.
  const handleEditorInput = (el: HTMLTextAreaElement, value: string) => {
    const contentH = sizeEditor(el);
    lastContentHRef.current = contentH;
    const neededH = contentH + TEXT_VERTICAL_PADDING; // p-4 top + bottom = 2 × 16
    const current = useCanvas.getState().boxes[boxId];
    if (!current) return;
    const patch: Partial<Omit<Box, "id">> = {};
    if (value !== current.text) patch.text = value;
    if (neededH > current.h) patch.h = Math.max(neededH, MIN_BOX_H);
    if (patch.text !== undefined || patch.h !== undefined) updateBox(boxId, patch);
  };

  // Session flags: reset when editing starts; if the session ends without a
  // local commit/cancel (e.g. the textarea unmounted before firing blur because
  // the Stage background cleared the selection), flush the draft so typed text
  // isn't lost — unless the box object was replaced externally (undo/doc load),
  // in which case commitEdit cancels instead of clobbering the newer state.
  // The whole session is ONE gesture: `beginGesture()` on start, `endGesture()`
  // after the pending commit runs, so a real edit yields exactly one undo step
  // and a cancelled edit (value-equal snapshot) yields none.
  useEffect(() => {
    if (isEditing) {
      closedRef.current = false;
      pendingEditRef.current = true;
      sessionBoxRef.current = useCanvas.getState().boxes[boxId] ?? null;
      lastContentHRef.current = 0;
      beginGesture();
      return;
    }
    if (pendingEditRef.current) {
      pendingEditRef.current = false;
      if (!closedRef.current) commitEdit();
      endGesture();
    }
  }, [isEditing, commitEdit, boxId, beginGesture, endGesture]);

  // Size the editor to its content BEFORE the browser paints (the textarea must
  // occupy exactly the same visual space as the centered display text — zero
  // shift before/during/after commit), then place the caret at the end.
  useLayoutEffect(() => {
    if (!isEditing) return;
    const el = taRef.current;
    if (!el) return;
    lastContentHRef.current = sizeEditor(el);
    const end = el.value.length;
    el.focus();
    el.setSelectionRange(end, end);
  }, [isEditing]);

  // Unmount cleanup: cancel pending animation frames and, if this box is torn
  // down mid-gesture (deleted box, undo, doc load), abort the open gesture so
  // the store's `gesture` snapshot doesn't stay stuck.
  useEffect(
    () => () => {
      const d = dragRef.current;
      const r = resizeRef.current;
      if (d && d.raf !== null) cancelAnimationFrame(d.raf);
      if (r && r.raf !== null) cancelAnimationFrame(r.raf);
      if (d || r) useCanvas.setState({ gesture: null, guides: [] });
    },
    []
  );

  // Initialize the local edit buffer synchronously when a session starts so the
  // textarea never flashes a stale value; reset the session marker afterwards.
  if (isEditing) {
    if (editingSession !== boxId) {
      setEditingSession(boxId);
      applyDraft(box ? box.text : "");
    }
  } else if (editingSession !== null) {
    setEditingSession(null);
  }

  if (!box) return null;

  // ---- alignment guides (identity-cached so unchanged guides don't churn state) ----
  const getGuide = (axis: "x" | "y", pos: number): Guide => {
    const cache = guideCacheRef.current;
    const key = `${axis}:${pos}`;
    const hit = cache[key];
    if (hit) return hit;
    const guide: Guide = { axis, pos };
    cache[key] = guide;
    return guide;
  };

  // ---- drag to move ----
  const applyDrag = () => {
    const d = dragRef.current;
    if (!d) return;
    const state = useCanvas.getState();
    const current = state.boxes[boxId];
    if (!current) return;
    const z = state.viewport.zoom;
    const dx = (d.latest.x - d.startClient.x) / z;
    const dy = (d.latest.y - d.startClient.y) / z;
    const start = d.startBox;
    const w = start.w;
    const h = start.h;
    let x = start.x + dx;
    let y = start.y + dy;
    const threshold = SNAP_PX / z;

    // Multi-select drag: the whole group moves rigidly — snap candidates must
    // exclude members (they move with us, not relative to us).
    const group = d.group && d.group.length > 1 ? d.group : null;
    const movingSet = group ? new Set(group) : null;

    let bestX: { diff: number; anchor: number } | null = null;
    let bestY: { diff: number; anchor: number } | null = null;

    for (const other of Object.values(state.boxes)) {
      if (other.id === boxId || movingSet?.has(other.id)) continue;

      // left / center / right edge pairs
      const xCandidates = [
        { diff: other.x - x, anchor: 0 },
        { diff: other.x + other.w / 2 - (x + w / 2), anchor: w / 2 },
        { diff: other.x + other.w - (x + w), anchor: w },
      ];
      for (const c of xCandidates) {
        if (Math.abs(c.diff) <= threshold && (bestX === null || Math.abs(c.diff) < Math.abs(bestX.diff))) {
          bestX = c;
        }
      }

      // top / middle / bottom edge pairs
      const yCandidates = [
        { diff: other.y - y, anchor: 0 },
        { diff: other.y + other.h / 2 - (y + h / 2), anchor: h / 2 },
        { diff: other.y + other.h - (y + h), anchor: h },
      ];
      for (const c of yCandidates) {
        if (Math.abs(c.diff) <= threshold && (bestY === null || Math.abs(c.diff) < Math.abs(bestY.diff))) {
          bestY = c;
        }
      }
    }

    const guides: Guide[] = [];
    if (bestX !== null) {
      x += bestX.diff;
      guides.push(getGuide("x", x + bestX.anchor));
    }
    if (bestY !== null) {
      y += bestY.diff;
      guides.push(getGuide("y", y + bestY.anchor));
    }
    setGuides(guides);

    if (group && d.starts) {
      // Rigid group: the (possibly snapped) primary delta drives everyone.
      moveGroup({ ids: group, from: d.starts, dx: x - start.x, dy: y - start.y });
    } else if (current.x !== x || current.y !== y) {
      updateBox(boxId, { x, y }); // no history flag — gesture owns it
    }
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

  // ---- resize (no snapping) ----
  const applyResize = () => {
    const r = resizeRef.current;
    if (!r) return;
    const state = useCanvas.getState();
    const current = state.boxes[boxId];
    if (!current) return;
    const z = state.viewport.zoom;
    const dx = (r.latest.x - r.startClient.x) / z;
    const dy = (r.latest.y - r.startClient.y) / z;
    const start = r.startBox;
    const right = start.x + start.w;
    const bottom = start.y + start.h;
    let { x, y, w, h } = start;

    if (r.dir.includes("e")) w = Math.max(MIN_BOX_W, start.w + dx);
    if (r.dir.includes("w")) w = Math.max(MIN_BOX_W, start.w - dx);
    if (r.dir.includes("s")) h = Math.max(MIN_BOX_H, start.h + dy);
    if (r.dir.includes("n")) h = Math.max(MIN_BOX_H, start.h - dy);
    // Left/top handles keep the opposite edge pinned (recompute after clamping).
    if (r.dir.includes("w")) x = right - w;
    if (r.dir.includes("n")) y = bottom - h;

    if (current.x !== x || current.y !== y || current.w !== w || current.h !== h) {
      updateBox(boxId, { x, y, w, h });
    }
  };

  const scheduleResize = () => {
    const r = resizeRef.current;
    if (!r || r.raf !== null) return;
    r.raf = requestAnimationFrame(() => {
      const cur = resizeRef.current;
      if (!cur) return;
      cur.raf = null;
      applyResize();
    });
  };

  // Pointer capture suppresses boundary events — re-evaluate hover after a gesture.
  const reconcileHover = (clientX: number, clientY: number) => {
    requestAnimationFrame(() => {
      const root = rootRef.current;
      if (!root) return;
      const under = document.elementFromPoint(clientX, clientY);
      setHovered(!!under && root.contains(under));
    });
  };

  // ---- root pointer handlers (drag to move) ----
  const handleRootPointerDown = (e: ReactPointerEvent<HTMLDivElement>) => {
    // Stage handles panning for these — do NOT stop propagation.
    if (tool === "pan" || e.button === 1) return;
    if (e.button !== 0) return;
    if (isEditing) return; // never drag while editing

    e.stopPropagation();

    if (isSelected && e.shiftKey) toggleSelect(boxId, true);
    else if (!isSelected) selectBoxes([boxId]);

    // Multi-select drag: an already-selected box keeps the selection, so the
    // whole group moves as one rigid unit. Anything else drags alone.
    const st = useCanvas.getState();
    const group = st.selection.includes(boxId) ? [...st.selection] : [boxId];
    const starts: Record<ID, Pt> = {};
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
      startBox: { x: box.x, y: box.y, w: box.w, h: box.h },
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
    d.moved = true;
    scheduleDrag();
  };

  const handleRootPointerEnd = (e: ReactPointerEvent<HTMLDivElement>) => {
    const d = dragRef.current;
    if (!d || d.pointerId !== e.pointerId) return;
    if (d.raf !== null) {
      cancelAnimationFrame(d.raf);
      d.raf = null;
    }
    const latest = d.latest;
    if (d.moved) applyDrag(); // flush the final frame before ending the gesture
    dragRef.current = null;
    guideCacheRef.current = {};
    setGuides([]);
    try {
      e.currentTarget.releasePointerCapture(e.pointerId);
    } catch {
      // capture already released
    }
    endGesture();
    setIsDragging(false);
    reconcileHover(latest.x, latest.y);
  };

  // ---- resize handle handlers ----
  const handleResizeStart = (e: ReactPointerEvent<HTMLDivElement>, dir: ResizeDir) => {
    e.stopPropagation();
    e.preventDefault();
    beginGesture();
    e.currentTarget.setPointerCapture(e.pointerId);
    resizeRef.current = {
      dir,
      pointerId: e.pointerId,
      startClient: { x: e.clientX, y: e.clientY },
      startBox: { x: box.x, y: box.y, w: box.w, h: box.h },
      latest: { x: e.clientX, y: e.clientY },
      moved: false,
      raf: null,
    };
    setIsResizing(true);
  };

  const handleResizeMove = (e: ReactPointerEvent<HTMLDivElement>) => {
    const r = resizeRef.current;
    if (!r || r.pointerId !== e.pointerId) return;
    r.latest = { x: e.clientX, y: e.clientY };
    r.moved = true;
    scheduleResize();
  };

  const handleResizeEnd = (e: ReactPointerEvent<HTMLDivElement>) => {
    const r = resizeRef.current;
    if (!r || r.pointerId !== e.pointerId) return;
    if (r.raf !== null) {
      cancelAnimationFrame(r.raf);
      r.raf = null;
    }
    const latest = r.latest;
    if (r.moved) applyResize();
    resizeRef.current = null;
    try {
      e.currentTarget.releasePointerCapture(e.pointerId);
    } catch {
      // capture already released
    }
    endGesture();
    setIsResizing(false);
    reconcileHover(latest.x, latest.y);
  };

  // ---- connection ports ----
  const handlePortPointerDown = (e: ReactPointerEvent<HTMLDivElement>, port: Port) => {
    e.stopPropagation();
    e.preventDefault();
    // No pointer capture — Stage's window listeners drive the connect drag.
    startConnect(boxId, port);
  };

  // ---- inline editor key handling ----
  const handleEditorKeyDown = (e: ReactKeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      commitEdit();
    } else if (e.key === "Escape") {
      e.preventDefault();
      e.stopPropagation();
      cancelEdit();
    }
    // Shift+Enter keeps the default behaviour (newline)
  };

  // Selection / connect / attach-target outline, counter-scaled so it stays crisp at any zoom.
  const outlineStyle: CSSProperties =
    isSelected || isConnectTarget || attachSide !== null
      ? {
          outline: `${1.5 / zoom}px solid rgb(var(--accent-rgb))`,
          outlineOffset: `${3 / zoom}px`,
        }
      : {};

  const glowParts: string[] = [];
  if (isConnectTarget) glowParts.push(`0 0 0 ${4 / zoom}px rgb(var(--accent-rgb) / 0.15)`);
  else if (isConnectSource) glowParts.push(`0 0 0 ${2 / zoom}px rgb(var(--accent-rgb) / 0.3)`);
  if (attachSide !== null) glowParts.push(`0 0 0 ${4 / zoom}px rgb(var(--accent-rgb) / 0.18)`);
  if (glowParts.length) glowParts.push("0 10px 30px rgb(0 0 0 / 0.07)");
  const glowShadow = glowParts.length ? glowParts.join(", ") : undefined;

  const portsAlwaysVisible = isSelected || isConnectSource || isConnectTarget;

  return (
    <div
      ref={rootRef}
      data-box-id={boxId}
      className={cn(
        "group box-border absolute left-0 top-0 touch-none",
        tool === "select" && !isEditing && "cursor-grab active:cursor-grabbing"
      )}
      style={{
        width: box.w,
        height: box.h,
        transform: `translate3d(${box.x}px, ${box.y}px, 0)`,
        willChange: isInteracting ? "transform" : "auto",
      }}
      onPointerDown={handleRootPointerDown}
      onPointerMove={handleRootPointerMove}
      onPointerUp={handleRootPointerEnd}
      onPointerCancel={handleRootPointerEnd}
      onDoubleClick={(e) => {
        // Never let a box double-click reach the Stage background handler —
        // it would create a naked text on top of the box.
        e.stopPropagation();
        if (!isEditing) setEditing(boxId);
      }}
      onMouseEnter={() => {
        if (!isEditing) setHovered(true);
      }}
      onMouseLeave={() => setHovered(false)}
    >
      {/* Visual card */}
      <div
        className={cn(
          "absolute inset-0 rounded-[18px] bg-theme-surface/65 border border-theme-border shadow-[0_10px_30px_rgb(0_0_0/0.07)]",
          !isInteracting && "transition-[border-color,box-shadow] duration-150",
          hovered && !isEditing && "border-theme-accent/30 shadow-[0_16px_40px_rgb(0_0_0/0.11)]",
          isConnectTarget && "border-theme-accent/60"
        )}
        style={{ ...outlineStyle, ...(glowShadow ? { boxShadow: glowShadow } : {}) }}
      />

      {/* Attach drop-zone — dashed band on the side a dragged text node hovers */}
      {attachSide !== null && (
        <div
          className={cn(
            "pointer-events-none absolute left-2 right-2 z-[5] h-8 rounded-xl border border-dashed border-theme-accent bg-theme-accent/10",
            attachSide === "top" ? "top-2" : "bottom-2"
          )}
        >
          <div className="flex h-full items-center justify-center">
            <Link2 className="mx-auto h-3.5 w-3.5 text-theme-accent" />
          </div>
        </div>
      )}

      {/* Text layer / inline editor */}
      <div
        className={cn(
          "absolute inset-0 flex items-center justify-center overflow-hidden p-4 text-center text-[15px] leading-snug text-theme-text whitespace-pre-wrap break-words",
          !isEditing && "select-none"
        )}
        onPointerDown={isEditing ? (e) => e.stopPropagation() : undefined}
      >
        {isEditing ? (
          <textarea
            ref={taRef}
            autoFocus
            rows={1}
            value={draft}
            onChange={(e) => {
              applyDraft(e.target.value);
              handleEditorInput(e.currentTarget, e.target.value);
            }}
            onKeyDown={handleEditorKeyDown}
            onPointerDown={(e) => e.stopPropagation()}
            onBlur={commitEdit}
            className="w-full min-w-0 whitespace-pre-wrap break-words cursor-text resize-none overflow-hidden border-0 bg-transparent p-0 text-center text-[15px] leading-snug text-theme-text outline-none"
          />
        ) : box.text === "" ? (
          <span className="text-theme-muted opacity-60">Type something…</span>
        ) : (
          // Flex items default to min-width:auto — their floor is the LONGEST
          // UNBROKEN word, so a long word made this line box wider than the box
          // itself and text-center + overflow-hidden then clipped it on BOTH
          // sides after commit. w-full + min-w-0 clamp it to the box interior
          // so `break-words` wraps the word exactly like the textarea did.
          <div className="w-full min-w-0 whitespace-pre-wrap break-words text-center">
            {box.text}
          </div>
        )}
      </div>

      {/* Resize handles — only when selected and not editing */}
      {isSelected &&
        !isEditing &&
        HANDLES.map((h) => (
          <div
            key={h.dir}
            className={cn(
              "absolute z-10 touch-none rounded-[3px] border border-theme-accent/70 bg-theme-surface shadow-sm",
              h.cursor
            )}
            style={{
              left: h.left,
              top: h.top,
              width: HANDLE_PX,
              height: HANDLE_PX,
              transform: `translate(-50%, -50%) scale(${1 / zoom})`,
            }}
            onPointerDown={(e) => handleResizeStart(e, h.dir)}
            onPointerMove={handleResizeMove}
            onPointerUp={handleResizeEnd}
            onPointerCancel={handleResizeEnd}
            onDoubleClick={(e) => e.stopPropagation()}
          />
        ))}

      {/* Connection ports — hidden while editing */}
      {!isEditing &&
        PORTS.map((p) => (
          <div
            key={p.port}
            className={cn(
              "absolute z-10 touch-none rounded-full border-2 border-theme-accent bg-theme-surface cursor-crosshair transition-opacity duration-150",
              portsAlwaysVisible ? "opacity-100" : "opacity-0 group-hover:opacity-100"
            )}
            style={{
              left: p.left,
              top: p.top,
              width: PORT_PX,
              height: PORT_PX,
              transform: `translate(-50%, -50%) scale(${1 / zoom})`,
            }}
            onPointerDown={(e) => handlePortPointerDown(e, p.port)}
            onDoubleClick={(e) => e.stopPropagation()}
          />
        ))}
    </div>
  );
}
