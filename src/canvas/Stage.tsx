import { memo, useCallback, useEffect, useRef } from "react";
import type { MouseEvent as ReactMouseEvent, PointerEvent as ReactPointerEvent } from "react";

import { BoxNode } from "./BoxNode";
import { Edges } from "./Edges";
import { screenToWorld, type Pt } from "./geometry";
import { useCanvas } from "./store";
import { TextNode } from "./TextNode";
import { DEFAULT_BOX_H, DEFAULT_BOX_W } from "./types";
import type { ID, Tool } from "./types";

/**
 * NOTE: this project does not ship `@types/react`, so the ambient `JSX`
 * namespace that every `Component(): JSX.Element` signature refers to does not
 * exist and `tsc` reports "Cannot find namespace 'JSX'". Declaring it once,
 * globally, keeps those signatures (here, in Toolbar/ZoomControls/Canvas and in
 * the sibling canvas modules) type-checking without adding React typings the
 * rest of the codebase does not use. If `@types/react` is ever installed,
 * this block can simply be deleted — React 19 types expose their own `JSX`
 * namespace through `react/jsx-runtime`.
 */
declare global {
  namespace JSX {
    type Element = any;
    interface IntrinsicElements {
      [elemName: string]: any;
    }
  }
}

// BoxNode / Edges / TextNode subscribe to the store themselves: memoizing them
// here means Stage re-renders (pan/zoom/guides) never re-render the boxes,
// connectors or texts.
const MemoBoxNode = memo(BoxNode);
const MemoEdges = memo(Edges);
const MemoTextNode = memo(TextNode);
const MARQUEE_THRESHOLD = 4;

type CursorMode = "default" | "grab" | "grabbing" | "crosshair";

interface PanGesture {
  pointerId: number;
  lastX: number;
  lastY: number;
}

interface MarqueeGesture {
  pointerId: number;
  /** container-relative pointer position when the drag started */
  startX: number;
  startY: number;
  /** container-relative pointer position (latest, rAF-painted) */
  curX: number;
  curY: number;
  /** container rect at pointerdown, to map client -> container coords */
  rectLeft: number;
  rectTop: number;
}

/** Box-tool drag-to-draw gesture (same coordinate model as MarqueeGesture). */
interface DrawGesture {
  pointerId: number;
  /** container-relative pointer position when the drag started */
  startX: number;
  startY: number;
  /** container-relative pointer position (latest, rAF-painted) */
  curX: number;
  curY: number;
  /** container rect at pointerdown, to map client -> container coords */
  rectLeft: number;
  rectTop: number;
  /** world point where the drag started (a plain click centers the default box here) */
  startWorld: Pt;
}

function computeCursor(tool: Tool, spaceHeld: boolean, panning: boolean): CursorMode {
  if (panning) return "grabbing";
  if (spaceHeld || tool === "pan") return "grab";
  if (tool === "box") return "crosshair";
  return "default";
}

export function Stage(): JSX.Element {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const marqueeRef = useRef<HTMLDivElement | null>(null);
  const boxPreviewRef = useRef<HTMLDivElement | null>(null);

  const panRef = useRef<PanGesture | null>(null);
  const marqueeGestureRef = useRef<MarqueeGesture | null>(null);
  const drawGestureRef = useRef<DrawGesture | null>(null);
  const spaceHeldRef = useRef(false);
  const panningRef = useRef(false);
  const rafRef = useRef(0);
  const drawRafRef = useRef(0);

  // Only primitives / stable slices: `boxes` is deliberately never subscribed,
  // so dragging a box never re-renders the Stage itself.
  const order = useCanvas((s) => s.order);
  const textOrder = useCanvas((s) => s.textOrder);
  const viewport = useCanvas((s) => s.viewport);
  const stageSize = useCanvas((s) => s.stageSize);
  const tool = useCanvas((s) => s.tool);
  const guides = useCanvas((s) => s.guides);
  const connecting = useCanvas((s) => s.connecting);
  const isConnecting = connecting !== null;

  // ------------------------------------------------------------- cursor
  const syncCursor = useCallback(() => {
    const el = containerRef.current;
    if (!el) return;
    const mode = computeCursor(
      useCanvas.getState().tool,
      spaceHeldRef.current,
      panningRef.current
    );
    if (el.style.cursor !== mode) el.style.cursor = mode;
  }, []);

  // Re-sync after every render so tool changes (and the initial mount) win over
  // any imperative cursor write.
  useEffect(() => {
    syncCursor();
  });

  // ------------------------------------------------------------- marquee
  const paintMarquee = useCallback(() => {
    rafRef.current = 0;
    const el = marqueeRef.current;
    const mq = marqueeGestureRef.current;
    if (!el || !mq) return;
    const left = Math.min(mq.startX, mq.curX);
    const top = Math.min(mq.startY, mq.curY);
    el.style.display = "block";
    el.style.left = `${left}px`;
    el.style.top = `${top}px`;
    el.style.width = `${Math.abs(mq.curX - mq.startX)}px`;
    el.style.height = `${Math.abs(mq.curY - mq.startY)}px`;
  }, []);

  /** Coalesce pointermove bursts into a single paint per frame. */
  const scheduleMarqueePaint = () => {
    if (rafRef.current) return;
    rafRef.current = requestAnimationFrame(paintMarquee);
  };

  const hideMarquee = () => {
    if (rafRef.current) {
      cancelAnimationFrame(rafRef.current);
      rafRef.current = 0;
    }
    const el = marqueeRef.current;
    if (el) el.style.display = "none";
  };

  const capturePointer = (el: HTMLDivElement, pointerId: number) => {
    try {
      el.setPointerCapture(pointerId);
    } catch {
      // the pointer can already be inactive (e.g. a cancelled touch)
    }
  };

  const releaseCapture = (el: HTMLDivElement | null, pointerId: number) => {
    if (!el || !el.hasPointerCapture(pointerId)) return;
    try {
      el.releasePointerCapture(pointerId);
    } catch {
      // pointer capture may already be gone (element hidden / pointer cancelled)
    }
  };

  const startPan = (e: ReactPointerEvent<HTMLDivElement>) => {
    panRef.current = { pointerId: e.pointerId, lastX: e.clientX, lastY: e.clientY };
    panningRef.current = true;
    capturePointer(e.currentTarget, e.pointerId);
    syncCursor();
  };

  const startMarquee = (e: ReactPointerEvent<HTMLDivElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    marqueeGestureRef.current = {
      pointerId: e.pointerId,
      startX: x,
      startY: y,
      curX: x,
      curY: y,
      rectLeft: rect.left,
      rectTop: rect.top,
    };
    capturePointer(e.currentTarget, e.pointerId);
    scheduleMarqueePaint();
  };

  const finishMarquee = (e: ReactPointerEvent<HTMLDivElement>) => {
    const mq = marqueeGestureRef.current;
    marqueeGestureRef.current = null;
    hideMarquee();
    releaseCapture(e.currentTarget, e.pointerId);
    if (!mq) return;

    // final position (pointerup may land before the last rAF paint)
    mq.curX = e.clientX - mq.rectLeft;
    mq.curY = e.clientY - mq.rectTop;

    const state = useCanvas.getState();
    const moved = Math.hypot(mq.curX - mq.startX, mq.curY - mq.startY);
    if (moved < MARQUEE_THRESHOLD) {
      // a plain click on empty space clears the selection
      state.clearSelection();
      return;
    }

    const a = screenToWorld(state.viewport, mq.startX, mq.startY);
    const b = screenToWorld(state.viewport, mq.curX, mq.curY);
    const minX = Math.min(a.x, b.x);
    const maxX = Math.max(a.x, b.x);
    const minY = Math.min(a.y, b.y);
    const maxY = Math.max(a.y, b.y);

    const hits: ID[] = [];
    for (const id of state.order) {
      const box = state.boxes[id];
      if (!box) continue;
      if (box.x < maxX && box.x + box.w > minX && box.y < maxY && box.y + box.h > minY) {
        hits.push(id);
      }
    }
    // texts live in the same `selection` array as boxes, so hit-test them too
    for (const id of state.textOrder) {
      const t = state.texts[id];
      if (!t) continue;
      if (t.x < maxX && t.x + t.w > minX && t.y < maxY && t.y + t.h > minY) {
        hits.push(id);
      }
    }
    if (hits.length) state.selectBoxes(hits);
    else state.clearSelection();
  };

  const abortMarquee = (e: ReactPointerEvent<HTMLDivElement>) => {
    marqueeGestureRef.current = null;
    hideMarquee();
    releaseCapture(e.currentTarget, e.pointerId);
  };

  // --------------------------------------------------- box drag-to-draw
  const paintBoxPreview = () => {
    drawRafRef.current = 0;
    const el = boxPreviewRef.current;
    const g = drawGestureRef.current;
    if (!el || !g) return;
    el.style.display = "block";
    el.style.left = `${Math.min(g.startX, g.curX)}px`;
    el.style.top = `${Math.min(g.startY, g.curY)}px`;
    el.style.width = `${Math.abs(g.curX - g.startX)}px`;
    el.style.height = `${Math.abs(g.curY - g.startY)}px`;
  };

  /** Coalesce pointermove bursts into a single preview paint per frame. */
  const scheduleBoxPreviewPaint = () => {
    if (drawRafRef.current) return;
    drawRafRef.current = requestAnimationFrame(paintBoxPreview);
  };

  const hideBoxPreview = () => {
    if (drawRafRef.current) {
      cancelAnimationFrame(drawRafRef.current);
      drawRafRef.current = 0;
    }
    const el = boxPreviewRef.current;
    if (el) el.style.display = "none";
  };

  const startBoxDraw = (e: ReactPointerEvent<HTMLDivElement>) => {
    e.preventDefault();
    const rect = e.currentTarget.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    drawGestureRef.current = {
      pointerId: e.pointerId,
      startX: x,
      startY: y,
      curX: x,
      curY: y,
      rectLeft: rect.left,
      rectTop: rect.top,
      startWorld: screenToWorld(useCanvas.getState().viewport, x, y),
    };
    capturePointer(e.currentTarget, e.pointerId);
    scheduleBoxPreviewPaint();
  };

  const finishBoxDraw = (e: ReactPointerEvent<HTMLDivElement>) => {
    const g = drawGestureRef.current;
    drawGestureRef.current = null;
    hideBoxPreview();
    releaseCapture(e.currentTarget, e.pointerId);
    if (!g) return;

    // final position (pointerup may land before the last rAF paint)
    g.curX = e.clientX - g.rectLeft;
    g.curY = e.clientY - g.rectTop;

    const state = useCanvas.getState();
    const moved = Math.hypot(g.curX - g.startX, g.curY - g.startY);
    if (moved < MARQUEE_THRESHOLD) {
      // a plain click still drops a default-size box centered on the click
      const p = g.startWorld;
      state.addBox({ x: p.x - DEFAULT_BOX_W / 2, y: p.y - DEFAULT_BOX_H / 2 });
      return;
    }

    const cur = screenToWorld(state.viewport, g.curX, g.curY);
    const dwx = cur.x - g.startWorld.x;
    const dhy = cur.y - g.startWorld.y;
    state.addBox({
      x: Math.min(g.startWorld.x, cur.x),
      y: Math.min(g.startWorld.y, cur.y),
      w: Math.abs(dwx),
      h: Math.abs(dhy),
    });
    // addBox() selects the new box and switches back to the select tool
  };

  const abortBoxDraw = (e: ReactPointerEvent<HTMLDivElement>) => {
    drawGestureRef.current = null;
    hideBoxPreview();
    releaseCapture(e.currentTarget, e.pointerId);
  };

  // ------------------------------------------------------ pointer routing
  const handlePointerDown = (e: ReactPointerEvent<HTMLDivElement>) => {
    const state = useCanvas.getState();

    // 1) panning wins over everything. BoxNode lets pan-tool / middle-button
    //    gestures bubble, and the capture-phase listener above already claimed
    //    them (including space-held) before BoxNode could stopPropagation —
    //    this branch stays as the guaranteed-first check in Stage itself.
    if (e.button === 1 || spaceHeldRef.current || state.tool === "pan") {
      e.preventDefault();
      startPan(e);
      return;
    }

    // 2) an in-flight connection owns the pointer
    if (state.connecting) return;

    // 3) boxes / edges / texts own their own hit areas
    const hit =
      e.target instanceof Element
        ? e.target.closest("[data-box-id], [data-text-id], [data-edge-id]")
        : null;
    if (hit) return;

    // 4) true background
    if (e.button !== 0) return;

    if (state.tool === "box") {
      // drag-to-draw: preview now, box on pointerup (default size on a click)
      startBoxDraw(e);
      return;
    }

    if (state.tool === "select") startMarquee(e);
  };

  const handlePointerMove = (e: ReactPointerEvent<HTMLDivElement>) => {
    const pan = panRef.current;
    if (pan && pan.pointerId === e.pointerId) {
      const dx = e.clientX - pan.lastX;
      const dy = e.clientY - pan.lastY;
      if (dx !== 0 || dy !== 0) {
        pan.lastX = e.clientX;
        pan.lastY = e.clientY;
        useCanvas.getState().panBy(dx, dy);
      }
      return;
    }

    const g = drawGestureRef.current;
    if (g && g.pointerId === e.pointerId) {
      g.curX = e.clientX - g.rectLeft;
      g.curY = e.clientY - g.rectTop;
      scheduleBoxPreviewPaint();
      return;
    }

    const mq = marqueeGestureRef.current;
    if (mq && mq.pointerId === e.pointerId) {
      mq.curX = e.clientX - mq.rectLeft;
      mq.curY = e.clientY - mq.rectTop;
      scheduleMarqueePaint();
    }
  };

  const handlePointerUp = (e: ReactPointerEvent<HTMLDivElement>) => {
    const pan = panRef.current;
    if (pan && pan.pointerId === e.pointerId) {
      panRef.current = null;
      panningRef.current = false;
      releaseCapture(e.currentTarget, e.pointerId);
      syncCursor();
      return;
    }
    if (drawGestureRef.current?.pointerId === e.pointerId) {
      finishBoxDraw(e);
      return;
    }
    const mq = marqueeGestureRef.current;
    if (mq && mq.pointerId === e.pointerId) finishMarquee(e);
  };

  const handlePointerCancel = (e: ReactPointerEvent<HTMLDivElement>) => {
    const pan = panRef.current;
    if (pan && pan.pointerId === e.pointerId) {
      panRef.current = null;
      panningRef.current = false;
      releaseCapture(e.currentTarget, e.pointerId);
      syncCursor();
      return;
    }
    if (drawGestureRef.current?.pointerId === e.pointerId) {
      abortBoxDraw(e);
      return;
    }
    if (marqueeGestureRef.current?.pointerId === e.pointerId) abortMarquee(e);
  };

  // ------------------------------- double click on empty canvas = naked text
  const handleDoubleClick = (e: ReactMouseEvent<HTMLDivElement>) => {
    const state = useCanvas.getState();
    if (state.tool !== "select") return;
    // BoxNode / TextNode / Edges own their own double-clicks
    if (
      e.target instanceof Element &&
      e.target.closest("[data-box-id], [data-text-id], [data-edge-id]")
    ) {
      return;
    }
    const rect = containerRef.current?.getBoundingClientRect();
    if (!rect) return;
    const p = screenToWorld(state.viewport, e.clientX - rect.left, e.clientY - rect.top);
    // addText() selects the new text and switches back to the select tool
    const id = state.addText({ x: Math.round(p.x), y: Math.round(p.y) });
    state.setTextEditing(id);
  };

  // -------------------------------- panning must win over BoxNode's drag
  // BoxNode swallows pointerdown (stopPropagation) before Stage's React handler
  // runs, and it only yields for `tool === "pan"` / middle button — not while
  // space is held. This capture-phase listener runs first, takes the gesture for
  // panning, and stops the native event so neither BoxNode nor Stage's own
  // React handler starts a competing interaction. Later pointermove/up events
  // retarget to the captured container and still reach the React handlers.
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const onDown = (e: PointerEvent) => {
      const wantsPan =
        e.button === 1 || spaceHeldRef.current || useCanvas.getState().tool === "pan";
      if (!wantsPan) return;
      const target = e.target;
      if (!(target instanceof Node) || !el.contains(target)) return;
      e.preventDefault();
      e.stopPropagation();
      panRef.current = { pointerId: e.pointerId, lastX: e.clientX, lastY: e.clientY };
      panningRef.current = true;
      capturePointer(el, e.pointerId);
      syncCursor();
    };
    window.addEventListener("pointerdown", onDown, true);
    return () => window.removeEventListener("pointerdown", onDown, true);
  }, [syncCursor]);

  // ------------------------------------------------------- stage sizing
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const commit = (w: number, h: number) => useCanvas.getState().setStageSize({ w, h });
    commit(Math.round(el.clientWidth), Math.round(el.clientHeight));
    const ro = new ResizeObserver((entries) => {
      const rect = entries[0]?.contentRect;
      if (rect) commit(Math.round(rect.width), Math.round(rect.height));
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  // -------------------------------------------------- wheel pan / zoom
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const onWheel = (e: WheelEvent) => {
      // non-passive listener: we always own the wheel event on the canvas
      e.preventDefault();
      const rect = el.getBoundingClientRect();
      const state = useCanvas.getState();
      if (e.ctrlKey || e.metaKey) {
        const p = screenToWorld(state.viewport, e.clientX - rect.left, e.clientY - rect.top);
        state.zoomAt(p.x, p.y, state.viewport.zoom * Math.exp(-e.deltaY * 0.002));
      } else {
        const scale = e.deltaMode === 1 ? 16 : 1; // deltaMode 1 = lines
        state.panBy(-e.deltaX * scale, -e.deltaY * scale);
      }
    };
    el.addEventListener("wheel", onWheel, { passive: false });
    return () => el.removeEventListener("wheel", onWheel);
  }, []);

  // ------------------------------------------------- space bar = temporary pan
  useEffect(() => {
    const isTypingTarget = (target: EventTarget | null): boolean => {
      const el = target as HTMLElement | null;
      if (!el || typeof el.tagName !== "string") return false;
      const tag = el.tagName.toUpperCase();
      return tag === "INPUT" || tag === "TEXTAREA" || el.isContentEditable === true;
    };

    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key !== " ") return;
      if (useCanvas.getState().editingId) return;
      if (isTypingTarget(e.target)) return;
      e.preventDefault();
      spaceHeldRef.current = true;
      syncCursor();
    };
    const onKeyUp = (e: KeyboardEvent) => {
      if (e.key !== " ") return;
      if (spaceHeldRef.current) {
        spaceHeldRef.current = false;
        syncCursor();
      }
    };
    const onBlur = () => {
      if (spaceHeldRef.current) {
        spaceHeldRef.current = false;
        syncCursor();
      }
    };

    window.addEventListener("keydown", onKeyDown);
    window.addEventListener("keyup", onKeyUp);
    window.addEventListener("blur", onBlur);
    return () => {
      window.removeEventListener("keydown", onKeyDown);
      window.removeEventListener("keyup", onKeyUp);
      window.removeEventListener("blur", onBlur);
    };
  }, [syncCursor]);

  // ------------------------------------------- connection orchestration
  useEffect(() => {
    if (!isConnecting) return;

    const hoverBoxAt = (clientX: number, clientY: number): ID | null => {
      const under = document.elementFromPoint(clientX, clientY);
      const boxEl = under instanceof Element ? under.closest("[data-box-id]") : null;
      const id = boxEl?.getAttribute("data-box-id") ?? null;
      const fromId = useCanvas.getState().connecting?.fromId;
      // never allow self-connections
      return id && id === fromId ? null : id;
    };

    const worldPoint = (clientX: number, clientY: number) => {
      const rect = containerRef.current?.getBoundingClientRect();
      if (!rect) return null;
      return screenToWorld(
        useCanvas.getState().viewport,
        clientX - rect.left,
        clientY - rect.top
      );
    };

    const onMove = (e: PointerEvent) => {
      const p = worldPoint(e.clientX, e.clientY);
      if (!p) return;
      useCanvas.getState().moveConnect(p.x, p.y, hoverBoxAt(e.clientX, e.clientY));
    };

    const onUp = (e: PointerEvent) => {
      const p = worldPoint(e.clientX, e.clientY);
      const hoverId = hoverBoxAt(e.clientX, e.clientY);
      const state = useCanvas.getState();
      if (p) state.moveConnect(p.x, p.y, hoverId);
      // Edges disables its hit paths while connecting, so elementFromPoint
      // reliably reaches the boxes underneath the cursor.
      state.endConnect(hoverId);
    };

    const onCancel = () => {
      useCanvas.getState().endConnect(null);
    };

    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", onUp);
    window.addEventListener("pointercancel", onCancel);
    return () => {
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onUp);
      window.removeEventListener("pointercancel", onCancel);
    };
  }, [isConnecting]);

  // ------------------------------------------------------ unmount cleanup
  useEffect(
    () => () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
      rafRef.current = 0;
      if (drawRafRef.current) cancelAnimationFrame(drawRafRef.current);
      drawRafRef.current = 0;
    },
    []
  );

  // ------------------------------------------------------------ rendering
  const { x: vpX, y: vpY, zoom } = viewport;
  const worldLeft = -vpX / zoom;
  const worldTop = -vpY / zoom;
  const worldW = stageSize.w / zoom;
  const worldH = stageSize.h / zoom;

  return (
    <div
      ref={containerRef}
      className="relative w-full h-full overflow-hidden touch-none select-none"
      style={{ cursor: computeCursor(tool, spaceHeldRef.current, panningRef.current) }}
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
      onPointerCancel={handlePointerCancel}
      onDoubleClick={handleDoubleClick}
    >
      {/* 1 — clean backdrop (the dot grid was removed for a seamless, premium look) */}
      <div data-canvas-bg="true" className="absolute inset-0" />

      {/* 2 — world layer (connectors → texts → boxes → snap guides) */}
      <div
        className="absolute inset-0"
        style={{
          transform: `translate(${vpX}px, ${vpY}px) scale(${zoom})`,
          transformOrigin: "0 0",
        }}
      >
        <MemoEdges />

        {/* Naked texts render BEFORE boxes so a box dragged over one hides it */}
        {textOrder.map((id) => (
          <MemoTextNode key={id} textId={id} />
        ))}

        {order.map((id) => (
          <MemoBoxNode key={id} boxId={id} />
        ))}

        {guides.length > 0 && (
          <div className="absolute inset-0 pointer-events-none">
            {guides.map((g, i) =>
              g.axis === "x" ? (
                <div
                  key={`guide-x-${i}`}
                  className="absolute"
                  style={{
                    left: g.pos,
                    top: worldTop,
                    width: 1 / zoom,
                    height: worldH,
                    background: "rgb(var(--accent-rgb))",
                    opacity: 0.45,
                  }}
                />
              ) : (
                <div
                  key={`guide-y-${i}`}
                  className="absolute"
                  style={{
                    top: g.pos,
                    left: worldLeft,
                    width: worldW,
                    height: 1 / zoom,
                    background: "rgb(var(--accent-rgb))",
                    opacity: 0.45,
                  }}
                />
              )
            )}
          </div>
        )}
      </div>

      {/* 3 — marquee rectangle (screen space, painted imperatively) */}
      <div
        ref={marqueeRef}
        className="absolute rounded-sm pointer-events-none"
        style={{
          display: "none",
          left: 0,
          top: 0,
          width: 0,
          height: 0,
          border: "1px solid rgb(var(--accent-rgb) / 0.6)",
          background: "rgb(var(--accent-rgb) / 0.07)",
        }}
      />

      {/* 4 — box-tool drag-to-draw preview (screen space, painted imperatively) */}
      <div
        ref={boxPreviewRef}
        style={{
          display: "none",
          position: "absolute",
          left: 0,
          top: 0,
          width: 0,
          height: 0,
          border: "1.5px solid rgb(var(--accent-rgb))",
          background: "rgb(var(--accent-rgb) / 0.08)",
          borderRadius: 14,
          pointerEvents: "none",
          zIndex: 20,
        }}
      />
    </div>
  );
}
