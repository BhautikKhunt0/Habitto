import type { Priority, Task } from "../types";

/**
 * Shared visual language for a habit across the app.
 *
 * The dashboard board and the Tasks page both need to answer "which habit is
 * this, and how important is it?" — the glyph and the priority dot are what make
 * a card recognisable at a glance. Keeping them in one module means a habit looks
 * identical in both places instead of drifting apart.
 */

export const PRIORITY_LABEL: Record<Priority, string> = {
  low: "Low",
  medium: "Medium",
  high: "High",
};

/** Same three signals the Tasks modal uses, so priority reads alike everywhere. */
export const PRIORITY_TONE: Record<Priority, string> = {
  low: "bg-green-500",
  medium: "bg-orange-500",
  high: "bg-red-500",
};

/** Small deterministic hash — gives a habit a stable identity without storing one. */
function hash(seed: string): number {
  let value = 0;
  for (let i = 0; i < seed.length; i += 1) {
    value = (value << 5) - value + seed.charCodeAt(i);
    value |= 0;
  }
  return Math.abs(value);
}

const GLYPHS = ["◈", "◆", "⬡", "✦", "❖", "⬢"];

/** Stable per-task glyph, so a card keeps its mark across reloads and reorders. */
export function taskGlyph(task: Pick<Task, "id" | "category">): string {
  return GLYPHS[hash(`${task.id}${task.category ?? ""}`) % GLYPHS.length];
}