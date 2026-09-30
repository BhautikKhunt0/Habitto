// Shared contracts for the Habitto Canvas feature.
// Every canvas file imports its types from here — do not redefine them elsewhere.

export type ID = string;

export type Port = "top" | "right" | "bottom" | "left";

export type Tool = "select" | "box" | "pan";

export interface Box {
  id: ID;
  x: number;
  y: number;
  w: number;
  h: number;
  text: string;
}

/** A naked text node living directly on the canvas (no box). */
export interface TextNode {
  id: ID;
  x: number;
  y: number;
  /** wrap width in world units */
  w: number;
  /** measured content height (kept in sync by the node itself) */
  h: number;
  text: string;
  /** box this text is attached to (follows the box when it moves) */
  attachTo?: ID;
  /** which side of the box it sits on */
  attachSide?: "top" | "bottom";
  /** horizontal offset relative to the box's left edge */
  attachOffsetX?: number;
}

/** Live drop-target feedback while a text node is being dragged over a box. */
export interface AttachPreview {
  textId: ID;
  boxId: ID;
  side: "top" | "bottom";
}

export interface Edge {
  id: ID;
  from: ID;
  to: ID;
  fromPort?: Port;
  toPort?: Port;
}

export interface Viewport {
  /** pan offset in screen px */
  x: number;
  y: number;
  /** scale factor */
  zoom: number;
}

/** Alignment guide lines shown while dragging/snapping (world coordinates). */
export interface Guide {
  axis: "x" | "y";
  pos: number;
}

/** State while the user is dragging a connection out of a box port. */
export interface ConnectingState {
  fromId: ID;
  fromPort: Port;
  /** current pointer position in WORLD coordinates */
  x: number;
  y: number;
  /** box currently hovered as the connection target (or null) */
  hoverId: ID | null;
}

/** Persisted document shape (localStorage). */
export interface CanvasDoc {
  boxes: Record<ID, Box>;
  edges: Record<ID, Edge>;
  order: ID[];
  viewport: Viewport;
  /** optional for backward compatibility with v1 saved docs */
  texts?: Record<ID, TextNode>;
  textOrder?: ID[];
}

export const MIN_BOX_W = 160;
export const MIN_BOX_H = 72;
export const DEFAULT_BOX_W = 240;
export const DEFAULT_BOX_H = 104;

export const DEFAULT_TEXT_W = 260;
export const DEFAULT_TEXT_H = 28;
export const MIN_TEXT_W = 60;
export const MIN_TEXT_H = 18;
/** vertical gap between an attached text node and its box */
export const ATTACH_GAP = 16;

export const MIN_ZOOM = 0.2;
export const MAX_ZOOM = 3;

export const CANVAS_STORAGE_KEY = "habitto-canvas-v1";
