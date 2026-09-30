import { create } from "zustand";
import type {
  AttachPreview,
  Box,
  CanvasDoc,
  ConnectingState,
  Edge,
  Guide,
  ID,
  Port,
  TextNode,
  Tool,
  Viewport,
} from "./types";
import {
  ATTACH_GAP,
  DEFAULT_BOX_H,
  DEFAULT_BOX_W,
  DEFAULT_TEXT_H,
  DEFAULT_TEXT_W,
  MAX_ZOOM,
  MIN_BOX_H,
  MIN_BOX_W,
  MIN_TEXT_H,
  MIN_TEXT_W,
  MIN_ZOOM,
} from "./types";
import { boundsOf } from "./geometry";
import { computeAutoLayout } from "./layout";

const MAX_HISTORY = 100;

export const uid = (): ID =>
  typeof crypto !== "undefined" && "randomUUID" in crypto
    ? crypto.randomUUID()
    : `id-${Math.random().toString(36).slice(2, 11)}`;

const clamp = (v: number, a: number, b: number) => Math.max(a, Math.min(b, v));

// ---- auto-layout motion ----------------------------------------------------
/** Travel time per box once its wave starts. */
const LAYOUT_DURATION_MS = 450;
/** Wave delay between consecutive flow layers (column 1 → 2 → 3 …). */
const LAYOUT_STAGGER_MS = 45;
/** Cap so long chains don't make the tail feel sluggish. */
const LAYOUT_STAGGER_CAP_MS = 135;
/** Snappy launch, long gentle settle — the "premium ease" of the rearrange. */
const easeOutQuint = (t: number) => 1 - Math.pow(1 - t, 5);

/** Everything undo/redo needs to restore a moment in time. */
interface Snap {
  boxes: Record<ID, Box>;
  edges: Record<ID, Edge>;
  order: ID[];
  texts: Record<ID, TextNode>;
  textOrder: ID[];
}

const snapOf = (s: CanvasStore): Snap => ({
  boxes: s.boxes,
  edges: s.edges,
  order: s.order,
  texts: s.texts,
  textOrder: s.textOrder,
});

/**
 * Value-level comparison. Key insertion order is stable in this store (every
 * record is built via spread of the previous record), so JSON equality is both
 * correct and cheap enough at gesture frequency — and it correctly detects
 * "nothing really changed" even when individual objects were rebuilt.
 */
const snapEqual = (a: Snap, b: Snap) =>
  JSON.stringify([a.boxes, a.edges, a.order, a.texts, a.textOrder]) ===
  JSON.stringify([b.boxes, b.edges, b.order, b.texts, b.textOrder]);

/** World position of an attached text node relative to its box. */
const attachedPos = (
  box: Box,
  t: Pick<TextNode, "h" | "attachOffsetX" | "attachSide">
): { x: number; y: number } => {
  const off = t.attachOffsetX ?? 0;
  return {
    x: box.x + off,
    y:
      t.attachSide === "top"
        ? box.y - t.h - ATTACH_GAP
        : box.y + box.h + ATTACH_GAP,
  };
};

/** Returns a copy of `t` with attachment fields removed. */
const stripAttach = (t: TextNode): TextNode => ({
  id: t.id,
  x: t.x,
  y: t.y,
  w: t.w,
  h: t.h,
  text: t.text,
});

export interface CanvasStore {
  boxes: Record<ID, Box>;
  edges: Record<ID, Edge>;
  order: ID[];
  texts: Record<ID, TextNode>;
  textOrder: ID[];
  viewport: Viewport;
  stageSize: { w: number; h: number };

  selection: ID[];
  selectedEdgeId: ID | null;
  editingId: ID | null;
  editingTextId: ID | null;
  tool: Tool;
  connecting: ConnectingState | null;
  attachPreview: AttachPreview | null;
  guides: Guide[];

  past: Snap[];
  future: Snap[];
  gesture: Snap | null;
  canUndo: boolean;
  canRedo: boolean;

  // ---- history ----
  pushHistory: () => void;
  beginGesture: () => void;
  endGesture: () => void;
  undo: () => void;
  redo: () => void;

  // ---- boxes ----
  addBox: (p?: { x?: number; y?: number; w?: number; h?: number; text?: string }) => ID;
  updateBox: (id: ID, patch: Partial<Omit<Box, "id">>, opts?: { history?: boolean }) => void;
  restoreBox: (box: Box) => void;
  deleteBoxes: (ids: ID[]) => void;
  deleteSelection: () => void;
  duplicateSelection: () => void;
  /** Tidy the SELECTED boxes into an aligned layered layout (one undo step). */
  autoLayoutSelected: () => void;
  /**
   * Move a set of boxes/texts by one rigid delta (multi-select drag).
   * Attached labels whose box is also moving ride along via cascade and are
   * skipped here; an attached text dragged away from a static box detaches.
   * Plain — the drag gesture owns history.
   */
  moveGroup: (p: {
    ids: ID[];
    /** Start position per member (captured at gesture start). */
    from: Record<ID, { x: number; y: number }>;
    dx: number;
    dy: number;
  }) => void;

  // ---- text nodes ----
  addText: (p?: { x?: number; y?: number; text?: string; w?: number }) => ID;
  updateText: (id: ID, patch: Partial<Omit<TextNode, "id">>, opts?: { history?: boolean }) => void;
  restoreText: (t: TextNode) => void;
  deleteTexts: (ids: ID[], opts?: { history?: boolean }) => void;
  attachText: (textId: ID, boxId: ID, side: "top" | "bottom") => void;
  detachText: (id: ID) => void;
  setAttachPreview: (p: AttachPreview | null) => void;
  setTextEditing: (id: ID | null) => void;

  // ---- edges ----
  addEdge: (from: ID, to: ID, fromPort?: Port, toPort?: Port) => ID | null;
  removeEdge: (id: ID) => void;
  selectEdge: (id: ID | null) => void;

  // ---- selection / tools ----
  selectBoxes: (ids: ID[]) => void;
  toggleSelect: (id: ID, additive: boolean) => void;
  clearSelection: () => void;
  setEditing: (id: ID | null) => void;
  setTool: (t: Tool) => void;
  setGuides: (g: Guide[]) => void;

  // ---- viewport ----
  setViewport: (v: Viewport) => void;
  panBy: (dx: number, dy: number) => void;
  zoomAt: (worldX: number, worldY: number, zoom: number) => void;
  zoomBy: (factor: number) => void;
  setStageSize: (s: { w: number; h: number }) => void;
  fitView: () => void;

  // ---- connections ----
  startConnect: (fromId: ID, fromPort: Port) => void;
  moveConnect: (x: number, y: number, hoverId: ID | null) => void;
  endConnect: (targetId: ID | null) => void;

  // ---- persistence ----
  getDoc: () => CanvasDoc;
  loadDoc: (d: CanvasDoc) => void;
}

export const useCanvas = create<CanvasStore>((set, get) => {
  /**
   * Nesting counter for the single gesture slot. Multiple components may open
   * a gesture in the same tick (e.g. pointerdown on box B fires before the
   * textarea of box A blurs): the shared pre-gesture snapshot is only pushed
   * when the LAST owner closes, so neither interaction loses its undo entry.
   * A stale count self-heals: beginGesture resets it whenever the slot is empty.
   */
  let gestureCount = 0;

  const pushPast = (s: CanvasStore, snapshot: Snap) => {
    const past = [...s.past, snapshot].slice(-MAX_HISTORY);
    set({ past, future: [], canUndo: true, canRedo: false });
  };

  /** Cascade offset so repeated toolbar spawns don't stack exactly on center. */
  let spawnCount = 0;
  const spawnOffset = () => {
    const i = spawnCount++;
    return { dx: (i % 7) * 26, dy: (i % 7) * 26 };
  };

  /**
   * rAF handle for the auto-layout glide. Any conflicting action (grabbing a
   * box, undo/redo, loading a doc) stops it — boxes simply freeze where they
   * are, which is a perfectly valid geometry snapshot.
   */
  let layoutRaf: number | null = null;
  const stopLayoutAnimation = () => {
    if (layoutRaf !== null) {
      cancelAnimationFrame(layoutRaf);
      layoutRaf = null;
    }
  };

  /** Recomputes x/y of every text attached to `boxId` after `next` replaced it. */
  const cascadeAttachedTexts = (
    prevTexts: Record<ID, TextNode>,
    boxId: ID,
    next: Box
  ): Record<ID, TextNode> => {
    let texts = prevTexts;
    for (const t of Object.values(prevTexts)) {
      if (t.attachTo !== boxId) continue;
      const pos = attachedPos(next, t);
      if (pos.x !== t.x || pos.y !== t.y) {
        if (texts === prevTexts) texts = { ...prevTexts };
        texts[t.id] = { ...t, ...pos };
      }
    }
    return texts;
  };

  return {
    boxes: {},
    edges: {},
    order: [],
    texts: {},
    textOrder: [],
    viewport: { x: 0, y: 0, zoom: 1 },
    stageSize: { w: 0, h: 0 },

    selection: [],
    selectedEdgeId: null,
    editingId: null,
    editingTextId: null,
    tool: "select",
    connecting: null,
    attachPreview: null,
    guides: [],

    past: [],
    future: [],
    gesture: null,
    canUndo: false,
    canRedo: false,

    // ---------------- history ----------------
    pushHistory: () => {
      const s = get();
      pushPast(s, snapOf(s));
    },

    beginGesture: () => {
      stopLayoutAnimation(); // user grabbed something — freeze the rearrange
      if (get().gesture) {
        gestureCount += 1;
        return;
      }
      gestureCount = 1;
      set({ gesture: snapOf(get()) });
    },

    endGesture: () => {
      const s = get();
      if (!s.gesture) return;
      gestureCount -= 1;
      if (gestureCount > 0) return; // another owner still holds the gesture
      gestureCount = 0;
      if (snapEqual(s.gesture, snapOf(s))) {
        set({ gesture: null });
        return;
      }
      pushPast(s, s.gesture);
      set({ gesture: null });
    },

    undo: () => {
      stopLayoutAnimation(); // restore wins over an in-flight glide
      const s = get();
      if (!s.past.length) return;
      const prev = s.past[s.past.length - 1];
      set({
        past: s.past.slice(0, -1),
        future: [snapOf(s), ...s.future].slice(0, MAX_HISTORY),
        boxes: prev.boxes,
        edges: prev.edges,
        order: prev.order,
        texts: prev.texts,
        textOrder: prev.textOrder,
        selection: [],
        selectedEdgeId: null,
        editingId: null,
        editingTextId: null,
        connecting: null,
        attachPreview: null,
        gesture: null,
        guides: [],
        canUndo: s.past.length - 1 > 0,
        canRedo: true,
      });
    },

    redo: () => {
      stopLayoutAnimation();
      const s = get();
      if (!s.future.length) return;
      const next = s.future[0];
      set({
        future: s.future.slice(1),
        past: [...s.past, snapOf(s)].slice(-MAX_HISTORY),
        boxes: next.boxes,
        edges: next.edges,
        order: next.order,
        texts: next.texts,
        textOrder: next.textOrder,
        selection: [],
        selectedEdgeId: null,
        editingId: null,
        editingTextId: null,
        gesture: null,
        guides: [],
        canUndo: true,
        canRedo: s.future.length - 1 > 0,
      });
    },

    // ---------------- boxes ----------------
    addBox: (p = {}) => {
      const s = get();
      pushPast(s, snapOf(s));
      const id = uid();
      const w = Math.max(MIN_BOX_W, Math.round(p.w ?? DEFAULT_BOX_W));
      const h = Math.max(MIN_BOX_H, Math.round(p.h ?? DEFAULT_BOX_H));
      const off = p.x === undefined && p.y === undefined ? spawnOffset() : { dx: 0, dy: 0 };
      const cx = (s.stageSize.w || 800) / 2;
      const cy = (s.stageSize.h || 600) / 2;
      const wx = p.x ?? (cx - s.viewport.x) / s.viewport.zoom - w / 2 + off.dx;
      const wy = p.y ?? (cy - s.viewport.y) / s.viewport.zoom - h / 2 + off.dy;
      const box: Box = {
        id,
        x: Math.round(wx),
        y: Math.round(wy),
        w,
        h,
        text: p.text ?? "",
      };
      set({
        boxes: { ...s.boxes, [id]: box },
        order: [...s.order, id],
        selection: [id],
        selectedEdgeId: null,
        tool: "select",
      });
      return id;
    },

    updateBox: (id, patch, opts) => {
      const s = get();
      const cur = s.boxes[id];
      if (!cur) return;
      if (opts?.history) pushPast(s, snapOf(s));
      const next: Box = { ...cur, ...patch, id };
      // Never let a non-finite patch poison the store — JSON would turn NaN
      // into `null` and persistence would have to repair it after a refresh.
      if (!Number.isFinite(next.x)) next.x = cur.x;
      if (!Number.isFinite(next.y)) next.y = cur.y;
      if (!Number.isFinite(next.w)) next.w = cur.w;
      if (!Number.isFinite(next.h)) next.h = cur.h;
      if (next.w < MIN_BOX_W) next.w = MIN_BOX_W;
      if (next.h < MIN_BOX_H) next.h = MIN_BOX_H;
      const boxes = { ...s.boxes, [id]: next };
      const affectsGeometry =
        "x" in patch || "y" in patch || "w" in patch || "h" in patch;
      if (affectsGeometry) {
        const texts = cascadeAttachedTexts(s.texts, id, next);
        set(texts !== s.texts ? { boxes, texts } : { boxes });
      } else {
        set({ boxes });
      }
    },

    restoreBox: (box) => {
      const s = get();
      if (!s.boxes[box.id]) return;
      const boxes = { ...s.boxes, [box.id]: box };
      const texts = cascadeAttachedTexts(s.texts, box.id, box);
      set(texts !== s.texts ? { boxes, texts } : { boxes });
    },

    deleteBoxes: (ids) => {
      const s = get();
      const setIds = new Set(ids.filter((id) => s.boxes[id]));
      if (!setIds.size) return;
      pushPast(s, snapOf(s));
      const boxes = { ...s.boxes };
      for (const id of setIds) delete boxes[id];
      const edges: Record<ID, Edge> = {};
      for (const [id, e] of Object.entries(s.edges)) {
        if (!setIds.has(e.from) && !setIds.has(e.to)) edges[id] = e;
      }
      // texts attached to a deleted box are detached in place (kept on canvas)
      let texts = s.texts;
      for (const t of Object.values(s.texts)) {
        if (t.attachTo && setIds.has(t.attachTo)) {
          if (texts === s.texts) texts = { ...s.texts };
          texts[t.id] = stripAttach(t);
        }
      }
      set({
        boxes,
        edges,
        order: s.order.filter((id) => !setIds.has(id)),
        ...(texts !== s.texts ? { texts } : {}),
        selection: s.selection.filter((id) => !setIds.has(id)),
        editingId: setIds.has(s.editingId ?? "") ? null : s.editingId,
        selectedEdgeId: null,
        ...(s.attachPreview && setIds.has(s.attachPreview.boxId)
          ? { attachPreview: null }
          : {}),
        ...(s.connecting && setIds.has(s.connecting.fromId) ? { connecting: null } : {}),
      });
    },

    deleteSelection: () => {
      const s = get();
      if (s.selectedEdgeId) {
        get().removeEdge(s.selectedEdgeId);
        return;
      }
      const boxIds = s.selection.filter((id) => s.boxes[id]);
      const textIds = s.selection.filter((id) => s.texts[id]);
      if (!boxIds.length && !textIds.length) return;

      pushPast(s, snapOf(s));
      const setB = new Set(boxIds);
      const setT = new Set(textIds);

      const boxes = { ...s.boxes };
      for (const id of setB) delete boxes[id];

      const texts = { ...s.texts };
      for (const id of setT) delete texts[id];
      for (const t of Object.values(texts)) {
        if (t.attachTo && setB.has(t.attachTo)) texts[t.id] = stripAttach(t);
      }

      const edges: Record<ID, Edge> = {};
      for (const [id, e] of Object.entries(s.edges)) {
        if (!setB.has(e.from) && !setB.has(e.to)) edges[id] = e;
      }

      set({
        boxes,
        texts,
        edges,
        order: s.order.filter((id) => !setB.has(id)),
        textOrder: s.textOrder.filter((id) => !setT.has(id)),
        selection: [],
        selectedEdgeId: null,
        editingId: setB.has(s.editingId ?? "") ? null : s.editingId,
        editingTextId: setT.has(s.editingTextId ?? "") ? null : s.editingTextId,
        attachPreview: null,
      });
    },

    duplicateSelection: () => {
      const s = get();
      const boxMap = new Map<ID, ID>();
      const textMap = new Map<ID, ID>();
      for (const id of s.selection) {
        if (s.boxes[id]) boxMap.set(id, uid());
        else if (s.texts[id]) textMap.set(id, uid());
      }
      if (!boxMap.size && !textMap.size) return;
      pushPast(s, snapOf(s));

      const boxes = { ...s.boxes };
      const order = [...s.order];
      for (const [id, nid] of boxMap) {
        const b = s.boxes[id];
        boxes[nid] = { ...b, id: nid, x: b.x + 24, y: b.y + 24 };
        order.push(nid);
      }

      const texts = { ...s.texts };
      const textOrder = [...s.textOrder];
      for (const [id, nid] of textMap) {
        const t = s.texts[id];
        const copy: TextNode = { ...stripAttach(t), id: nid, x: t.x + 24, y: t.y + 24 };
        texts[nid] = copy;
        textOrder.push(nid);
      }

      const edges = { ...s.edges };
      for (const e of Object.values(s.edges)) {
        const nf = boxMap.get(e.from);
        const nt = boxMap.get(e.to);
        if (nf && nt) {
          const newId = uid();
          edges[newId] = { id: newId, from: nf, to: nt, fromPort: e.fromPort, toPort: e.toPort };
        }
      }

      set({
        boxes,
        texts,
        edges,
        order,
        textOrder,
        selection: [...boxMap.values(), ...textMap.values()],
        selectedEdgeId: null,
      });
    },

    /**
     * Auto-layout: rearranges ONLY the selected boxes according to their own
     * connector graph (layered flow with aligned columns/rows and even gaps).
     * Unselected boxes are never moved; lone selected boxes with no connection
     * to another selected box stay put. Applied as a single undo step.
     */
    autoLayoutSelected: () => {
      const s = get();
      const ids = s.selection.filter((id) => s.boxes[id]);
      if (ids.length < 2) return;
      const idSet = new Set(ids);
      const intra = Object.values(s.edges).filter(
        (e) => idSet.has(e.from) && idSet.has(e.to) && e.from !== e.to
      );
      const positions = computeAutoLayout(s.boxes, ids, intra);
      if (!positions) return;

      // Skip entirely when the result is visually identical.
      const moves = Object.entries(positions).filter(([id, p]) => {
        const b = get().boxes[id];
        return b && (Math.abs(b.x - p.x) > 0.5 || Math.abs(b.y - p.y) > 0.5);
      });
      if (!moves.length) return;

      // One undo step for the whole rearrange; a retarget mid-glide reuses
      // the snapshot pushed by the first click instead of stacking entries.
      const retargeting = layoutRaf !== null;
      if (!retargeting) pushPast(s, snapOf(s));
      stopLayoutAnimation();

      // Capture per-box start points and staggered start delays.
      const from: Record<ID, { x: number; y: number }> = {};
      const targets: Array<{ id: ID; x: number; y: number; delay: number }> = [];
      for (const [id, p] of moves) {
        if (!Number.isFinite(p.x) || !Number.isFinite(p.y)) continue;
        const b = get().boxes[id];
        if (!b) continue;
        from[id] = { x: b.x, y: b.y };
        targets.push({
          id,
          x: p.x,
          y: p.y,
          delay:
            Math.min(
              (Number.isFinite(p.layer) ? p.layer : 0) * LAYOUT_STAGGER_MS,
              LAYOUT_STAGGER_CAP_MS
            ) || 0,
        });
      }
      if (!targets.length) return;

      /**
       * Per-frame glide: the store is the single source of truth, so attached
       * labels ride along and connectors re-route from live geometry on every
       * frame — the whole scene moves as one. The final frame lands on the
       * exact integer targets from the layout solver.
       */
      const t0 = performance.now();
      const tick = (now: number) => {
        layoutRaf = null;
        const cur = get();
        let boxes = cur.boxes;
        let texts = cur.texts;
        let pending = false;
        let changed = false;

        for (const tgt of targets) {
          const b = boxes[tgt.id];
          if (!b) continue; // deleted mid-glide — nothing to move
          const t = Math.min(
            1,
            Math.max(0, (now - t0 - tgt.delay) / LAYOUT_DURATION_MS)
          );
          const start = from[tgt.id];
          let nx: number;
          let ny: number;
          if (t >= 1) {
            // Completed: land EXACTLY on the solved integer position — no
            // epsilon, no sub-pixel drift (rows/columns stay perfectly aligned).
            nx = tgt.x;
            ny = tgt.y;
            if (b.x === nx && b.y === ny) continue;
          } else {
            pending = true;
            const e = easeOutQuint(t);
            nx = start.x + (tgt.x - start.x) * e;
            ny = start.y + (tgt.y - start.y) * e;
            if (Math.abs(b.x - nx) <= 0.01 && Math.abs(b.y - ny) <= 0.01) continue;
          }
          if (!Number.isFinite(nx) || !Number.isFinite(ny)) continue; // never poison state
          const next: Box = { ...b, x: nx, y: ny };
          boxes = { ...boxes, [tgt.id]: next };
          texts = cascadeAttachedTexts(texts, tgt.id, next);
          changed = true;
        }

        if (changed) set(texts !== cur.texts ? { boxes, texts } : { boxes });
        if (pending) layoutRaf = requestAnimationFrame(tick);
      };
      layoutRaf = requestAnimationFrame(tick);
    },

    moveGroup: ({ ids, from, dx, dy }) => {
      if (!ids.length || !Number.isFinite(dx) || !Number.isFinite(dy)) return;
      if (dx === 0 && dy === 0) return;
      const s = get();
      const movingBoxes = new Set<ID>();
      for (const id of ids) if (s.boxes[id]) movingBoxes.add(id);

      let boxes = s.boxes;
      let texts = s.texts;
      let changed = false;

      // Boxes first — their attached labels re-anchor via cascade.
      for (const id of ids) {
        const st = from[id];
        const b = boxes[id];
        if (!st || !b) continue;
        const nx = st.x + dx;
        const ny = st.y + dy;
        if (b.x === nx && b.y === ny) continue;
        const next: Box = { ...b, x: nx, y: ny };
        boxes = { ...boxes, [id]: next };
        texts = cascadeAttachedTexts(texts, id, next);
        changed = true;
      }

      // Texts: skip the ones riding a moving box (cascade already placed
      // them); detach any text that is moving away from a static box.
      for (const id of ids) {
        const st = from[id];
        const t = texts[id];
        if (!st || !t) continue;
        if (t.attachTo && movingBoxes.has(t.attachTo)) continue;
        const nx = st.x + dx;
        const ny = st.y + dy;
        if (t.x === nx && t.y === ny) continue;
        const next: TextNode = t.attachTo
          ? stripAttach({ ...t, x: nx, y: ny })
          : { ...t, x: nx, y: ny };
        texts = { ...texts, [id]: next };
        changed = true;
      }

      if (!changed) return;
      set(texts !== s.texts ? { boxes, texts } : { boxes });
    },

    // ---------------- text nodes ----------------
    addText: (p = {}) => {
      const s = get();
      pushPast(s, snapOf(s));
      const id = uid();
      const off = p.x === undefined && p.y === undefined ? spawnOffset() : { dx: 0, dy: 0 };
      const cx = (s.stageSize.w || 800) / 2;
      const cy = (s.stageSize.h || 600) / 2;
      const wx = p.x ?? (cx - s.viewport.x) / s.viewport.zoom + off.dx;
      const wy = p.y ?? (cy - s.viewport.y) / s.viewport.zoom + off.dy;
      const t: TextNode = {
        id,
        x: Math.round(wx),
        y: Math.round(wy),
        w: Math.max(MIN_TEXT_W, p.w ?? DEFAULT_TEXT_W),
        h: DEFAULT_TEXT_H,
        text: p.text ?? "",
      };
      set({
        texts: { ...s.texts, [id]: t },
        textOrder: [...s.textOrder, id],
        selection: [id],
        selectedEdgeId: null,
        tool: "select",
      });
      return id;
    },

    updateText: (id, patch, opts) => {
      const s = get();
      const cur = s.texts[id];
      if (!cur) return;
      if (opts?.history) pushPast(s, snapOf(s));
      const next: TextNode = { ...cur, ...patch, id };
      // Same non-finite guard as updateBox — keep the last good geometry.
      if (!Number.isFinite(next.x)) next.x = cur.x;
      if (!Number.isFinite(next.y)) next.y = cur.y;
      if (!Number.isFinite(next.w)) next.w = cur.w;
      if (!Number.isFinite(next.h)) next.h = cur.h;
      if (next.w < MIN_TEXT_W) next.w = MIN_TEXT_W;
      if (next.h < MIN_TEXT_H) next.h = MIN_TEXT_H;
      // keep attached placement valid when the node itself resizes
      if (next.attachTo && ("w" in patch || "h" in patch)) {
        const box = s.boxes[next.attachTo];
        if (box) {
          const maxOff = box.w - next.w;
          next.attachOffsetX =
            maxOff >= 0
              ? clamp(next.attachOffsetX ?? 0, 0, maxOff)
              : (box.w - next.w) / 2;
          const pos = attachedPos(box, next);
          next.x = pos.x;
          next.y = pos.y;
        } else {
          delete next.attachTo;
          delete next.attachSide;
          delete next.attachOffsetX;
        }
      }
      set({ texts: { ...s.texts, [id]: next } });
    },

    restoreText: (t) => {
      const s = get();
      if (!s.texts[t.id]) return;
      set({ texts: { ...s.texts, [t.id]: t } });
    },

    deleteTexts: (ids, opts) => {
      const s = get();
      const setIds = new Set(ids.filter((id) => s.texts[id]));
      if (!setIds.size) return;
      if (opts?.history) pushPast(s, snapOf(s));
      const texts = { ...s.texts };
      for (const id of setIds) delete texts[id];
      set({
        texts,
        textOrder: s.textOrder.filter((id) => !setIds.has(id)),
        selection: s.selection.filter((id) => !setIds.has(id)),
        editingTextId: setIds.has(s.editingTextId ?? "") ? null : s.editingTextId,
        ...(s.attachPreview && setIds.has(s.attachPreview.textId)
          ? { attachPreview: null }
          : {}),
      });
    },

    attachText: (textId, boxId, side) => {
      const s = get();
      const t = s.texts[textId];
      const b = s.boxes[boxId];
      if (!t || !b) return;
      const maxOff = b.w - t.w;
      const off = maxOff >= 0 ? clamp(t.x - b.x, 0, maxOff) : (b.w - t.w) / 2;
      const base: TextNode = { ...t, attachTo: boxId, attachSide: side, attachOffsetX: off };
      const pos = attachedPos(b, base);
      set({
        texts: { ...s.texts, [textId]: { ...base, ...pos } },
        attachPreview: null,
      });
    },

    detachText: (id) => {
      const s = get();
      const t = s.texts[id];
      if (!t || !t.attachTo) {
        if (s.attachPreview) set({ attachPreview: null });
        return;
      }
      set({ texts: { ...s.texts, [id]: stripAttach(t) }, attachPreview: null });
    },

    setAttachPreview: (p) => {
      const cur = get().attachPreview;
      if (cur?.textId === p?.textId && cur?.boxId === p?.boxId && cur?.side === p?.side) return;
      set({ attachPreview: p });
    },

    setTextEditing: (id) =>
      set({
        editingTextId: id,
        ...(id
          ? { editingId: null, selectedEdgeId: null }
          : {}),
      }),

    // ---------------- edges ----------------
    addEdge: (from, to, fromPort, toPort) => {
      const s = get();
      if (!s.boxes[from] || !s.boxes[to] || from === to) return null;
      const dup = Object.values(s.edges).some(
        (e) => (e.from === from && e.to === to) || (e.from === to && e.to === from)
      );
      if (dup) return null;
      pushPast(s, snapOf(s));
      const id = uid();
      const edge: Edge = { id, from, to, fromPort, toPort };
      set({ edges: { ...s.edges, [id]: edge } });
      return id;
    },

    removeEdge: (id) => {
      const s = get();
      if (!s.edges[id]) return;
      pushPast(s, snapOf(s));
      const edges = { ...s.edges };
      delete edges[id];
      set({ edges, selectedEdgeId: s.selectedEdgeId === id ? null : s.selectedEdgeId });
    },

    selectEdge: (id) =>
      set({ selectedEdgeId: id, selection: [], editingId: null, editingTextId: null }),

    // ---------------- selection / tools ----------------
    selectBoxes: (ids) => set({ selection: ids, selectedEdgeId: null }),
    toggleSelect: (id, additive) => {
      const s = get();
      if (!additive) {
        set({ selection: [id], selectedEdgeId: null });
        return;
      }
      set({
        selection: s.selection.includes(id)
          ? s.selection.filter((x) => x !== id)
          : [...s.selection, id],
        selectedEdgeId: null,
      });
    },
    clearSelection: () =>
      set({ selection: [], selectedEdgeId: null, editingId: null, editingTextId: null }),
    setEditing: (id) =>
      set({ editingId: id, ...(id ? { editingTextId: null, selectedEdgeId: null } : {}) }),
    setTool: (t) =>
      set({
        tool: t,
        ...(t !== "select"
          ? { selection: [], selectedEdgeId: null, editingId: null, editingTextId: null }
          : {}),
      }),
    setGuides: (g) => {
      const cur = get().guides;
      const same =
        cur.length === g.length && cur.every((x, i) => x.axis === g[i].axis && x.pos === g[i].pos);
      if (!same) set({ guides: g });
    },

    // ---------------- viewport ----------------
    setViewport: (v) => set({ viewport: v }),
    panBy: (dx, dy) => {
      const v = get().viewport;
      set({ viewport: { ...v, x: v.x + dx, y: v.y + dy } });
    },
    zoomAt: (wx, wy, zoom) => {
      const v = get().viewport;
      const z = clamp(zoom, MIN_ZOOM, MAX_ZOOM);
      if (z === v.zoom) return;
      set({ viewport: { x: v.x + wx * (v.zoom - z), y: v.y + wy * (v.zoom - z), zoom: z } });
    },
    zoomBy: (factor) => {
      const s = get();
      const cx = (s.stageSize.w || 800) / 2;
      const cy = (s.stageSize.h || 600) / 2;
      const wx = (cx - s.viewport.x) / s.viewport.zoom;
      const wy = (cy - s.viewport.y) / s.viewport.zoom;
      get().zoomAt(wx, wy, s.viewport.zoom * factor);
    },
    setStageSize: (size) => {
      const s = get();
      if (s.stageSize.w === size.w && s.stageSize.h === size.h) return;
      set({ stageSize: size });
    },
    fitView: () => {
      const s = get();
      const b = boundsOf({ ...s.boxes, ...s.texts });
      const sw = s.stageSize.w || 800;
      const sh = s.stageSize.h || 600;
      if (!b) {
        set({ viewport: { x: sw / 2, y: sh / 2, zoom: 1 } });
        return;
      }
      const pad = 96;
      const zoom = clamp(Math.min(sw / (b.w + pad * 2), sh / (b.h + pad * 2)), MIN_ZOOM, 1.4);
      // Poisoned bounds (non-finite geometry upstream) must not kill the
      // viewport — a NaN viewport would invalidate the persisted document.
      if (!Number.isFinite(zoom) || !Number.isFinite(b.minX) || !Number.isFinite(b.minY)) return;
      set({
        viewport: {
          zoom,
          x: sw / 2 - (b.minX + b.w / 2) * zoom,
          y: sh / 2 - (b.minY + b.h / 2) * zoom,
        },
      });
    },

    // ---------------- connections ----------------
    startConnect: (fromId, fromPort) => {
      const b = get().boxes[fromId];
      if (!b) return;
      const a =
        fromPort === "top"
          ? { x: b.x + b.w / 2, y: b.y }
          : fromPort === "bottom"
          ? { x: b.x + b.w / 2, y: b.y + b.h }
          : fromPort === "left"
          ? { x: b.x, y: b.y + b.h / 2 }
          : { x: b.x + b.w, y: b.y + b.h / 2 };
      set({
        connecting: { fromId, fromPort, x: a.x, y: a.y, hoverId: null },
        selection: [fromId],
        selectedEdgeId: null,
        guides: [],
      });
    },
    moveConnect: (x, y, hoverId) => {
      const c = get().connecting;
      if (!c) return;
      if (c.x === x && c.y === y && c.hoverId === hoverId) return;
      set({ connecting: { ...c, x, y, hoverId } });
    },
    endConnect: (targetId) => {
      const c = get().connecting;
      if (!c) return;
      set({ connecting: null });
      if (targetId && targetId !== c.fromId) {
        get().addEdge(c.fromId, targetId, c.fromPort, undefined);
      }
    },

    // ---------------- persistence ----------------
    getDoc: () => {
      const s = get();
      return {
        boxes: s.boxes,
        edges: s.edges,
        order: s.order,
        texts: s.texts,
        textOrder: s.textOrder,
        viewport: s.viewport,
      };
    },
    loadDoc: (d) => {
      stopLayoutAnimation(); // never glide between two documents
      // sanitize boxes: finite geometry only, minimum sizes enforced
      const boxes: Record<ID, Box> = {};
      for (const [id, b] of Object.entries(d.boxes ?? {})) {
        if (
          !b ||
          b.id !== id ||
          typeof b.text !== "string" ||
          !Number.isFinite(b.x) ||
          !Number.isFinite(b.y) ||
          !Number.isFinite(b.w) ||
          !Number.isFinite(b.h)
        ) {
          continue;
        }
        boxes[id] = {
          id,
          x: b.x,
          y: b.y,
          w: Math.max(MIN_BOX_W, b.w),
          h: Math.max(MIN_BOX_H, b.h),
          text: b.text,
        };
      }

      const edges: Record<ID, Edge> = {};
      for (const [id, e] of Object.entries(d.edges ?? {})) {
        if (!e || !boxes[e.from] || !boxes[e.to] || e.from === e.to) continue;
        edges[id] = { ...e, id };
      }

      const order: ID[] = [];
      const seenOrder = new Set<ID>();
      for (const id of d.order ?? []) {
        if (boxes[id] && !seenOrder.has(id)) {
          seenOrder.add(id);
          order.push(id);
        }
      }
      for (const id of Object.keys(boxes)) {
        if (!seenOrder.has(id)) {
          seenOrder.add(id);
          order.push(id);
        }
      }

      // texts: sanitize, drop dangling attachments, restore attached placement
      const texts: Record<ID, TextNode> = {};
      for (const [id, t] of Object.entries(d.texts ?? {})) {
        if (!t || t.id !== id) continue;
        if (
          typeof t.x !== "number" ||
          !Number.isFinite(t.x) ||
          typeof t.y !== "number" ||
          !Number.isFinite(t.y) ||
          typeof t.w !== "number" ||
          !Number.isFinite(t.w) ||
          typeof t.h !== "number" ||
          !Number.isFinite(t.h) ||
          typeof t.text !== "string"
        ) {
          continue;
        }
        const copy = stripAttach(t); // then re-attach if the box is still valid
        copy.w = Math.max(MIN_TEXT_W, t.w);
        copy.h = Math.max(MIN_TEXT_H, t.h);
        if (t.attachTo && boxes[t.attachTo] && (t.attachSide === "top" || t.attachSide === "bottom")) {
          const box = boxes[t.attachTo];
          copy.attachTo = t.attachTo;
          copy.attachSide = t.attachSide;
          const rawOff =
            typeof t.attachOffsetX === "number" && Number.isFinite(t.attachOffsetX)
              ? t.attachOffsetX
              : 0;
          const maxOff = box.w - copy.w;
          copy.attachOffsetX =
            maxOff >= 0 ? clamp(rawOff, 0, maxOff) : (box.w - copy.w) / 2;
          const pos = attachedPos(box, copy);
          copy.x = pos.x;
          copy.y = pos.y;
        }
        texts[id] = copy;
      }
      const textOrder: ID[] = [];
      const seenTexts = new Set<ID>();
      for (const id of d.textOrder ?? []) {
        if (texts[id] && !seenTexts.has(id)) {
          seenTexts.add(id);
          textOrder.push(id);
        }
      }
      for (const id of Object.keys(texts)) {
        if (!seenTexts.has(id)) {
          seenTexts.add(id);
          textOrder.push(id);
        }
      }

      const rawZoom = d.viewport?.zoom;
      const zoom = Number.isFinite(rawZoom) ? Math.max(MIN_ZOOM, Math.min(MAX_ZOOM, rawZoom)) : 1;

      set({
        boxes,
        edges,
        order,
        texts,
        textOrder,
        viewport: { x: d.viewport?.x ?? 0, y: d.viewport?.y ?? 0, zoom },
        selection: [],
        selectedEdgeId: null,
        editingId: null,
        editingTextId: null,
        connecting: null,
        attachPreview: null,
        guides: [],
        gesture: null,
        past: [],
        future: [],
        canUndo: false,
        canRedo: false,
      });
    },
  };
});
