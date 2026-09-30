/**
 * Persistence for the canvas — the defensive localStorage reader.
 *
 * Design philosophy: **user data survives everything.**
 *
 * The previous reader invalidated the WHOLE payload when a single box had a
 * non-finite coordinate (JSON silently turns NaN/Infinity into `null`), so one
 * bad write meant "start fresh" and every box vanished on the next refresh.
 * That is unacceptable, so the rules are now:
 *
 *  - structurally foreign payloads (not an object / wrong top-level types)
 *    still return `null` — nothing of ours to preserve;
 *  - individual bad records are SKIPPED, never fatal to their siblings;
 *  - bad GEOMETRY is repaired instead of dropped (defaults for size, a
 *    staggered diagonal fallback for position) so the box/text — and its
 *    content — is preserved;
 *  - a broken viewport falls back to the default instead of killing the doc.
 *
 * The invariants the Stage relies on still hold: key === id, `order`/
 * `textOrder` list every record exactly once, no dangling edges/attachments.
 */
import {
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
  type Box,
  type CanvasDoc,
  type Edge,
  type ID,
  type Port,
  type TextNode,
} from "./types";

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);

const isFiniteNumber = (value: unknown): value is number =>
  typeof value === "number" && Number.isFinite(value);

const PORTS: readonly string[] = ["top", "right", "bottom", "left"];

const isPort = (value: unknown): value is Port =>
  typeof value === "string" && PORTS.includes(value);

const isAttachSide = (value: unknown): value is "top" | "bottom" =>
  value === "top" || value === "bottom";

const clamp = (value: number, min: number, max: number): number =>
  Math.max(min, Math.min(max, value));

/**
 * Reads a persisted payload (see {@link parseDoc} semantics above) — a
 * sanitized document, or `null` only when the payload is unusable garbage.
 */
export function parseDoc(raw: unknown): CanvasDoc | null {
  if (!isRecord(raw)) return null;

  const { boxes, edges, order, viewport } = raw;
  if (!isRecord(boxes) || !isRecord(edges)) return null;

  // ---- viewport (repaired, never fatal) ----
  let vp = { x: 0, y: 0, zoom: 1 };
  if (isRecord(viewport)) {
    const vx = viewport.x;
    const vy = viewport.y;
    const vz = viewport.zoom;
    if (isFiniteNumber(vx) && isFiniteNumber(vy) && isFiniteNumber(vz)) {
      vp = { x: vx, y: vy, zoom: clamp(vz, MIN_ZOOM, MAX_ZOOM) };
    }
  }

  // ---- order (garbage → [], rebuilt from the boxes map below anyway) ----
  const orderIds: string[] = Array.isArray(order)
    ? order.filter((id): id is string => typeof id === "string")
    : [];

  // ---- boxes: skip unusable records, REPAIR bad geometry ----
  const nextBoxes: Record<ID, Box> = {};
  let fb = 0; // stagger index for repaired positions
  for (const value of Object.values(boxes)) {
    if (!isRecord(value)) continue;
    const id = value.id;
    if (typeof id !== "string" || id.length === 0 || nextBoxes[id]) continue;
    const text = typeof value.text === "string" ? value.text : "";
    const x = isFiniteNumber(value.x) ? value.x : fb * 40;
    const y = isFiniteNumber(value.y) ? value.y : fb * 40;
    const w = isFiniteNumber(value.w) && value.w > 0 ? value.w : DEFAULT_BOX_W;
    const h = isFiniteNumber(value.h) && value.h > 0 ? value.h : DEFAULT_BOX_H;
    nextBoxes[id] = { id, x, y, w: Math.max(MIN_BOX_W, w), h: Math.max(MIN_BOX_H, h), text };
    fb += 1;
  }

  // ---- texts (same repair philosophy as boxes) ----
  const rawTexts = raw.texts;
  const nextTexts: Record<ID, TextNode> = {};
  if (rawTexts !== undefined && isRecord(rawTexts)) {
    let tfb = 0;
    for (const value of Object.values(rawTexts)) {
      if (!isRecord(value)) continue;
      const id = value.id;
      if (typeof id !== "string" || id.length === 0 || nextTexts[id]) continue;
      const text = typeof value.text === "string" ? value.text : "";
      const x = isFiniteNumber(value.x) ? value.x : tfb * 40;
      const y = isFiniteNumber(value.y) ? value.y : tfb * 40;
      const w = isFiniteNumber(value.w) && value.w > 0 ? value.w : DEFAULT_TEXT_W;
      const h = isFiniteNumber(value.h) && value.h > 0 ? value.h : DEFAULT_TEXT_H;
      const node: TextNode = { id, x, y, w: Math.max(MIN_TEXT_W, w), h: Math.max(MIN_TEXT_H, h), text };
      // Attachment survives only when it still resolves to a real box and a
      // valid side; a dangling reference drops the attach fields entirely.
      const attachTo = value.attachTo;
      const side = value.attachSide;
      if (typeof attachTo === "string" && nextBoxes[attachTo] && isAttachSide(side)) {
        node.attachTo = attachTo;
        node.attachSide = side;
        node.attachOffsetX = isFiniteNumber(value.attachOffsetX) ? value.attachOffsetX : 0;
      }
      nextTexts[id] = node;
      tfb += 1;
    }
  }

  // ---- edges (keyed by their own id, dangling references dropped) ----
  const nextEdges: Record<ID, Edge> = {};
  for (const value of Object.values(edges)) {
    if (!isRecord(value)) continue;
    const id = value.id;
    const from = value.from;
    const to = value.to;
    if (typeof id !== "string" || id.length === 0) continue;
    if (typeof from !== "string" || typeof to !== "string") continue;
    if (!nextBoxes[from] || !nextBoxes[to] || from === to) continue;
    const edge: Edge = { id, from, to };
    if (isPort(value.fromPort)) edge.fromPort = value.fromPort;
    if (isPort(value.toPort)) edge.toPort = value.toPort;
    if (!nextEdges[id]) nextEdges[id] = edge;
  }

  // ---- order (dedupe, drop unknown ids, append boxes missing from it) ----
  const seen = new Set<ID>();
  const nextOrder: ID[] = [];
  for (const id of orderIds) {
    if (!nextBoxes[id] || seen.has(id)) continue;
    seen.add(id);
    nextOrder.push(id);
  }
  for (const id of Object.keys(nextBoxes)) {
    if (!seen.has(id)) {
      seen.add(id);
      nextOrder.push(id);
    }
  }

  // ---- textOrder (optional; dedupe, drop unknown ids, append missing) ----
  const rawTextOrder = raw.textOrder;
  const textOrderIds: string[] = [];
  if (rawTextOrder !== undefined && Array.isArray(rawTextOrder)) {
    textOrderIds.push(...rawTextOrder.filter((id): id is string => typeof id === "string"));
  }
  const seenTexts = new Set<ID>();
  const nextTextOrder: ID[] = [];
  for (const id of textOrderIds) {
    if (!nextTexts[id] || seenTexts.has(id)) continue;
    seenTexts.add(id);
    nextTextOrder.push(id);
  }
  for (const id of Object.keys(nextTexts)) {
    if (!seenTexts.has(id)) {
      seenTexts.add(id);
      nextTextOrder.push(id);
    }
  }

  return {
    boxes: nextBoxes,
    edges: nextEdges,
    order: nextOrder,
    texts: nextTexts,
    textOrder: nextTextOrder,
    viewport: vp,
  };
}
