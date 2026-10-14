import { useCallback, useMemo, useRef, useState } from "react";
import { format, isToday } from "date-fns";
import {
  DndContext,
  KeyboardSensor,
  PointerSensor,
  closestCenter,
  useSensor,
  useSensors,
  type DragEndEvent,
  type DragStartEvent,
  type Modifier,
} from "@dnd-kit/core";
import {
  SortableContext,
  arrayMove,
  rectSortingStrategy,
  sortableKeyboardCoordinates,
  useSortable,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { AnimatePresence, motion } from "framer-motion";
import { Check, LayoutGrid, Play } from "lucide-react";
import { useNavigate } from "react-router-dom";
import confetti from "canvas-confetti";

import { useStore } from "../store/useStore";
import { cn, isTaskScheduledOnDate } from "../lib/utils";
import { dayKey } from "../lib/stats";
import { OverlaySignal } from "../lib/overlay";
import { CalendarPicker } from "./CalendarPicker";
import { PRIORITY_LABEL, PRIORITY_TONE, taskGlyph } from "../lib/taskMeta";
import type { Priority, Task } from "../types";

/* Every card is identical, so the board is a plain responsive grid: columns are
   whatever the width allows and a drag simply reorders. That's all the reference
   layout ever needed, and it removes a lot of machinery for free placement. */
const MIN_CARD_PX = 210;
const GAP = 14;

const clamp = (value: number, low: number, high: number) =>
  Math.min(Math.max(value, low), high);

/** Confetti in the live accent colour, falling back to the neutral palette. */
function celebrate() {
  const triplet = getComputedStyle(document.documentElement)
    .getPropertyValue("--accent-rgb")
    .trim();
  const [r, g, b] = triplet.split(/\s+/).map(Number);
  const themed = Number.isFinite(r) && Number.isFinite(g) && Number.isFinite(b);

  confetti({
    particleCount: 120,
    spread: 80,
    origin: { y: 0.6 },
    colors: themed
      ? [`rgb(${r},${g},${b})`, `rgb(${r},${g},${b})`, "#ffffff", "#111110"]
      : ["#000000", "#ffffff", "#888888"],
  });
}

export function TaskBoard({ date, onDateChange }: { date: Date; onDateChange: (day: Date) => void }) {
  const tasks = useStore((state) => state.tasks);
  const completions = useStore((state) => state.completions);
  const toggleCompletion = useStore((state) => state.toggleCompletion);
  const reorderTasks = useStore((state) => state.reorderTasks);

  const [activeId, setActiveId] = useState<string | null>(null);

  const active = useMemo(() => tasks.filter((t) => !t.archived), [tasks]);

  const dateKey = dayKey(date);
  const selected = isToday(date);

  const boardTasks = useMemo(
    () => active.filter((task) => isTaskScheduledOnDate(task, date)),
    [active, date],
  );

  // `order` is the user's arrangement; anything predating the field falls back
  // to creation order so the list is at least stable.
  const ordered = useMemo(
    () =>
      [...boardTasks].sort((a, b) => {
        const ao = a.order ?? Number.MAX_SAFE_INTEGER;
        const bo = b.order ?? Number.MAX_SAFE_INTEGER;
        if (ao !== bo) return ao - bo;
        return a.createdAt.localeCompare(b.createdAt);
      }),
    [boardTasks],
  );

  const isDone = (taskId: string) =>
    completions.some((c) => c.taskId === taskId && c.date === dateKey);

  /** Toggle a habit for the selected day; celebrate finishing the last one. */
  const handleToggle = (taskId: string) => {
    const wasDone = isDone(taskId);
    toggleCompletion(taskId, dateKey);

    // Un-ticking never celebrates.
    if (wasDone) return;

    const doneAfter = new Set(
      completions.filter((c) => c.date === dateKey).map((c) => c.taskId),
    );
    doneAfter.add(taskId);

    if (boardTasks.length > 0 && boardTasks.every((task) => doneAfter.has(task.id))) celebrate();
  };

  const doneToday = ordered.filter((task) => isDone(task.id)).length;
  const progress = ordered.length > 0 ? doneToday / ordered.length : 0;

  const sensors = useSensors(
    // A few pixels of travel before a press becomes a drag, so ticking the
    // checkbox never picks the card up instead.
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  function handleDragStart(event: DragStartEvent) {
    setActiveId(String(event.active.id));
  }

  function handleDragEnd(event: DragEndEvent) {
    setActiveId(null);
    const { active: from, over } = event;
    if (!over || from.id === over.id) return;

    const ids = ordered.map((t) => t.id);
    const fromIndex = ids.indexOf(String(from.id));
    const toIndex = ids.indexOf(String(over.id));
    if (fromIndex < 0 || toIndex < 0) return;

    reorderTasks(arrayMove(ids, fromIndex, toIndex));
  }

  

  /* dnd-kit lets the overlay travel across the whole viewport by default, which
     reads as the card escaping the panel. Clamping the transform to the board's
     own box keeps the card inside it — collision detection then runs against the
     clamped position, so reordering is confined the same way. */
  const boardRef = useRef<HTMLDivElement>(null);

  const confineToBoard = useCallback<Modifier>(
    ({ transform, activeNodeRect }) => {
      const board = boardRef.current;
      if (!board || !activeNodeRect) return transform;

      const bounds = board.getBoundingClientRect();
      return {
        ...transform,
        x: clamp(transform.x, bounds.left - activeNodeRect.left, bounds.right - activeNodeRect.right),
        y: clamp(transform.y, bounds.top - activeNodeRect.top, bounds.bottom - activeNodeRect.bottom),
      };
    },
    [],
  );

  return (
    <section className="card-surface rounded-[2rem] border border-theme-border bg-theme-surface p-6 md:p-7">
      {/* A dragged card owns the bottom of the screen while it's in the air, so
          the dock steps aside rather than sitting under the drop position. */}
      <OverlaySignal active={activeId !== null} />

      {/* header */}
      <div className="mb-5 flex flex-wrap items-start justify-between gap-5">
        <div className="min-w-0">
          <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-theme-muted">
            {selected ? "Today&rsquo;s habits" : format(date, "EEEE")}
          </p>
          <h3 className="mt-2 truncate font-display text-xl font-medium tracking-tight text-theme-text">
            {format(date, "MMMM d, yyyy")}
          </h3>
        </div>

        <div className="flex items-center gap-2">
          <CalendarPicker
            tasks={active}
            completions={completions}
            selectedDate={date}
            onSelect={onDateChange}
          />

          <div className="flex items-center gap-3 rounded-full border border-theme-border/70 bg-theme-bg/40 py-1.5 pl-2 pr-4">
            <ProgressRing value={progress} />
            <p className="text-sm font-medium tabular-nums text-theme-text">
              {doneToday}
              <span className="text-theme-muted"> / {ordered.length}</span>
            </p>
          </div>
        </div>
      </div>

      {ordered.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-theme-border px-6 py-16 text-center">
          <LayoutGrid className="mx-auto h-6 w-6 text-theme-muted" strokeWidth={1.5} />
          <p className="mt-4 font-display text-lg font-medium text-theme-text">
            Nothing scheduled
          </p>
          <p className="mt-2 text-sm text-theme-muted">
            {selected
              ? "Add a habit on the Tasks page and it will appear here."
              : "Pick another day with the calendar, or add a habit to fill this one up."}
          </p>
        </div>
      ) : (
        <DndContext
          sensors={sensors}
          collisionDetection={closestCenter}
          modifiers={[confineToBoard]}
          onDragStart={handleDragStart}
          onDragEnd={handleDragEnd}
          onDragCancel={() => setActiveId(null)}
        >
          <SortableContext items={ordered.map((t) => t.id)} strategy={rectSortingStrategy}>
            <div
              ref={boardRef}
              className="grid"
              style={{
                gridTemplateColumns: `repeat(auto-fill, minmax(min(${MIN_CARD_PX}px, 100%), 1fr))`,
                gap: GAP,
              }}
            >
              {ordered.map((task) => (
                <SortableCard
                  key={task.id}
                  task={task}
                  done={isDone(task.id)}
                  dateStr={dateKey}
                  onToggle={() => handleToggle(task.id)}
                />
              ))}
            </div>
          </SortableContext>
        </DndContext>
      )}
    </section>
  );
}

/* --------------------------------------------------------------------- card */

function SortableCard({
  task,
  done,
  dateStr,
  onToggle,
}: {
  task: Task;
  done: boolean;
  dateStr: string;
  onToggle: () => void;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: task.id,
  });

  return (
    <div
      ref={setNodeRef}
      style={{
        transform: CSS.Translate.toString(transform),
        transition,
      }}
      className={cn(
        "board-card group relative select-none",
        // Lifted rather than faded — there is no overlay clone to carry the
        // affordance any more, this card is the one following the cursor.
        isDragging && "z-10",
      )}
      {...attributes}
      {...listeners}
    >
      <CardBody task={task} done={done} dateStr={dateStr} onToggle={onToggle} lifted={isDragging} />
    </div>
  );
}

/* ---------------------------------------------------------------- card face */

function CardBody({
  task,
  done,
  dateStr,
  onToggle,
  lifted,
}: {
  task: Task;
  done: boolean;
  dateStr: string;
  /** Absent in the drag overlay copy, where clicks are inert anyway. */
  onToggle?: () => void;
  lifted?: boolean;
}) {
  const navigate = useNavigate();
  const priority: Priority = task.priority ?? "medium";
  // A free-text metric still wins the badge if one was set — otherwise the card
  // shows its priority, which is the other thing worth knowing at a glance.
  const metric = task.metric?.trim();

  return (
    <div
      className={cn(
        "relative flex h-[58px] items-center gap-3 overflow-hidden rounded-[1.5rem] border px-3.5 transition-[border-color,background-color,box-shadow] duration-300",
        done
          ? "border-theme-accent/40 bg-theme-accent/[0.16]"
          : "border-white/10 bg-theme-surface hover:border-theme-text/20 hover:shadow-[0_14px_30px_-22px_rgb(0_0_0/0.5)]",
        lifted &&
          "scale-[1.02] border-theme-accent/50 shadow-[0_26px_48px_-22px_rgb(0_0_0/0.6)]",
      )}
    >
      {/* a whisper of accent so an unfinished card isn't dead flat */}
      {!done && (
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0 bg-gradient-to-r from-theme-accent/[0.08] via-transparent to-transparent"
        />
      )}

      <CheckBox checked={done} name={task.name} onToggle={onToggle} />

      <span className="relative flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-theme-text/[0.08] text-sm leading-none text-theme-text/80 ring-1 ring-inset ring-white/10">
        {taskGlyph(task)}
      </span>

      <h4
        className={cn(
          "relative min-w-0 flex-1 truncate font-display text-sm font-medium text-theme-text transition-opacity duration-300",
          done && "opacity-70",
        )}
      >
        {task.name}
      </h4>

      {/* The badge turns into a timer shortcut on hover — it swaps in the same
          slot, so the card never changes width and the eye has one place to look. */}
      <span className="relative flex shrink-0 items-center">
        <span
          className={cn(
            "flex items-center gap-1.5 rounded-full bg-theme-text/[0.08] px-2.5 py-1 text-[11px] font-medium text-theme-text/80 ring-1 ring-inset ring-theme-border/50 transition-opacity duration-200",
            onToggle && "group-hover:opacity-0",
          )}
        >
          {!metric && (
            <span className={cn("h-1.5 w-1.5 shrink-0 rounded-full", PRIORITY_TONE[priority])} />
          )}
          {metric ?? PRIORITY_LABEL[priority]}
        </span>

        {onToggle && (
          <button
            onPointerDown={(event) => event.stopPropagation()}
            onClick={() => navigate("/focus", { state: { taskId: task.id, date: dateStr } })}
            aria-label={`Start a focus timer for ${task.name}`}
            title="Focus on this habit"
            className={cn(
              "absolute inset-0 flex items-center justify-center rounded-full bg-theme-text text-theme-bg",
              "opacity-0 transition-opacity duration-200 hover:bg-theme-accent focus-visible:opacity-100 group-hover:opacity-100",
            )}
          >
            <Play className="h-3 w-3 fill-current" />
          </button>
        )}
      </span>
    </div>
  );
}

/** Square checkbox — the whole card is the drag surface, so this opts out. */
function CheckBox({
  checked,
  name,
  onToggle,
}: {
  checked: boolean;
  name: string;
  onToggle: () => void;
}) {
  return (
    <button
      type="button"
      role="checkbox"
      aria-checked={checked}
      aria-label={checked ? `Mark ${name} incomplete` : `Complete ${name}`}
      onPointerDown={(event) => event.stopPropagation()}
      onClick={onToggle}
      className={cn(
        "relative flex h-5 w-5 shrink-0 items-center justify-center rounded-[7px] border transition-colors duration-200",
        checked
          ? "border-theme-accent bg-theme-accent text-theme-bg"
          : "border-theme-text/25 hover:border-theme-text/60",
      )}
    >
      <AnimatePresence initial={false}>
        {checked && (
          <motion.span
            key="tick"
            initial={{ scale: 0.4, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0.4, opacity: 0 }}
            transition={{ type: "spring", stiffness: 560, damping: 30 }}
          >
            <Check className="h-3 w-3" strokeWidth={3.5} />
          </motion.span>
        )}
      </AnimatePresence>
    </button>
  );
}

/* ------------------------------------------------------------------- extras */

function ProgressRing({ value }: { value: number }) {
  const R = 16;
  const CIRC = 2 * Math.PI * R;

  return (
    <svg viewBox="0 0 40 40" className="h-11 w-11 shrink-0 -rotate-90" aria-hidden>
      <circle cx="20" cy="20" r={R} fill="none" stroke="currentColor" strokeWidth="3.5" className="text-theme-text/10" />
      <motion.circle
        cx="20"
        cy="20"
        r={R}
        fill="none"
        stroke="currentColor"
        strokeWidth="3.5"
        strokeLinecap="round"
        className="text-theme-accent"
        strokeDasharray={CIRC}
        initial={false}
        animate={{ strokeDashoffset: CIRC * (1 - value) }}
        transition={{ type: "spring", stiffness: 110, damping: 22 }}
      />
    </svg>
  );
}

/** Stable per-task glyph so a card keeps its identity across reloads. */