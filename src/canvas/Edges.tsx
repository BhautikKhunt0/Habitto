/**
 * Edge (connector) layer of the canvas.
 *
 * Rendered by Stage inside the WORLD layer — every coordinate below is in
 * WORLD space and is scaled by `viewport.zoom` on the parent transform.
 *
 * Hit-testing contract:
 *  - the root <svg> is `pointer-events: none`, so it never blocks the boxes;
 *  - each edge's wide transparent stroke opts back in with `pointer-events: stroke`;
 *  - while a connection is being dragged, ALL hit strokes switch off so Stage's
 *    `document.elementFromPoint(...).closest('[data-box-id]')` can find the
 *    drop target underneath us.
 */
import { motion } from "framer-motion";

import { anchorPoint, edgePath, previewPath } from "./geometry";
import { useCanvas } from "./store";

/** Theme accent — black in light mode, white in dark mode. */
const ACCENT = "rgb(var(--accent-rgb))";

/** This layer covers ±20 000 world units around the origin. */
const AREA = 40000;
const ORIGIN = -20000;

export function Edges(): JSX.Element {
  // Primitive subscriptions only — this re-renders on every box-drag frame,
  // so the render body has to stay cheap. (No selection/order/history slices.)
  const boxes = useCanvas((s) => s.boxes);
  const edges = useCanvas((s) => s.edges);
  const selectedEdgeId = useCanvas((s) => s.selectedEdgeId);
  const connecting = useCanvas((s) => s.connecting);
  const zoom = useCanvas((s) => s.viewport.zoom);

  // Stable store actions (no re-render cost).
  const selectEdge = useCanvas((s) => s.selectEdge);
  const removeEdge = useCanvas((s) => s.removeEdge);

  // Strokes are screen-constant (`vector-effect: non-scaling-stroke`), but
  // markers render in world space — so arrowheads are sized as 10/zoom world
  // units, which comes out at ~10 screen px at every zoom level.
  const z = zoom > 0 ? zoom : 1;
  const markerSize = 10 / z; // marker viewport in world units
  const markerScale = 0.9 / z; // triangle → 9/z × 9/z world units
  const markerRefX = 9 / z; // …so the tip lands exactly on the path end
  const markerRefY = 4.5 / z; // …centred on the stroke

  // Connection preview: dashed cursor trail + solid path to the hovered box.
  let previewNode: JSX.Element | null = null;
  if (connecting) {
    const source = boxes[connecting.fromId];
    if (source) {
      const from = anchorPoint(source, connecting.fromPort);
      const cursor = { x: connecting.x, y: connecting.y };
      // Never preview an edge back onto the box the drag started from.
      const hoverTarget =
        connecting.hoverId !== null && connecting.hoverId !== connecting.fromId
          ? boxes[connecting.hoverId]
          : undefined;

      previewNode = (
        <g>
          {/* Dashed trail following the cursor */}
          <path
            d={previewPath(from, connecting.fromPort, cursor)}
            fill="none"
            strokeDasharray="6 6"
            strokeOpacity={0.8}
            strokeWidth={1.75}
            strokeLinecap="round"
            markerEnd="url(#canvas-arrow-active)"
            vectorEffect="non-scaling-stroke"
            style={{ stroke: ACCENT, pointerEvents: "none" }}
          />

          {/* Solid preview of the edge that would be created on drop */}
          {hoverTarget && (
            <path
              d={edgePath(source, hoverTarget, connecting.fromPort, undefined)}
              fill="none"
              strokeOpacity={0.9}
              strokeWidth={2}
              strokeLinecap="round"
              markerEnd="url(#canvas-arrow-active)"
              vectorEffect="non-scaling-stroke"
              style={{ stroke: ACCENT, pointerEvents: "none" }}
            />
          )}
        </g>
      );
    }
  }

  return (
    <svg
      width={AREA}
      height={AREA}
      viewBox={`${ORIGIN} ${ORIGIN} ${AREA} ${AREA}`}
      style={{
        position: "absolute",
        left: ORIGIN,
        top: ORIGIN,
        overflow: "visible",
        pointerEvents: "none",
      }}
    >
      <defs>
        {/* Arrowheads: markerUnits="userSpaceOnUse" + 1/zoom sizing keeps them
            ~10 screen px even though strokes are non-scaling. */}
        <marker
          id="canvas-arrow"
          markerUnits="userSpaceOnUse"
          markerWidth={markerSize}
          markerHeight={markerSize}
          refX={markerRefX}
          refY={markerRefY}
          orient="auto"
        >
          <path
            d="M0 0 L10 5 L0 10 z"
            transform={`scale(${markerScale})`}
            style={{ fill: ACCENT, opacity: 0.7 }}
          />
        </marker>
        <marker
          id="canvas-arrow-active"
          markerUnits="userSpaceOnUse"
          markerWidth={markerSize}
          markerHeight={markerSize}
          refX={markerRefX}
          refY={markerRefY}
          orient="auto"
        >
          <path
            d="M0 0 L10 5 L0 10 z"
            transform={`scale(${markerScale})`}
            style={{ fill: ACCENT, opacity: 1 }}
          />
        </marker>
      </defs>

      {/* Quick mount fade — runs once, `opacity` never fights `d` updates. */}
      <motion.g initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.25 }}>
        {Object.values(edges).map((edge) => {
          const from = boxes[edge.from];
          const to = boxes[edge.to];
          if (!from || !to) return null; // dangling reference (box deleted)

          // No port arguments: both ends auto-pick the pair of sides that FACES
          // each other, so the connector re-arranges itself on every render as
          // the boxes move. (`edge.fromPort`/`edge.toPort` stay persisted for
          // backward compatibility but are intentionally not used to render.)
          const d = edgePath(from, to);
          const selected = edge.id === selectedEdgeId;

          return (
            <g key={edge.id}>
              {/* Selected halo, beneath the visible stroke — carries a very
                  subtle accent glow so the chosen connector reads instantly. */}
              {selected && (
                <path
                  d={d}
                  fill="none"
                  strokeOpacity={0.12}
                  strokeWidth={6}
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  vectorEffect="non-scaling-stroke"
                  style={{
                    stroke: ACCENT,
                    pointerEvents: "none",
                    filter: "drop-shadow(0 0 6px rgb(var(--accent-rgb) / 0.35))",
                  }}
                />
              )}

              {/* Visible stroke */}
              <path
                d={d}
                fill="none"
                strokeOpacity={selected ? 1 : 0.6}
                strokeWidth={selected ? 2.4 : 1.75}
                strokeLinecap="round"
                strokeLinejoin="round"
                markerEnd={selected ? "url(#canvas-arrow-active)" : "url(#canvas-arrow)"}
                vectorEffect="non-scaling-stroke"
                style={{ stroke: ACCENT, pointerEvents: "none" }}
              />

              {/* Wide transparent hit stroke — the only interactive part.
                  CRITICAL: disabled entirely while a connection is dragged. */}
              <path
                d={d}
                fill="none"
                stroke="transparent"
                strokeWidth={16}
                data-edge-id={edge.id}
                style={{
                  cursor: "pointer",
                  pointerEvents: connecting ? "none" : "stroke",
                }}
                onPointerDown={(event) => {
                  // Left button only — middle/right fall through to Stage (pan).
                  if (event.button !== 0) return;
                  event.stopPropagation();
                  selectEdge(edge.id);
                }}
                onDoubleClick={(event) => {
                  event.stopPropagation();
                  removeEdge(edge.id);
                }}
              />
            </g>
          );
        })}
      </motion.g>

      {previewNode}
    </svg>
  );
}
