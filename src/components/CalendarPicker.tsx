import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import {
  addMonths,
  eachDayOfInterval,
  endOfMonth,
  endOfWeek,
  format,
  isSameDay,
  isSameMonth,
  isToday,
  startOfMonth,
  startOfWeek,
  subMonths,
} from "date-fns";
import { AnimatePresence, motion } from "framer-motion";
import { CalendarDays, ChevronLeft, ChevronRight } from "lucide-react";

import { cn } from "../lib/utils";
import { buildDayStats, indexCompletions } from "../lib/stats";
import type { CompletionRecord, Task } from "../types";

const WEEKDAY_HEADERS = ["S", "M", "T", "W", "T", "F", "S"];

const PANEL_WIDTH = 304;
const GUTTER = 16;

/**
 * Calendar dropdown for the habit board.
 *
 * Each day carries a small completion bar, so picking a date is informed rather
 * than blind. Dismissed by outside click or Escape.
 */
export function CalendarPicker({
  tasks,
  completions,
  selectedDate,
  onSelect,
}: {
  tasks: Task[];
  completions: CompletionRecord[];
  selectedDate: Date;
  onSelect: (day: Date) => void;
}) {
  const [open, setOpen] = useState(false);
  const [viewing, setViewing] = useState(() => startOfMonth(selectedDate));
  const rootRef = useRef<HTMLDivElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);

  /*
   * The panel is portalled to <body> on purpose. `.card-surface` sets the
   * standalone `translate` property, which creates a stacking context — an
   * `absolute` dropdown inside the section is then trapped in it and paints
   * under the Analytics cards that follow. Out of the flow entirely, it can't be.
   */
  const [anchor, setAnchor] = useState<{ top: number; left: number } | null>(null);

  useLayoutEffect(() => {
    if (!open) {
      setAnchor(null);
      return;
    }

    const measure = () => {
      const rect = buttonRef.current?.getBoundingClientRect();
      if (!rect) return;
      setAnchor({
        top: rect.bottom + 12,
        left: Math.min(rect.right - PANEL_WIDTH, window.innerWidth - PANEL_WIDTH - GUTTER),
      });
    };

    measure();
    window.addEventListener("resize", measure);
    window.addEventListener("scroll", measure, true);
    return () => {
      window.removeEventListener("resize", measure);
      window.removeEventListener("scroll", measure, true);
    };
  }, [open]);

  // Re-centre on whatever day is selected each time it opens, so it never comes
  // back showing a stale month.
  useEffect(() => {
    if (open) setViewing(startOfMonth(selectedDate));
  }, [open, selectedDate]);

  useEffect(() => {
    if (!open) return;

    function onPointerDown(event: MouseEvent) {
      const target = event.target as Node;
      // The panel is portalled, so it sits outside rootRef — check both.
      if (
        rootRef.current?.contains(target) ||
        panelRef.current?.contains(target)
      ) {
        return;
      }
      setOpen(false);
    }
    function onKey(event: KeyboardEvent) {
      if (event.key === "Escape") setOpen(false);
    }

    document.addEventListener("mousedown", onPointerDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onPointerDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  const completionIndex = useMemo(() => indexCompletions(completions), [completions]);

  const days = useMemo(() => {
    const monthStart = startOfMonth(viewing);
    return eachDayOfInterval({
      start: startOfWeek(monthStart),
      end: endOfWeek(endOfMonth(monthStart)),
    });
  }, [viewing]);

  return (
    <div ref={rootRef} className="relative shrink-0">
      <button
        ref={buttonRef}
        onClick={() => setOpen((value) => !value)}
        aria-expanded={open}
        aria-label="Open calendar"
        title="Jump to a date"
        className={cn(
          "rounded-full p-2 transition-colors duration-200",
          open
            ? "bg-theme-text text-theme-bg"
            : "text-theme-muted hover:bg-theme-bg hover:text-theme-text",
        )}
      >
        <CalendarDays className="h-4 w-4" />
      </button>

      {createPortal(
        <AnimatePresence>
          {open && anchor && (
            <motion.div
              ref={panelRef}
              initial={{ opacity: 0, y: -8, scale: 0.97 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: -8, scale: 0.97 }}
              transition={{ duration: 0.18, ease: [0.22, 1, 0.36, 1] }}
              style={{ top: anchor.top, left: anchor.left, width: PANEL_WIDTH }}
              className="fixed z-[100] origin-top-right rounded-[1.5rem] border border-theme-border bg-theme-surface p-4 shadow-[0_28px_60px_-24px_rgb(0_0_0/0.45)]"
            >
            <div className="mb-3 flex items-center justify-between">
              <button
                onClick={() => setViewing(subMonths(viewing, 1))}
                aria-label="Previous month"
                className="rounded-full p-1.5 text-theme-muted transition-colors hover:bg-theme-bg hover:text-theme-text"
              >
                <ChevronLeft className="h-4 w-4" />
              </button>
              <p className="font-display text-sm font-medium text-theme-text">
                {format(viewing, "MMMM yyyy")}
              </p>
              <button
                onClick={() => setViewing(addMonths(viewing, 1))}
                aria-label="Next month"
                className="rounded-full p-1.5 text-theme-muted transition-colors hover:bg-theme-bg hover:text-theme-text"
              >
                <ChevronRight className="h-4 w-4" />
              </button>
            </div>

            <div className="grid grid-cols-7 gap-1">
              {WEEKDAY_HEADERS.map((label, index) => (
                <div
                  key={`${label}-${index}`}
                  className="pb-1 text-center text-[10px] font-semibold tracking-widest text-theme-muted"
                >
                  {label}
                </div>
              ))}

              {days.map((day) => {
                const stat = buildDayStats(tasks, completionIndex, day, day)[0];
                const selected = isSameDay(day, selectedDate);
                const todayCell = isToday(day);
                const outside = !isSameMonth(day, viewing);
                const rate = stat?.hasSignal ? stat.rate : 0;

                return (
                  <button
                    key={day.toISOString()}
                    onClick={() => {
                      onSelect(day);
                      setOpen(false);
                    }}
                    aria-current={selected ? "date" : undefined}
                    aria-label={format(day, "MMMM d")}
                    className={cn(
                      "group/day relative flex aspect-square items-center justify-center rounded-lg transition-colors duration-150",
                      selected ? "bg-theme-text text-theme-bg" : "hover:bg-theme-bg",
                      outside && !selected && "opacity-30",
                      todayCell && !selected && "ring-1 ring-inset ring-theme-text",
                    )}
                  >
                    <span
                      className={cn(
                        "text-xs font-medium tabular-nums",
                        selected
                          ? "text-theme-bg"
                          : todayCell
                            ? "text-theme-text"
                            : "text-theme-muted group-hover/day:text-theme-text",
                      )}
                    >
                      {format(day, "d")}
                    </span>

                    {stat?.hasSignal && (
                      <span
                        className={cn(
                          "absolute bottom-1 left-1/2 h-[3px] w-2 -translate-x-1/2 overflow-hidden rounded-full",
                          selected ? "bg-theme-bg/25" : "bg-theme-border",
                        )}
                      >
                        <span
                          className={cn(
                            "block h-full rounded-full transition-all duration-500",
                            selected ? "bg-theme-bg" : "bg-theme-accent",
                          )}
                          style={{ width: `${rate}%` }}
                        />
                      </span>
                    )}
                  </button>
                );
              })}
            </div>

            <button
              onClick={() => {
                const now = new Date();
                setViewing(now);
                onSelect(now);
                setOpen(false);
              }}
              className="mt-3 w-full rounded-xl border border-theme-border py-2 text-[11px] font-medium text-theme-muted transition-colors hover:border-theme-text/25 hover:text-theme-text"
            >
              Back to today
            </button>
            </motion.div>
          )}
        </AnimatePresence>,
        document.body,
      )}
    </div>
  );
}