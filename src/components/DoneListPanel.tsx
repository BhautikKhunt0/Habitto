import { useMemo, useRef, useState } from "react";
import { useStore } from "../store/useStore";
import { DoneCategory, DoneEntry } from "../types";
import {
  Plus,
  Search,
  Star,
  Trash2,
  Edit2,
  Flame,
  Check,
  ListChecks,
  Copy,
  ChevronLeft,
  ChevronRight,
  Sparkles,
  CalendarDays,
  Trophy,
  CircleCheck,
} from "lucide-react";
import { format, parseISO, subDays, addDays } from "date-fns";
import { cn } from "../lib/utils";
import { motion, AnimatePresence } from "framer-motion";
import confetti from "canvas-confetti";

// ---------------------------------------------------------------------------
// Categories — a fixed set keeps the color language consistent across the
// composer, list rows and the edit modal.
// ---------------------------------------------------------------------------
const CATEGORIES: {
  id: DoneCategory;
  label: string;
  dot: string;
  text: string;
  bg: string;
}[] = [
  { id: "work", label: "Work", dot: "bg-blue-500", text: "text-blue-500", bg: "bg-blue-500/10" },
  { id: "learning", label: "Learning", dot: "bg-purple-500", text: "text-purple-500", bg: "bg-purple-500/10" },
  { id: "health", label: "Health", dot: "bg-emerald-500", text: "text-emerald-500", bg: "bg-emerald-500/10" },
  { id: "personal", label: "Personal", dot: "bg-pink-500", text: "text-pink-500", bg: "bg-pink-500/10" },
  { id: "creation", label: "Creation", dot: "bg-orange-500", text: "text-orange-500", bg: "bg-orange-500/10" },
  { id: "errands", label: "Errands", dot: "bg-amber-500", text: "text-amber-500", bg: "bg-amber-500/10" },
];
const CAT_BY_ID = new Map(CATEGORIES.map((c) => [c.id, c]));

/** One row in the merged day log: a manual win or a task completed that day. */
type Row =
  | {
      kind: "win";
      id: string;
      ts: string;
      content: string;
      category?: DoneCategory;
      starred: boolean;
      entry: DoneEntry;
    }
  | { kind: "task"; id: string; ts: string; content: string };

const formatTime = (ts: string): string => {
  try {
    return format(parseISO(ts), "h:mm a");
  } catch {
    return "";
  }
};

// ---------------------------------------------------------------------------
// Category chips — shared by the composer and the edit modal. Clicking the
// active chip again clears the category (categories are optional).
// ---------------------------------------------------------------------------
function CategoryChips({
  value,
  onChange,
}: {
  value?: DoneCategory;
  onChange: (c?: DoneCategory) => void;
}) {
  return (
    <div className="flex flex-wrap gap-2">
      {CATEGORIES.map((c) => {
        const active = value === c.id;
        return (
          <button
            key={c.id}
            type="button"
            onClick={() => onChange(active ? undefined : c.id)}
            className={cn(
              "flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-medium transition-all duration-200",
              active
                ? cn("border-transparent shadow-sm", c.bg, c.text)
                : "border-theme-border text-theme-muted hover:border-theme-text/30 hover:text-theme-text"
            )}
          >
            <span className={cn("w-1.5 h-1.5 rounded-full", c.dot)} />
            {c.label}
          </button>
        );
      })}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Edit modal — follows the app's canonical modal pattern (blurred backdrop,
// rounded-[2.5rem] panel, red delete / filled save footer).
// ---------------------------------------------------------------------------
function EditModal({
  entry,
  onClose,
  onSave,
  onDelete,
}: {
  entry: DoneEntry;
  onClose: () => void;
  onSave: (updates: { content: string; category?: DoneCategory }) => void;
  onDelete: () => void;
}) {
  const [content, setContent] = useState(entry.content);
  const [category, setCategory] = useState<DoneCategory | undefined>(entry.category);

  const handleSave = () => {
    if (!content.trim()) return;
    onSave({ content: content.trim(), category });
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="absolute inset-0 bg-black/30 backdrop-blur-md"
        onClick={onClose}
      />
      <motion.div
        initial={{ opacity: 0, scale: 0.95, y: 10 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.95, y: 10 }}
        transition={{ type: "spring", damping: 30, stiffness: 380 }}
        className="relative bg-theme-surface border border-theme-border rounded-[2.5rem] w-full max-w-xl shadow-2xl flex flex-col max-h-[90vh] overflow-hidden"
      >
        <div className="flex items-center justify-between p-6 md:p-8 border-b border-theme-border">
          <div>
            <p className="text-xs font-semibold tracking-widest uppercase text-theme-muted mb-1">Editing win</p>
            <p className="font-display text-lg font-medium text-theme-text">
              {format(parseISO(entry.date), "EEEE, MMMM d, yyyy")}
            </p>
          </div>
          <button
            onClick={onClose}
            className="p-2 -mr-2 text-theme-muted hover:text-theme-text transition-colors rounded-full hover:bg-theme-bg"
          >
            <Plus className="w-5 h-5 rotate-45" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-6 md:p-8 space-y-6">
          <div>
            <label className="block text-xs font-semibold tracking-widest uppercase text-theme-muted mb-3">
              What did you get done?
            </label>
            <textarea
              value={content}
              onChange={(e) => setContent(e.target.value)}
              placeholder="Shipped the landing page copy…"
              className="w-full min-h-[120px] bg-theme-bg border border-theme-border rounded-2xl p-4 text-theme-text focus:outline-none focus:border-theme-text transition-colors resize-none leading-relaxed"
              autoFocus
            />
          </div>
          <div>
            <label className="block text-xs font-semibold tracking-widest uppercase text-theme-muted mb-3">
              Category
            </label>
            <CategoryChips value={category} onChange={setCategory} />
          </div>
        </div>

        <div className="p-6 md:p-8 border-t border-theme-border flex items-center justify-between gap-4">
          <button
            onClick={onDelete}
            className="px-4 py-3 rounded-full text-sm font-medium text-red-500 bg-red-500/10 hover:bg-red-500/20 transition-colors"
          >
            Delete
          </button>
          <button
            onClick={handleSave}
            disabled={!content.trim()}
            className="px-8 py-3 rounded-full bg-theme-text text-theme-bg text-sm font-medium hover:opacity-90 transition-opacity disabled:opacity-50 disabled:cursor-not-allowed"
          >
            Save
          </button>
        </div>
      </motion.div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Done List panel — lives as a tab inside the Tasks page. Renders its own
// content only; the Tasks header/tab bar provide the page chrome.
// ---------------------------------------------------------------------------
export function DoneListPanel() {
  const doneEntries = useStore((s) => s.doneEntries);
  const addDoneEntry = useStore((s) => s.addDoneEntry);
  const updateDoneEntry = useStore((s) => s.updateDoneEntry);
  const deleteDoneEntry = useStore((s) => s.deleteDoneEntry);
  const toggleDoneStar = useStore((s) => s.toggleDoneStar);
  const tasks = useStore((s) => s.tasks);
  const completions = useStore((s) => s.completions);

  const todayStr = format(new Date(), "yyyy-MM-dd");
  const [selectedDate, setSelectedDate] = useState(todayStr);
  const [searchQuery, setSearchQuery] = useState("");
  const [composerText, setComposerText] = useState("");
  const [composerCategory, setComposerCategory] = useState<DoneCategory | undefined>(undefined);
  const [editingEntry, setEditingEntry] = useState<DoneEntry | null>(null);
  const [copied, setCopied] = useState(false);
  const composerRef = useRef<HTMLInputElement>(null);
  const copyTimer = useRef(0);

  const isToday = selectedDate === todayStr;

  const selectDate = (date: string) => {
    setSelectedDate(date);
    setSearchQuery("");
  };

  // ---- derived data --------------------------------------------------------
  const tasksById = useMemo(() => new Map(tasks.map((t) => [t.id, t])), [tasks]);

  const dayEntriesRaw = useMemo(
    () => doneEntries.filter((e) => e.date === selectedDate),
    [doneEntries, selectedDate]
  );

  // Merged log: manual wins + tasks completed that day (missing tasks skipped),
  // newest first.
  const allRows: Row[] = useMemo(() => {
    const wins: Row[] = dayEntriesRaw.map((e) => ({
      kind: "win",
      id: e.id,
      ts: e.createdAt,
      content: e.content,
      category: e.category,
      starred: !!e.starred,
      entry: e,
    }));
    const taskRows: Row[] = completions
      .filter((c) => c.date === selectedDate && tasksById.has(c.taskId))
      .map((c) => ({
        kind: "task",
        id: `${c.taskId}-${c.date}`,
        ts: c.completedAt,
        content: tasksById.get(c.taskId)!.name,
      }));
    return [...wins, ...taskRows].sort((a, b) => (a.ts < b.ts ? 1 : -1));
  }, [dayEntriesRaw, completions, selectedDate, tasksById]);

  const query = searchQuery.trim().toLowerCase();
  const rows = query
    ? allRows.filter((r) => r.content.toLowerCase().includes(query))
    : allRows;

  const highlight = dayEntriesRaw.find((e) => e.starred);

  // Every day that has at least one logged item → streak + calendar dots.
  const winDates = useMemo(() => {
    const s = new Set(doneEntries.map((e) => e.date));
    completions.forEach((c) => s.add(c.date));
    return s;
  }, [doneEntries, completions]);

  const currentStreak = useMemo(() => {
    let d = new Date();
    if (!winDates.has(format(d, "yyyy-MM-dd"))) d = subDays(d, 1); // grace: today not logged yet
    let streak = 0;
    while (winDates.has(format(d, "yyyy-MM-dd"))) {
      streak += 1;
      d = subDays(d, 1);
    }
    return streak;
  }, [winDates]);

  const weekCount = useMemo(() => {
    const start = format(subDays(new Date(), 6), "yyyy-MM-dd");
    const wins = doneEntries.filter((e) => e.date >= start).length;
    const done = completions.filter((c) => c.date >= start).length;
    return wins + done;
  }, [doneEntries, completions]);

  const totalCount = doneEntries.length + completions.length;

  // ---- actions -------------------------------------------------------------
  const handleAdd = () => {
    const content = composerText.trim();
    if (!content) return;
    const firstWinToday = isToday && dayEntriesRaw.length === 0;
    addDoneEntry({ date: selectedDate, content, category: composerCategory });
    setComposerText("");
    if (firstWinToday) {
      confetti({
        particleCount: 70,
        spread: 60,
        origin: { y: 0.7 },
        colors: ["#000000", "#ffffff", "#888888"],
      });
    }
    composerRef.current?.focus();
  };

  const shiftDate = (delta: number) => {
    selectDate(format(addDays(parseISO(selectedDate), delta), "yyyy-MM-dd"));
  };

  const handleCopy = () => {
    const lines: string[] = [`Done — ${format(parseISO(selectedDate), "EEEE, MMMM d, yyyy")}`];
    if (highlight) lines.push(`★ ${highlight.content}`);
    allRows.forEach((r) => {
      const cat = r.kind === "win" && r.category ? ` (${CAT_BY_ID.get(r.category)?.label ?? ""})` : "";
      lines.push(`${r.kind === "task" ? "✓" : "•"} ${r.content}${cat}`);
    });
    navigator.clipboard
      ?.writeText(lines.join("\n"))
      .then(() => {
        setCopied(true);
        window.clearTimeout(copyTimer.current);
        copyTimer.current = window.setTimeout(() => setCopied(false), 2000);
      })
      .catch(() => {});
  };

  // ---- calendar strip (last 14 days, ending today) -------------------------
  const stripDays = useMemo(
    () => Array.from({ length: 14 }, (_, i) => subDays(new Date(), 13 - i)),
    []
  );
  const countForDate = (dateStr: string): number => {
    const w = doneEntries.filter((e) => e.date === dateStr).length;
    const t = completions.filter((c) => c.date === dateStr).length;
    return w + t;
  };

  const kpis = [
    { icon: Check, label: isToday ? "Done today" : "Done that day", value: allRows.length },
    { icon: Flame, label: "Streak", value: currentStreak, unit: currentStreak === 1 ? "day" : "days" },
    { icon: CalendarDays, label: "This week", value: weekCount },
    { icon: Trophy, label: "All time", value: totalCount },
  ];

  return (
    <div className="w-full">
      {/* ---- KPI strip ---- */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-6 md:gap-12 py-7 border-y border-theme-border/50 mb-8">
        {kpis.map(({ icon: Icon, label, value, unit }) => (
          <div key={label} className="flex flex-col gap-1.5">
            <div className="flex items-center gap-2 text-theme-muted">
              <Icon className="w-3.5 h-3.5" />
              <span className="text-xs font-semibold tracking-widest uppercase">{label}</span>
            </div>
            <div className="flex items-baseline gap-1.5">
              <span className="text-4xl md:text-5xl font-display font-light text-theme-text tabular-nums">
                {value}
              </span>
              {unit && <span className="text-sm text-theme-muted">{unit}</span>}
            </div>
          </div>
        ))}
      </div>

      {/* ---- Day navigator + calendar strip ---- */}
      <div className="rounded-[2rem] border border-theme-border bg-theme-surface p-4 md:p-5 mb-6">
        <div className="flex items-center justify-between gap-3 mb-3 px-1">
          <div className="flex items-center gap-2">
            <button
              onClick={() => shiftDate(-1)}
              className="w-8 h-8 rounded-full border border-theme-border flex items-center justify-center text-theme-muted hover:text-theme-text hover:border-theme-text transition-colors"
              aria-label="Previous day"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
            <h3 className="font-display text-base font-medium text-theme-text min-w-[10.5rem] text-center">
              {isToday ? "Today" : format(parseISO(selectedDate), "EEEE, MMM d")}
            </h3>
            <button
              onClick={() => shiftDate(1)}
              disabled={selectedDate >= todayStr}
              className="w-8 h-8 rounded-full border border-theme-border flex items-center justify-center text-theme-muted hover:text-theme-text hover:border-theme-text transition-colors disabled:opacity-30 disabled:cursor-not-allowed disabled:hover:border-theme-border disabled:hover:text-theme-muted"
              aria-label="Next day"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
          <div className="flex items-center gap-2">
            {!isToday && (
              <button
                onClick={() => selectDate(todayStr)}
                className="px-3.5 py-1.5 rounded-full border border-theme-border text-xs font-medium text-theme-text hover:border-theme-text transition-colors"
              >
                Today
              </button>
            )}
            <button
              onClick={handleCopy}
              className="w-8 h-8 rounded-full border border-theme-border flex items-center justify-center text-theme-muted hover:text-theme-text hover:border-theme-text transition-colors"
              aria-label="Copy day as text"
              title="Copy this day as text"
            >
              {copied ? <Check className="w-4 h-4 text-theme-accent" /> : <Copy className="w-4 h-4" />}
            </button>
          </div>
        </div>

        <div className="flex gap-2 overflow-x-auto pb-1">
          {stripDays.map((d) => {
            const dateStr = format(d, "yyyy-MM-dd");
            const selected = dateStr === selectedDate;
            const isCurrent = dateStr === todayStr;
            const count = countForDate(dateStr);
            return (
              <button
                key={dateStr}
                onClick={() => selectDate(dateStr)}
                className={cn(
                  "relative flex flex-col items-center gap-1 rounded-2xl border w-[3.4rem] shrink-0 py-2.5 transition-all duration-200",
                  selected
                    ? "bg-theme-text border-theme-text"
                    : "border-theme-border hover:border-theme-text/30",
                  isCurrent && !selected && "ring-1 ring-theme-text/40 ring-inset"
                )}
              >
                <span
                  className={cn(
                    "text-[10px] font-semibold uppercase tracking-wider",
                    selected ? "text-theme-bg/70" : "text-theme-muted"
                  )}
                >
                  {format(d, "EEEEE")}
                </span>
                <span
                  className={cn(
                    "text-sm font-display font-medium",
                    selected ? "text-theme-bg" : "text-theme-text"
                  )}
                >
                  {format(d, "d")}
                </span>
                <span className="flex gap-0.5 h-1 items-center">
                  {Array.from({ length: Math.min(count, 4) }).map((_, i) => (
                    <span key={i} className="w-1 h-1 rounded-full bg-theme-accent" />
                  ))}
                </span>
              </button>
            );
          })}
        </div>
      </div>

      {/* ---- Composer ---- */}
      <div className="rounded-[2rem] border border-theme-border bg-theme-surface p-5 md:p-7 mb-8 transition-all duration-300 focus-within:border-theme-accent/50 focus-within:shadow-[0_18px_50px_rgb(var(--accent-rgb)/0.10)]">
        <p className="text-xs font-semibold tracking-widest uppercase text-theme-muted mb-4">
          Log a win{!isToday && ` · ${format(parseISO(selectedDate), "MMM d")}`}
        </p>
        <div className="flex items-center gap-3">
          <input
            ref={composerRef}
            type="text"
            value={composerText}
            onChange={(e) => setComposerText(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") handleAdd();
            }}
            placeholder={isToday ? "What did you get done today?" : "What did you get done that day?"}
            className="flex-1 min-w-0 bg-transparent text-base md:text-lg text-theme-text placeholder:text-theme-muted/50 focus:outline-none py-1.5"
          />
          <button
            onClick={handleAdd}
            disabled={!composerText.trim()}
            className="flex items-center gap-2 rounded-full bg-theme-text text-theme-bg px-5 py-2.5 text-sm font-medium hover:opacity-90 transition-all disabled:opacity-30 disabled:cursor-not-allowed shrink-0"
          >
            <Plus className="w-4 h-4" />
            Add
          </button>
        </div>
        <div className="mt-4 pt-4 border-t border-theme-border/60">
          <CategoryChips value={composerCategory} onChange={setComposerCategory} />
        </div>
      </div>

      {/* ---- Highlight of the day ---- */}
      <AnimatePresence>
        {highlight && (
          <motion.div
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            className="rounded-[2rem] border border-theme-accent/40 bg-theme-accent/5 p-6 md:p-7 mb-6 relative overflow-hidden group"
          >
            <div className="flex items-center gap-2 text-theme-accent mb-3">
              <Sparkles className="w-4 h-4" />
              <span className="text-xs font-semibold uppercase tracking-widest">Highlight of the day</span>
            </div>
            <p className="text-lg md:text-xl font-display font-medium text-theme-text leading-snug pr-16">
              {highlight.content}
            </p>
            <div className="flex items-center gap-3 mt-3 text-xs text-theme-muted">
              <span>{formatTime(highlight.createdAt)}</span>
              {highlight.category && (
                <span className={cn("font-medium", CAT_BY_ID.get(highlight.category)?.text)}>
                  {CAT_BY_ID.get(highlight.category)?.label}
                </span>
              )}
            </div>
            <div className="absolute top-5 right-5 flex items-center gap-1">
              <button
                onClick={() => toggleDoneStar(highlight.id)}
                className="p-2 rounded-full text-theme-accent hover:bg-theme-accent/10 transition-colors"
                aria-label="Remove highlight"
              >
                <Star className="w-4 h-4 fill-current" />
              </button>
              <button
                onClick={() => setEditingEntry(highlight)}
                className="p-2 rounded-full text-theme-muted hover:text-theme-text hover:bg-theme-bg transition-colors opacity-0 group-hover:opacity-100"
                aria-label="Edit highlight"
              >
                <Edit2 className="w-4 h-4" />
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ---- Merged log ---- */}
      <div className="flex items-center justify-between gap-3 mb-3 px-1">
        <span className="text-xs font-semibold tracking-widest uppercase text-theme-muted">Activity</span>
        <div className="flex items-center gap-3">
          {allRows.length > 0 && (
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-theme-muted" />
              <input
                type="text"
                placeholder="Search..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-36 md:w-44 bg-theme-bg border border-theme-border rounded-full pl-9 pr-3 py-1.5 text-xs text-theme-text focus:outline-none focus:border-theme-text transition-colors placeholder:text-theme-muted/50"
              />
            </div>
          )}
          <span className="text-xs text-theme-muted tabular-nums">
            {query ? `${rows.length} of ${allRows.length}` : `${allRows.length} logged`}
          </span>
        </div>
      </div>

      {allRows.length === 0 ? (
        <div className="text-center py-16 border border-dashed border-theme-border rounded-[2rem]">
          <div className="w-14 h-14 rounded-full bg-theme-accent/10 flex items-center justify-center mx-auto mb-5">
            <ListChecks className="w-6 h-6 text-theme-accent" />
          </div>
          <p className="font-display text-lg font-medium text-theme-text mb-1">Nothing logged yet</p>
          <p className="text-sm text-theme-muted mb-6 max-w-sm mx-auto">
            Every line here is proof you showed up. Log your first win for{" "}
            {isToday ? "today" : format(parseISO(selectedDate), "MMM d")} — or complete a task and
            it lands here automatically.
          </p>
          <button
            onClick={() => composerRef.current?.focus()}
            className="px-6 py-2.5 rounded-full border border-theme-border hover:border-theme-text text-theme-text text-sm font-medium transition-colors"
          >
            Log your first win
          </button>
        </div>
      ) : rows.length === 0 ? (
        <div className="text-center py-16 border border-dashed border-theme-border rounded-[2rem]">
          <p className="text-theme-muted text-sm uppercase tracking-widest font-medium mb-4">No matches found</p>
          <button
            onClick={() => setSearchQuery("")}
            className="px-6 py-2.5 rounded-full border border-theme-border hover:border-theme-text text-theme-text text-sm font-medium transition-colors"
          >
            Clear search
          </button>
        </div>
      ) : (
        <ul className="space-y-1.5">
          <AnimatePresence initial={false}>
            {rows.map((row) =>
              row.kind === "win" ? (
                <motion.li
                  key={row.id}
                  layout
                  initial={{ opacity: 0, y: -6, scale: 0.98 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.96 }}
                  transition={{ type: "spring", damping: 30, stiffness: 420 }}
                  className="group flex items-center gap-4 rounded-2xl border border-transparent px-4 py-3 hover:bg-theme-surface hover:border-theme-border transition-colors"
                >
                  <div
                    className={cn(
                      "w-9 h-9 rounded-full flex items-center justify-center shrink-0",
                      row.category ? CAT_BY_ID.get(row.category)?.bg : "bg-theme-accent/10"
                    )}
                  >
                    {row.category ? (
                      <span className={cn("w-2.5 h-2.5 rounded-full", CAT_BY_ID.get(row.category)?.dot)} />
                    ) : (
                      <Check className="w-4 h-4 text-theme-accent" />
                    )}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm md:text-base font-medium text-theme-text leading-snug break-words">
                      {row.content}
                    </p>
                    <div className="flex items-center gap-2 mt-0.5 text-xs text-theme-muted">
                      <span className="tabular-nums">{formatTime(row.ts)}</span>
                      {row.category && (
                        <>
                          <span className="opacity-40">·</span>
                          <span className={cn("font-medium", CAT_BY_ID.get(row.category)?.text)}>
                            {CAT_BY_ID.get(row.category)?.label}
                          </span>
                        </>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center gap-0.5 shrink-0">
                    <button
                      onClick={() => toggleDoneStar(row.id)}
                      className={cn(
                        "p-2 rounded-full transition-all",
                        row.starred
                          ? "text-theme-accent"
                          : "text-theme-muted/40 hover:text-theme-accent opacity-0 group-hover:opacity-100 focus:opacity-100"
                      )}
                      aria-label={row.starred ? "Remove highlight" : "Mark as highlight"}
                    >
                      <Star className={cn("w-4 h-4", row.starred && "fill-current")} />
                    </button>
                    <button
                      onClick={() => setEditingEntry(row.entry)}
                      className="p-2 rounded-full text-theme-muted hover:text-theme-text opacity-0 group-hover:opacity-100 focus:opacity-100 transition-opacity"
                      aria-label="Edit"
                    >
                      <Edit2 className="w-4 h-4" />
                    </button>
                    <button
                      onClick={() => deleteDoneEntry(row.id)}
                      className="p-2 rounded-full text-theme-muted hover:text-red-500 opacity-0 group-hover:opacity-100 focus:opacity-100 transition-opacity"
                      aria-label="Delete"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </motion.li>
              ) : (
                <motion.li
                  key={row.id}
                  layout
                  initial={{ opacity: 0, y: -6, scale: 0.98 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.96 }}
                  transition={{ type: "spring", damping: 30, stiffness: 420 }}
                  className="group flex items-center gap-4 rounded-2xl border border-transparent px-4 py-3 hover:bg-theme-surface hover:border-theme-border transition-colors"
                >
                  <div className="w-9 h-9 rounded-full bg-theme-accent/10 flex items-center justify-center shrink-0">
                    <CircleCheck className="w-4 h-4 text-theme-accent" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm md:text-base text-theme-text/80 leading-snug break-words">
                      {row.content}
                    </p>
                    <div className="flex items-center gap-2 mt-0.5 text-xs text-theme-muted">
                      <span className="tabular-nums">{formatTime(row.ts)}</span>
                    </div>
                  </div>
                  <span className="text-[10px] uppercase tracking-wider font-semibold text-theme-muted border border-theme-border rounded-full px-2.5 py-1 shrink-0">
                    Task
                  </span>
                </motion.li>
              )
            )}
          </AnimatePresence>
        </ul>
      )}

      {/* ---- Edit modal ---- */}
      <AnimatePresence>
        {editingEntry && (
          <EditModal
            entry={editingEntry}
            onClose={() => setEditingEntry(null)}
            onSave={(updates) => {
              updateDoneEntry(editingEntry.id, updates);
              setEditingEntry(null);
            }}
            onDelete={() => {
              deleteDoneEntry(editingEntry.id);
              setEditingEntry(null);
            }}
          />
        )}
      </AnimatePresence>
    </div>
  );
}
