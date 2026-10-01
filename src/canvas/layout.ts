/**
 * computeAutoLayout — a layered (Sugiyama-style) auto-layout for a SELECTED
 * subset of boxes, driven by the connector graph.
 *
 * Design contract:
 *  - **Selection-only**: only the ids passed in are ever computed; unselected
 *    boxes are never touched, and lone selected nodes with no connection to any
 *    other selected node are left exactly where they are (there is nothing to
 *    "arrange" about them).
 *  - **Deterministic & meaningful** (never random, never click-order
 *    dependent): compact BFS-distance layering keeps hub-and-spoke graphs
 *    structured — a node with a direct edge from the hub sits one column out
 *    from it no matter how long the indirect chain is, so chains only unroll
 *    when they genuinely must; cycles are broken at the geometrically-backward
 *    edge (so a double-headed connector always keeps its forward direction),
 *    median-heuristic sweeps reduce edge crossings, then columns align
 *    perfectly and ROWS share one top across columns (grid alignment).
 *  - **Respects the user's flow direction**: the dominant axis of the current
 *    edge geometry decides left→right vs top→bottom, with ties broken toward
 *    horizontal (mind-maps read left→right), so a chain you drew vertically
 *    stays vertical after tidying but a square-ish scatter never flips.
 *  - **In-place**: the arranged group is translated so its bounding-box center
 *    matches the selection's original center — boxes tidy up where they are.
 *
 * Coordinates are computed in "flow space" (primary = along the flow,
 * secondary = stacking axis) and mapped back to world x/y at the end, so the
 * same code path serves both horizontal and vertical flows.
 */
import type { Box, Edge, ID } from "./types";

export interface LayoutPoint {
  x: number;
  y: number;
}

/** Final placement: position + the box's flow layer (drives staggered motion). */
export interface LayoutPlacement extends LayoutPoint {
  /** 0-based flow rank — earlier layers start moving first (wave effect). */
  layer: number;
}

/** World-unit gaps (zoom-independent, so layout looks identical at any zoom). */
const GAP_PRIMARY = 200; // between layers/columns — room for connectors to arc
const GAP_SECONDARY = 120; // between boxes stacked inside one layer/column
const GAP_COMPONENT = 240; // between disconnected groups in the selection

// ---- flow-space helpers ----------------------------------------------------
const cx = (b: Box) => b.x + b.w / 2;
const cy = (b: Box) => b.y + b.h / 2;
const primCoord = (b: Box, flowH: boolean) => (flowH ? b.x : b.y);
const secCoord = (b: Box, flowH: boolean) => (flowH ? b.y : b.x);
const primSize = (b: Box, flowH: boolean) => (flowH ? b.w : b.h);
const secSize = (b: Box, flowH: boolean) => (flowH ? b.h : b.w);

/**
 * DFS that classifies edges: edges to a GRAY node are back edges (part of a
 * cycle) and get dropped; everything else is kept. The result is a DAG.
 *
 * Out-neighbours are explored in `rank` order — geometrically-forward edges
 * first — so a cycle is always "opened" at the edge that already points
 * against the flow. The kept direction then renders forward after layout,
 * which is what makes double-headed connectors read sensibly instead of
 * landing mirrored by whichever box happened to be clicked first.
 */
function buildDag(
  rootIds: ID[],
  out: Map<ID, Set<ID>>,
  rankOf: (from: ID, to: ID) => number
): Map<ID, ID[]> {
  const WHITE = 0;
  const GRAY = 1;
  const BLACK = 2;
  const color = new Map<ID, number>();
  const dag = new Map<ID, ID[]>();
  for (const id of rootIds) dag.set(id, []);

  const visit = (v: ID) => {
    color.set(v, GRAY);
    const neigh = Array.from(out.get(v) ?? []);
    // Forward geometric edges first (so cycles open at backward edges), then
    // id — the id tie-break keeps traversal identical no matter which order
    // the edges were recorded in (never click/creation-order dependent).
    neigh.sort((a, b) => rankOf(v, a) - rankOf(v, b) || a.localeCompare(b));
    for (const w of neigh) {
      if (!dag.has(w)) continue; // outside this component
      const c = color.get(w) ?? WHITE;
      if (c === GRAY) continue; // back edge → drop (breaks the cycle)
      dag.get(v)!.push(w);
      if (c === WHITE) visit(w);
    }
    color.set(v, BLACK);
  };

  for (const id of rootIds) if ((color.get(id) ?? WHITE) === WHITE) visit(id);
  return dag;
}

/**
 * Compact layering over the DAG — two passes:
 *
 *  1. **BFS distance from the sources**: a node with a DIRECT edge from the
 *     hub sits one column out from the hub, no matter how long the indirect
 *     chain between them is. This is what keeps hub-and-spoke diagrams
 *     structured instead of unrolling every chain into one straight line
 *     (chain edges that end up inside a column simply render as short
 *     vertical arrows, which reads far better than a 7-box row).
 *  2. **Monotone pull in topological order**: a parent may pull its child
 *     LATER — `layer(child) = max(layer(child), layer(parent))` — so no kept
 *     edge ever renders backward. The pull is equality-only (no +1), so a
 *     long chain never pads extra columns when the node is already placed.
 *
 * Both passes are order-independent (first-visit BFS = min over paths, the
 * pull = max over parents), so the result never depends on selection order.
 * Layer gaps are compressed at the end so columns are always contiguous 0..k.
 */
function computeLayers(rootIds: ID[], dag: Map<ID, ID[]>): Map<ID, number> {
  const layer = new Map<ID, number>();
  const outEdges = (v: ID): ID[] => dag.get(v) ?? [];

  // ---- pass 1: multi-source BFS → shortest distance from any root -------
  const indeg = new Map<ID, number>();
  for (const id of rootIds) indeg.set(id, 0);
  for (const id of rootIds) {
    for (const w of outEdges(id)) indeg.set(w, (indeg.get(w) ?? 0) + 1);
  }
  const queue: ID[] = [];
  for (const id of rootIds) {
    if ((indeg.get(id) ?? 0) === 0) {
      layer.set(id, 0);
      queue.push(id);
    }
  }
  let qi = 0;
  while (qi < queue.length) {
    const v = queue[qi++];
    const lv = layer.get(v)!;
    for (const w of outEdges(v)) {
      if (!layer.has(w)) {
        layer.set(w, lv + 1); // FIFO first visit == shortest distance
        queue.push(w);
      }
    }
  }
  for (const id of rootIds) if (!layer.has(id)) layer.set(id, 0);

  // ---- pass 2: topological pull (never backward, never padding) ---------
  const indeg2 = new Map<ID, number>();
  for (const id of rootIds) indeg2.set(id, 0);
  for (const id of rootIds) {
    for (const w of outEdges(id)) indeg2.set(w, (indeg2.get(w) ?? 0) + 1);
  }
  const ready: ID[] = [];
  for (const id of rootIds) if ((indeg2.get(id) ?? 0) === 0) ready.push(id);
  let ri = 0;
  while (ri < ready.length) {
    const v = ready[ri++];
    const lv = layer.get(v)!;
    for (const w of outEdges(v)) {
      if (layer.get(w)! < lv) layer.set(w, lv);
      const d = (indeg2.get(w) ?? 0) - 1;
      indeg2.set(w, d);
      if (d === 0) ready.push(w);
    }
  }

  // ---- compress gaps → contiguous columns 0..k --------------------------
  const distinct = Array.from(new Set(layer.values())).sort((a, b) => a - b);
  const remap = new Map<number, number>();
  distinct.forEach((v, i) => remap.set(v, i));
  for (const [id, v] of layer) layer.set(id, remap.get(v)!);
  return layer;
}

/**
 * Crossing reduction: 6 median-heuristic sweeps (down/up alternating). Each
 * layer is re-sorted by the median secondary position of its neighbours on the
 * side being swept; nodes without neighbours there keep their place. Stable
 * sort keeps ties deterministic (the initial order is geometry-sorted, so the
 * result never depends on selection/click order).
 */
function orderLayers(
  layers: ID[][],
  layerIndex: Map<ID, number>,
  undirected: Map<ID, Set<ID>>,
  secondarySize: (id: ID) => number
): void {
  /** Provisional stacking positions derived from the CURRENT order. */
  const provisional = (): Map<ID, number> => {
    const pos = new Map<ID, number>();
    for (const layer of layers) {
      let c = 0;
      for (const id of layer) {
        pos.set(id, c);
        c += secondarySize(id) + GAP_SECONDARY;
      }
    }
    return pos;
  };

  const medianKey = (
    v: ID,
    pos: Map<ID, number>,
    want: (neighborLayer: number) => boolean
  ): number => {
    const vals: number[] = [];
    for (const u of undirected.get(v) ?? []) {
      const lu = layerIndex.get(u);
      if (lu === undefined || !want(lu) || !pos.has(u)) continue;
      vals.push(pos.get(u)!);
    }
    if (vals.length === 0) return pos.get(v)!; // no neighbours → stay put
    vals.sort((a, b) => a - b);
    const m = vals.length >> 1;
    return vals.length % 2 === 1 ? vals[m] : (vals[m - 1] + vals[m]) / 2;
  };

  for (let iter = 0; iter < 6; iter++) {
    const down = iter % 2 === 0;
    const pos = provisional();
    for (let i = 0; i < layers.length - 1; i++) {
      const li = down ? 1 + i : layers.length - 2 - i;
      if (li < 0 || li >= layers.length) continue;
      const keys = new Map<ID, number>();
      for (const id of layers[li]) {
        keys.set(
          id,
          medianKey(id, pos, (other) => (down ? other < li : other > li))
        );
      }
      layers[li].sort((a, b) => (keys.get(a) ?? 0) - (keys.get(b) ?? 0));
    }
  }
}

interface ComponentLayout {
  ids: ID[];
  prim: Map<ID, number>;
  sec: Map<ID, number>;
  primExtent: number;
  secExtent: number;
  /** Original centroid along the primary axis — keeps component order stable. */
  origPrimCenter: number;
  /** Flow layer per node (pre-crossing-reduction layering). */
  layerOf: Map<ID, number>;
}

/**
 * @param boxes current box geometry (read-only)
 * @param ids   the SELECTED box ids — nothing outside this list is returned
 * @param edges connector edges (filtered internally to intra-selection ones)
 * @returns new top-left position per participating box (+ its flow layer for
 *          animation stagger), or null when there is nothing meaningful to
 *          arrange (fewer than 2 linked selected boxes)
 */
export function computeAutoLayout(
  boxes: Record<ID, Box>,
  ids: ID[],
  edges: Edge[]
): Record<ID, LayoutPlacement> | null {
  // ---- 1. participating nodes --------------------------------------------
  const nodes = new Map<ID, Box>();
  for (const id of ids) {
    const b = boxes[id];
    if (
      b &&
      Number.isFinite(b.x) &&
      Number.isFinite(b.y) &&
      Number.isFinite(b.w) &&
      Number.isFinite(b.h)
    ) {
      nodes.set(id, b);
    }
  }
  if (nodes.size < 2) return null;

  // ---- 2. intra-selection graph + dominant (current) direction -----------
  const out = new Map<ID, Set<ID>>();
  const undirected = new Map<ID, Set<ID>>();
  for (const id of nodes.keys()) {
    out.set(id, new Set());
    undirected.set(id, new Set());
  }
  const link = (m: Map<ID, Set<ID>>, a: ID, b: ID) => m.get(a)!.add(b);

  let dxSum = 0;
  let dySum = 0;
  let edgeCount = 0;
  for (const e of edges) {
    if (e.from === e.to) continue;
    if (!nodes.has(e.from) || !nodes.has(e.to)) continue; // selection-only
    edgeCount += 1;
    link(out, e.from, e.to);
    link(undirected, e.from, e.to);
    link(undirected, e.to, e.from);
    const a = nodes.get(e.from)!;
    const b = nodes.get(e.to)!;
    dxSum += Math.abs(cx(b) - cx(a));
    dySum += Math.abs(cy(b) - cy(a));
  }
  if (edgeCount === 0) return null;
  // Dominant axis of the CURRENT arrangement; near-ties break toward
  // horizontal so a square-ish scatter never flips into rows unexpectedly.
  const flowH = dxSum >= dySum * 0.85;

  // Geometric rank of an edge along the flow: forward edges come first when
  // the cycle-breaking DFS explores, so cycles open at backward edges.
  const rankOf = (from: ID, to: ID): number => {
    const A = nodes.get(from);
    const B = nodes.get(to);
    if (!A || !B) return 1;
    const d = flowH ? cx(B) - cx(A) : cy(B) - cy(A);
    return d > 0 ? 0 : d === 0 ? 1 : 2;
  };

  // ---- 3. weakly-connected components (size ≥ 2 only) --------------------
  const seen = new Set<ID>();
  const components: ID[][] = [];
  for (const start of nodes.keys()) {
    if (seen.has(start)) continue;
    const comp: ID[] = [];
    const stack: ID[] = [start];
    seen.add(start);
    while (stack.length) {
      const v = stack.pop()!;
      comp.push(v);
      for (const u of undirected.get(v) ?? []) {
        if (!seen.has(u)) {
          seen.add(u);
          stack.push(u);
        }
      }
    }
    if (comp.length >= 2) components.push(comp);
  }
  if (components.length === 0) return null; // lone nodes → nothing to arrange

  // Canonical member order (geometry first, id as the final tie-break) so the
  // layout is identical no matter which box the user selected first.
  const byGeom = (a: ID, b: ID): number => {
    const A = nodes.get(a)!;
    const B = nodes.get(b)!;
    return (
      primCoord(A, flowH) - primCoord(B, flowH) ||
      secCoord(A, flowH) - secCoord(B, flowH) ||
      a.localeCompare(b)
    );
  };
  for (const comp of components) comp.sort(byGeom);

  // ---- 4. per-component layered layout -----------------------------------
  const comps: ComponentLayout[] = [];
  for (const comp of components) {
    const compSet = new Set(comp);
    const outLocal = new Map<ID, Set<ID>>();
    for (const id of comp) {
      const s = new Set<ID>();
      for (const w of out.get(id) ?? []) if (compSet.has(w)) s.add(w);
      outLocal.set(id, s);
    }

    const dag = buildDag(comp, outLocal, rankOf);
    const layerOf = computeLayers(comp, dag);

    let maxLayer = 0;
    for (const l of layerOf.values()) maxLayer = Math.max(maxLayer, l);
    const layers: ID[][] = Array.from({ length: maxLayer + 1 }, () => []);
    for (const id of comp) layers[layerOf.get(id)!].push(id);
    // Initial order follows the user's current placement along the stacking
    // axis (secondary first, then primary) — fully geometry-derived, so ties
    // can never leak selection order into the result.
    for (const arr of layers) {
      arr.sort(
        (a, b) =>
          secCoord(nodes.get(a)!, flowH) - secCoord(nodes.get(b)!, flowH) ||
          primCoord(nodes.get(a)!, flowH) - primCoord(nodes.get(b)!, flowH)
      );
    }

    orderLayers(layers, layerOf, undirected, (id) =>
      secSize(nodes.get(id)!, flowH)
    );

    // Secondary: stack inside each layer (every stack starts at 0 so slot
    // indices mean the same thing in every layer), then GRID-ALIGN: the i-th
    // node of every multi-node layer gets ONE shared top, so rows line up
    // horizontally across columns exactly like the reference layout. A slot's
    // shared top is raised (for all layers at once) whenever any layer would
    // overlap — rows stay aligned AND collision-free.
    const prim = new Map<ID, number>();
    const sec = new Map<ID, number>();
    const layerSecHeights: number[] = [];
    for (const arr of layers) {
      let c = 0;
      for (const id of arr) {
        sec.set(id, c);
        c += secSize(nodes.get(id)!, flowH) + GAP_SECONDARY;
      }
      layerSecHeights.push(Math.max(0, c - GAP_SECONDARY));
    }

    const multiLayers = layers
      .map((_, li) => li)
      .filter((li) => layers[li].length >= 2);
    if (multiLayers.length >= 2) {
      const slotCount = Math.max(...multiLayers.map((li) => layers[li].length));
      const slotTop: number[] = [];
      const slotOk: boolean[] = [];
      for (let s = 0; s < slotCount; s++) {
        let sum = 0;
        let cnt = 0;
        for (const li of multiLayers) {
          if (s < layers[li].length) {
            sum += sec.get(layers[li][s])!;
            cnt++;
          }
        }
        slotOk[s] = cnt >= 2; // a slot only one layer reaches stays private
        slotTop[s] = cnt >= 2 ? sum / cnt : 0;
      }
      for (let s = 1; s < slotCount; s++) {
        if (!slotOk[s]) continue;
        let need = slotTop[s];
        for (const li of multiLayers) {
          if (s >= layers[li].length) continue;
          const prev = layers[li][s - 1];
          const prevTop = slotOk[s - 1] ? slotTop[s - 1] : sec.get(prev)!;
          need = Math.max(
            need,
            prevTop + secSize(nodes.get(prev)!, flowH) + GAP_SECONDARY
          );
        }
        slotTop[s] = need;
      }
      for (let s = 0; s < slotCount; s++) {
        if (!slotOk[s]) continue;
        for (const li of multiLayers) {
          if (s < layers[li].length) sec.set(layers[li][s], slotTop[s]);
        }
      }
    }

    // Recompute block heights after alignment. Multi-node layers are the grid
    // (anchored at 0); single-node layers have no row partner, so they simply
    // center inside the full extent — a lone source/sink sits mid-height.
    layers.forEach((arr, li) => {
      const last = arr[arr.length - 1];
      layerSecHeights[li] = sec.get(last)! + secSize(nodes.get(last)!, flowH);
    });
    const secExtent = Math.max(...layerSecHeights);
    layers.forEach((arr, li) => {
      if (arr.length >= 2) return;
      const off = (secExtent - layerSecHeights[li]) / 2;
      for (const id of arr) sec.set(id, sec.get(id)! + off);
    });

    // Primary: every box of a layer shares ONE coordinate → perfectly aligned
    // columns (rows when the flow is vertical).
    let p = 0;
    for (const arr of layers) {
      let size = 0;
      for (const id of arr) {
        prim.set(id, p);
        size = Math.max(size, primSize(nodes.get(id)!, flowH));
      }
      p += size + GAP_PRIMARY;
    }
    const primExtent = Math.max(0, p - GAP_PRIMARY);

    let origSum = 0;
    for (const id of comp) {
      origSum +=
        primCoord(nodes.get(id)!, flowH) + primSize(nodes.get(id)!, flowH) / 2;
    }

    comps.push({
      ids: comp,
      prim,
      sec,
      primExtent,
      secExtent,
      origPrimCenter: origSum / comp.length,
      layerOf,
    });
  }

  // ---- 5. combine components (order along flow, stack across) ------------
  comps.sort(
    (a, b) =>
      a.origPrimCenter - b.origPrimCenter || a.ids[0].localeCompare(b.ids[0])
  );
  const maxPrimExtent = Math.max(...comps.map((c) => c.primExtent));
  const totalSec =
    comps.reduce((acc, c) => acc + c.secExtent + GAP_COMPONENT, 0) -
    GAP_COMPONENT;

  // Target: the original bounding-box center of the participating selection,
  // so the tidied group lands where the user already was looking.
  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;
  for (const c of comps) {
    for (const id of c.ids) {
      const b = nodes.get(id)!;
      if (b.x < minX) minX = b.x;
      if (b.y < minY) minY = b.y;
      if (b.x + b.w > maxX) maxX = b.x + b.w;
      if (b.y + b.h > maxY) maxY = b.y + b.h;
    }
  }
  const targetCx = (minX + maxX) / 2;
  const targetCy = (minY + maxY) / 2;

  const layoutCx = flowH ? maxPrimExtent / 2 : totalSec / 2;
  const layoutCy = flowH ? totalSec / 2 : maxPrimExtent / 2;
  const dx = targetCx - layoutCx;
  const dy = targetCy - layoutCy;

  const finalPos: Record<ID, LayoutPlacement> = {};
  let secCursor = 0;
  for (const c of comps) {
    const primOff = (maxPrimExtent - c.primExtent) / 2;
    const secOff = secCursor;
    secCursor += c.secExtent + GAP_COMPONENT;
    for (const id of c.ids) {
      const P = c.prim.get(id)! + primOff;
      const S = c.sec.get(id)! + secOff;
      const x = flowH ? P + dx : S + dx;
      const y = flowH ? S + dy : P + dy;
      finalPos[id] = {
        x: Math.round(x),
        y: Math.round(y),
        layer: c.layerOf.get(id) ?? 0,
      };
    }
  }
  return finalPos;
}
