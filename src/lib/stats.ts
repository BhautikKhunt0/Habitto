/**
 * Analytics derivations.
 *
 * Every widget on the Dashboard reads from the same completion history, so the
 * heavy lifting (bucket once, derive many) lives here instead of being
 * re-implemented per component. All helpers are pure and date-local — days are
 * keyed as "yyyy-MM-dd" exactly like the store's completion records, and dates
 * are parsed locally so a streak never shifts across a timezone boundary.
 */
import {
  differenceInCalendarDays,
  eachDayOfInterval,
  format,
  startOfDay,
  startOfYear,
  subDays,
} from "date-fns";
import type { CompletionRecord, Task } from "../types";
import { isTaskScheduledOnDate } from "./utils";

/** "yyyy-MM-dd" — the single day format used by completion records. */
export const dayKey = (date: Date): string => format(date, "yyyy-MM-dd");

/** Parse a day key back into a *local* midnight Date (avoids the UTC shift of `new Date("2026-01-01")`). */
export const dayFromKey = (key: string): Date => new Date(`${key}T00:00:00`);

/** Completed task ids bucketed by day — turns every per-day lookup into a Set hit. */
export type CompletionIndex = Map<string, Set<string>>;

export function indexCompletions(completions: CompletionRecord[]): CompletionIndex {
  const index: CompletionIndex = new Map();
  for (const record of completions) {
    let bucket = index.get(record.date);
    if (!bucket) {
      bucket = new Set();
      index.set(record.date, bucket);
    }
    bucket.add(record.taskId);
  }
  return index;
}

/** Narrow a full index down to one task, so a single filter drives every widget. */
export function scopeIndex(index: CompletionIndex, taskId: string | null): CompletionIndex {
  if (!taskId) return index;
  const scoped: CompletionIndex = new Map();
  for (const [key, ids] of index) {
    if (ids.has(taskId)) scoped.set(key, new Set([taskId]));
  }
  return scoped;
}

export interface DayStat {
  date: Date;
  key: string;
  /** Tasks due that day (0 when nothing was scheduled). */
  scheduled: number;
  completed: number;
  /** 0-100, or 0 when nothing was scheduled — never divide by zero. */
  rate: number;
  /** False for days with no schedule at all; the heatmap leaves those blank. */
  hasSignal: boolean;
}

/** Per-day scheduled/completed counts across an inclusive interval. */
export function buildDayStats(
  tasks: Task[],
  index: CompletionIndex,
  from: Date,
  to: Date,
): DayStat[] {
  const start = startOfDay(from);
  const end = startOfDay(to);
  if (end < start) return [];

  return eachDayOfInterval({ start, end }).map((date) => {
    const key = dayKey(date);
    const done = index.get(key);
    let scheduled = 0;
    let completed = 0;

    for (const task of tasks) {
      if (!isTaskScheduledOnDate(task, date)) continue;
      scheduled += 1;
      if (done?.has(task.id)) completed += 1;
    }

    return {
      date,
      key,
      scheduled,
      completed,
      rate: scheduled > 0 ? Math.round((completed / scheduled) * 100) : 0,
      hasSignal: scheduled > 0,
    };
  });
}

/**
 * Days in a row with at least one completion, counting back from today.
 * An empty *today* doesn't break the streak — the day simply isn't over yet.
 */
export function currentStreak(index: CompletionIndex, today: Date = new Date()): number {
  const isActive = (date: Date) => (index.get(dayKey(date))?.size ?? 0) > 0;

  let cursor = startOfDay(today);
  if (!isActive(cursor)) cursor = subDays(cursor, 1);

  let streak = 0;
  while (isActive(cursor)) {
    streak += 1;
    cursor = subDays(cursor, 1);
  }
  return streak;
}

/** Longest run of consecutive active days in the entire history. */
export function longestStreak(index: CompletionIndex): number {
  const active = [...index.entries()]
    .filter(([, ids]) => ids.size > 0)
    .map(([key]) => dayFromKey(key))
    .sort((a, b) => a.getTime() - b.getTime());

  let best = 0;
  let run = 0;
  let previous: Date | null = null;

  for (const day of active) {
    run = previous && differenceInCalendarDays(day, previous) === 1 ? run + 1 : 1;
    best = Math.max(best, run);
    previous = day;
  }
  return best;
}

export interface RhythmBucket {
  weekday: number; // 0 = Sunday
  label: string; // "Sun"
  /** Mean completion rate across days of this weekday that had a schedule. */
  rate: number;
  completed: number;
  scheduled: number;
  /** How many scheduled occurrences fed the average (confidence signal). */
  samples: number;
}

// Jan 7 2024 is a Sunday, so this walks the full week from Sunday onwards.
const WEEKDAY_REFERENCE = Array.from({ length: 7 }, (_, weekday) => new Date(2024, 0, 7 + weekday));

/** Collapse day stats into one average per day-of-week. */
export function buildRhythm(stats: DayStat[]): RhythmBucket[] {
  const totals = WEEKDAY_REFERENCE.map((date, weekday) => ({
    weekday,
    label: format(date, "EEE"),
    completed: 0,
    scheduled: 0,
    samples: 0,
  }));

  for (const stat of stats) {
    if (!stat.hasSignal) continue;
    const bucket = totals[stat.date.getDay()];
    bucket.completed += stat.completed;
    bucket.scheduled += stat.scheduled;
    bucket.samples += 1;
  }

  return totals.map((bucket) => ({
    ...bucket,
    rate: bucket.scheduled > 0 ? Math.round((bucket.completed / bucket.scheduled) * 100) : 0,
  }));
}
