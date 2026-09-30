// Pure geometry helpers: coordinate transforms + edge (connector) path math.
import type { Box, Port, Viewport } from "./types";

export interface Pt {
  x: number;
  y: number;
}

/** Screen (client-relative-to-stage) point -> world point. */
export function screenToWorld(v: Viewport, sx: number, sy: number): Pt {
  return { x: (sx - v.x) / v.zoom, y: (sy - v.y) / v.zoom };
}

/** World point -> screen (stage-relative) point. */
export function worldToScreen(v: Viewport, wx: number, wy: number): Pt {
  return { x: wx * v.zoom + v.x, y: wy * v.zoom + v.y };
}

export function anchorPoint(b: Box, port: Port): Pt {
  switch (port) {
    case "top":
      return { x: b.x + b.w / 2, y: b.y };
    case "bottom":
      return { x: b.x + b.w / 2, y: b.y + b.h };
    case "left":
      return { x: b.x, y: b.y + b.h / 2 };
    case "right":
      return { x: b.x + b.w, y: b.y + b.h / 2 };
  }
}

/** Pick the pair of ports that face each other based on relative position. */
export function autoPorts(a: Box, b: Box): [Port, Port] {
  const acx = a.x + a.w / 2;
  const acy = a.y + a.h / 2;
  const bcx = b.x + b.w / 2;
  const bcy = b.y + b.h / 2;
  const dx = bcx - acx;
  const dy = bcy - acy;
  if (Math.abs(dx) >= Math.abs(dy)) {
    return dx >= 0 ? ["right", "left"] : ["left", "right"];
  }
  return dy >= 0 ? ["bottom", "top"] : ["top", "bottom"];
}

const TANGENT: Record<Port, Pt> = {
  top: { x: 0, y: -1 },
  bottom: { x: 0, y: 1 },
  left: { x: -1, y: 0 },
  right: { x: 1, y: 0 },
};

function controlPoint(p: Pt, port: Port, len: number): Pt {
  const t = TANGENT[port];
  // Gentler pull on short runs, generous S-curve on long ones → connectors
  // stay elegant at every distance and re-route cleanly when sides flip.
  const d = Math.max(64, Math.min(280, len * 0.5));
  return { x: p.x + t.x * d, y: p.y + t.y * d };
}

/** Smooth cubic bezier between two boxes.
 * Honors whichever ports are provided; any missing port is auto-picked
 * so the connector leaves from the exact port the user dragged.
 */
export function edgePath(a: Box, b: Box, fromPort?: Port, toPort?: Port): string {
  const auto: [Port, Port] = autoPorts(a, b);
  const pa: Port = fromPort ?? auto[0];
  const pb: Port = toPort ?? auto[1];
  const p1 = anchorPoint(a, pa);
  const p2 = anchorPoint(b, pb);
  const len = Math.hypot(p2.x - p1.x, p2.y - p1.y);
  const c1 = controlPoint(p1, pa, len);
  const c2 = controlPoint(p2, pb, len);
  return `M ${p1.x} ${p1.y} C ${c1.x} ${c1.y}, ${c2.x} ${c2.y}, ${p2.x} ${p2.y}`;
}

/** Path from a fixed anchor+port to a free cursor point (connection preview). */
export function previewPath(from: Pt, port: Port, to: Pt): string {
  const len = Math.hypot(to.x - from.x, to.y - from.y);
  const c1 = controlPoint(from, port, len);
  const dx = to.x - from.x;
  const dy = to.y - from.y;
  const horizontal = Math.abs(dx) >= Math.abs(dy);
  const c2 = horizontal
    ? { x: to.x - Math.sign(dx || 1) * Math.max(40, Math.abs(dx) * 0.4), y: to.y }
    : { x: to.x, y: to.y - Math.sign(dy || 1) * Math.max(40, Math.abs(dy) * 0.4) };
  return `M ${from.x} ${from.y} C ${c1.x} ${c1.y}, ${c2.x} ${c2.y}, ${to.x} ${to.y}`;
}

/** Bounds of a record of boxes ({x,y,w,h} in world coords). */
export function boundsOf(boxes: Record<string, Box>, ids?: string[]) {
  const list: Box[] = (ids ? ids.map((i) => boxes[i]) : Object.values(boxes)).filter(
    (b): b is Box => Boolean(b)
  );
  if (!list.length) return null;
  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;
  for (const b of list) {
    minX = Math.min(minX, b.x);
    minY = Math.min(minY, b.y);
    maxX = Math.max(maxX, b.x + b.w);
    maxY = Math.max(maxY, b.y + b.h);
  }
  return { minX, minY, maxX, maxY, w: maxX - minX, h: maxY - minY };
}
