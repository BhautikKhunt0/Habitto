import { useCallback, useEffect, useRef, useState } from "react";
import { useStore } from "../store/useStore";
import { Priority, Task, Frequency } from "../types";
import {
  CalendarDays,
  CalendarRange,
  Check,
  Edit2,
  Minus,
  Plus,
  Repeat,
  Search,
  SlidersHorizontal,
  Sun,
  Tag,
  Trash2,
  X,
} from "lucide-react";
import { formatFrequency, cn } from "../lib/utils";
import { PRIORITY_LABEL, PRIORITY_TONE, taskGlyph } from "../lib/taskMeta";
import { useRegisterOverlay } from "../lib/overlay";
import { motion, AnimatePresence } from "framer-motion";
import { TemporaryTasks } from "../components/TemporaryTasks";

/**
 * Tab, styled as a pill rather than an underline.
 *
 * The active pill is a shared `layoutId`, so the selection glides between tabs
 * instead of blinking. It is one button end to end — padding is symmetric so the
 * label sits optically centred, and the whole pill is the hit target.
 */
function TabPill({
  label,
  active,
  onClick,
  count,
}: {
  label: string;
  active: boolean;
  onClick: () => void;
  count?: number;
}) {
  return (
    <button
      onClick={onClick}
      aria-current={active ? "page" : undefined}
      className={cn(
        "relative flex shrink-0 items-center gap-2 rounded-full border border-transparent px-4 py-2 text-sm font-medium transition-colors duration-200",
        active ? "text-theme-bg" : "text-theme-muted hover:bg-theme-text/[0.05] hover:text-theme-text",
      )}
    >
      {active && (
        <motion.span
          layoutId="tasks-tab-pill"
          transition={{ type: "spring", stiffness: 320, damping: 30 }}
          className="absolute inset-0 rounded-full bg-theme-text"
        />
      )}
      <span className="relative">{label}</span>
      {count !== undefined && (
        <span
          className={cn(
            "relative rounded-full px-1.5 py-0.5 text-[10px] font-semibold tabular-nums",
            active ? "bg-theme-bg/20 text-theme-bg" : "bg-theme-text/[0.07] text-theme-muted",
          )}
        >
          {count}
        </span>
      )}
    </button>
  );
}

export function Tasks() {
  const tasks = useStore((state) => state.tasks);
  const addTask = useStore((state) => state.addTask);
  const updateTask = useStore((state) => state.updateTask);
  const deleteTask = useStore((state) => state.deleteTask);

  const customTaskLists = useStore((state) => state.customTaskLists || []);
  const addCustomTaskList = useStore((state) => state.addCustomTaskList);
  const updateCustomTaskList = useStore((state) => state.updateCustomTaskList);
  const deleteCustomTaskList = useStore((state) => state.deleteCustomTaskList);

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingTask, setEditingTask] = useState<Task | null>(null);
  
  const [searchQuery, setSearchQuery] = useState("");
  const [showArchived, setShowArchived] = useState(false);
  const [activeTab, setActiveTab] = useState<string>("regular");

  const [editingTabId, setEditingTabId] = useState<string | null>(null);
  const [tabEditName, setTabEditName] = useState("");
  const tabInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (editingTabId && tabInputRef.current) {
      tabInputRef.current.focus();
      tabInputRef.current.select();
    }
  }, [editingTabId]);

  const handleAddNewTab = () => {
    const newName = `List ${customTaskLists.length + 1}`;
    const newId = addCustomTaskList(newName);
    setActiveTab(newId);
    setEditingTabId(newId);
    setTabEditName(newName);
  };

  const handleSaveTabName = (id: string) => {
    if (tabEditName.trim()) {
      updateCustomTaskList(id, tabEditName.trim());
    }
    setEditingTabId(null);
  };

  const handleStartRenameTab = (id: string, currentName: string) => {
    setEditingTabId(id);
    setTabEditName(currentName);
  };

  const handleOpenModal = (task?: Task) => {
    if (task) {
      setEditingTask(task);
    } else {
      setEditingTask(null);
    }
    setIsModalOpen(true);
  };

  const handleCloseModal = () => {
    setIsModalOpen(false);
    setEditingTask(null);
  };

  const filteredTasks = tasks.filter(t => {
    if (showArchived ? !t.archived : t.archived) return false;
    if (searchQuery && !t.name.toLowerCase().includes(searchQuery.toLowerCase()) && !(t.category || t.channelName || "").toLowerCase().includes(searchQuery.toLowerCase())) {
      return false;
    }
    return true;
  });

  const activeCustomList = customTaskLists.find(l => l.id === activeTab);
  const archivedCount = tasks.filter(t => t.archived).length;
  const activeCount = tasks.length - archivedCount;

  return (
    <div className="w-full pt-4 pb-10">
      {/* --------------------------------------------------------- header */}
      <div className="mb-8 flex flex-col gap-6 md:flex-row md:items-end md:justify-between">
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-theme-muted">
            Your habits
          </p>
          <h2 className="mt-2 font-display text-3xl font-medium tracking-tight text-theme-text">
            Tasks
          </h2>
          <p className="mt-2 text-sm text-theme-muted">
            {activeCount} active
            {archivedCount > 0 && ` · ${archivedCount} archived`}
          </p>
        </div>

        {activeTab === "regular" && (
          <div className="flex w-full items-center gap-3 md:w-auto">
            <div className="relative flex-1 md:w-72">
              <Search className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-theme-muted" />
              <input
                type="text"
                placeholder="Search habits..."
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                className="w-full rounded-full border border-theme-border bg-theme-bg py-2.5 pl-11 pr-10 text-sm text-theme-text transition-colors duration-200 placeholder:text-theme-muted/50 focus:border-theme-text/40 focus:outline-none"
              />
              {searchQuery && (
                <button
                  onClick={() => setSearchQuery("")}
                  aria-label="Clear search"
                  className="absolute right-3 top-1/2 -translate-y-1/2 rounded-full p-1 text-theme-muted transition-colors hover:text-theme-text"
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              )}
            </div>

            <button
              onClick={() => handleOpenModal()}
              aria-label="New habit"
              title="New habit"
              className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-theme-text text-theme-bg transition-opacity duration-200 hover:opacity-90"
            >
              <Plus className="h-5 w-5" />
            </button>
          </div>
        )}

        {/* Managing a list is contextual — these only exist for the list you're
            actually on, which is why they don't clutter the tab bar itself. */}
        {activeCustomList && (
          <div className="flex w-full items-center gap-2 md:w-auto">
            <button
              onClick={() => handleStartRenameTab(activeCustomList.id, activeCustomList.name)}
              className="flex h-10 items-center gap-2 rounded-full border border-theme-border bg-theme-bg px-4 text-sm font-medium text-theme-text transition-colors duration-200 hover:border-theme-text/35"
            >
              <Edit2 className="h-4 w-4" />
              Rename
            </button>
            <button
              onClick={() => {
                if (window.confirm(`Delete list "${activeCustomList.name}"?`)) {
                  deleteCustomTaskList(activeCustomList.id);
                  setActiveTab("temporary");
                }
              }}
              className="flex h-10 items-center gap-2 rounded-full border border-theme-border bg-theme-bg px-4 text-sm font-medium text-red-500 transition-colors duration-200 hover:border-red-500/40"
            >
              <Trash2 className="h-4 w-4" />
              Delete
            </button>
          </div>
        )}
      </div>

      {/* ----------------------------------------------------------- tabs */}
      <div className="mb-7 flex items-center gap-2 overflow-x-auto pb-1 no-scrollbar">
        <TabPill
          label="Regular"
          count={activeCount}
          active={activeTab === "regular"}
          onClick={() => setActiveTab("regular")}
        />
        <TabPill
          label="Temporary"
          active={activeTab === "temporary"}
          onClick={() => setActiveTab("temporary")}
        />

        {customTaskLists.map(list => (
          <div key={list.id} className="flex shrink-0 items-center">
            {editingTabId === list.id ? (
              <input
                ref={tabInputRef}
                type="text"
                value={tabEditName}
                onChange={e => setTabEditName(e.target.value)}
                onBlur={() => handleSaveTabName(list.id)}
                onKeyDown={e => {
                  if (e.key === "Enter") handleSaveTabName(list.id);
                  if (e.key === "Escape") setEditingTabId(null);
                }}
                className="min-w-[90px] max-w-[160px] rounded-full border border-theme-text/40 bg-transparent px-4 py-2 text-sm font-medium text-theme-text outline-none"
              />
            ) : (
              <TabPill
                label={list.name}
                active={activeTab === list.id}
                onClick={() => setActiveTab(list.id)}
              />
            )}
          </div>
        ))}

        <button
          onClick={handleAddNewTab}
          className="flex shrink-0 items-center gap-1.5 rounded-full border border-dashed border-theme-border px-4 py-2 text-xs font-medium text-theme-muted transition-colors duration-200 hover:border-theme-text/30 hover:text-theme-text"
        >
          <Plus className="h-3.5 w-3.5" />
          New list
        </button>
      </div>

      {activeTab === "regular" ? (
        <>
          {/* --------------------------------------- active / archived switch */}
          <div className="mb-6 inline-flex rounded-full border border-theme-border bg-theme-bg p-1">
            {[
              { label: "Active", archived: false, count: activeCount },
              { label: "Archived", archived: true, count: archivedCount },
            ].map(option => (
              <button
                key={option.label}
                onClick={() => setShowArchived(option.archived)}
                aria-pressed={showArchived === option.archived}
                className={cn(
                  "relative flex items-center gap-2 rounded-full px-4 py-1.5 text-xs font-medium transition-colors duration-200",
                  showArchived === option.archived
                    ? "text-theme-bg"
                    : "text-theme-muted hover:text-theme-text",
                )}
              >
                {showArchived === option.archived && (
                  <motion.span
                    layoutId="tasks-archive-pill"
                    transition={{ type: "spring", stiffness: 320, damping: 30 }}
                    className="absolute inset-0 rounded-full bg-theme-text"
                  />
                )}
                <span className="relative">{option.label}</span>
                <span
                  className={cn(
                    "relative tabular-nums",
                    showArchived === option.archived ? "text-theme-bg/70" : "text-theme-muted/70",
                  )}
                >
                  {option.count}
                </span>
              </button>
            ))}
          </div>

          {filteredTasks.length === 0 ? (
            <div className="flex flex-col items-center justify-center rounded-[2rem] border border-dashed border-theme-border px-6 py-24 text-center">
              <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-theme-text/[0.06] text-theme-muted">
                <Check className="h-5 w-5" strokeWidth={1.5} />
              </span>
              <p className="mt-5 font-display text-lg font-medium text-theme-text">
                {searchQuery
                  ? "Nothing matches that search"
                  : showArchived
                    ? "Nothing archived"
                    : "No habits yet"}
              </p>
              <p className="mt-2 max-w-sm text-sm text-theme-muted">
                {searchQuery
                  ? "Try a different name or category."
                  : showArchived
                    ? "Archived habits will collect here."
                    : "Create your first habit and it will show up on your dashboard."}
              </p>
              {!showArchived && !searchQuery && (
                <button
                  onClick={() => handleOpenModal()}
                  className="mt-6 rounded-full bg-theme-text px-5 py-2.5 text-sm font-medium text-theme-bg transition-opacity duration-200 hover:opacity-90"
                >
                  Create a habit
                </button>
              )}
            </div>
          ) : (
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
              <AnimatePresence>
                {filteredTasks.map(task => (
                  <motion.div
                    key={task.id}
                    role="button"
                    tabIndex={0}
                    onClick={() => handleOpenModal(task)}
                    onKeyDown={e => {
                      if (e.key === "Enter" || e.key === " ") {
                        e.preventDefault();
                        handleOpenModal(task);
                      }
                    }}
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, scale: 0.97 }}
                    whileTap={{ scale: 0.99 }}
                    transition={{ duration: 0.25 }}
                    className={cn(
                      "card-surface group flex cursor-pointer flex-col rounded-[1.75rem] border border-theme-border bg-theme-surface p-5 transition-colors duration-300 hover:border-theme-text/20",
                      task.archived && "opacity-60",
                    )}
                  >
                    <div className="flex items-start gap-3">
                      <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-theme-text/[0.07] text-sm leading-none text-theme-text/80 ring-1 ring-inset ring-white/10">
                        {taskGlyph(task)}
                      </span>

                      <div className="min-w-0 flex-1">
                        <h3 className="truncate font-display text-base font-medium leading-tight text-theme-text">
                          {task.name}
                        </h3>
                        {task.metric ? (
                          <p className="mt-1 truncate text-sm text-theme-muted">{task.metric}</p>
                        ) : task.notes ? (
                          <p className="mt-1 line-clamp-2 text-sm text-theme-muted">{task.notes}</p>
                        ) : null}
                      </div>
                    </div>

                    <div className="mt-5 flex items-center justify-between gap-3 border-t border-theme-border/50 pt-3">
                      <div className="flex min-w-0 flex-wrap items-center gap-x-2.5 gap-y-1 text-[11px] text-theme-muted">
                        {task.priority && (
                          <span className="inline-flex items-center gap-1.5">
                            <span className={cn("h-1.5 w-1.5 shrink-0 rounded-full", PRIORITY_TONE[task.priority])} />
                            {PRIORITY_LABEL[task.priority]}
                          </span>
                        )}
                        {(task.category || task.channelName) && (
                          <span className="truncate">{task.category || task.channelName}</span>
                        )}
                        <span className="shrink-0">{formatFrequency(task.frequency)}</span>
                        {task.archived && (
                          <span className="shrink-0 rounded-full bg-theme-text/[0.08] px-2 py-0.5 text-[10px] uppercase tracking-wider">
                            Archived
                          </span>
                        )}
                      </div>

                      <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full border border-theme-border text-theme-text opacity-0 transition-opacity duration-200 group-hover:opacity-100">
                        <Edit2 className="h-3.5 w-3.5" />
                      </span>
                    </div>
                  </motion.div>
                ))}
              </AnimatePresence>
            </div>
          )}
        </>
      ) : activeTab === "temporary" ? (
        <div className="max-w-2xl mx-auto">
          <TemporaryTasks listId="temporary" title="Temporary Tasks" />
        </div>
      ) : activeCustomList ? (
        <div className="max-w-2xl mx-auto">
          {/* Rename and Delete live in the page header, which already shows them
              for the active list — repeating them here was duplicative. */}
          <TemporaryTasks
            key={activeCustomList.id}
            listId={activeCustomList.id}
            title={activeCustomList.name}
          />
        </div>
      ) : (
        <div className="max-w-2xl mx-auto">
          <TemporaryTasks listId="temporary" title="Temporary Tasks" />
        </div>
      )}

      {/* Modal */}
      <AnimatePresence>
        {isModalOpen && (
          <TaskModal 
            task={editingTask} 
            onClose={handleCloseModal} 
            onSave={(taskData) => {
              if (editingTask) {
                updateTask(editingTask.id, taskData);
              } else {
                addTask(taskData);
              }
              handleCloseModal();
            }}
            onDelete={editingTask ? () => {
              deleteTask(editingTask.id, false);
              handleCloseModal();
            } : undefined}
            onToggleArchive={editingTask ? () => {
              updateTask(editingTask.id, { archived: !editingTask.archived });
              handleCloseModal();
            } : undefined}
          />
        )}
      </AnimatePresence>
    </div>
  );
}

/** Frequency choices, each with an icon so the row reads without explanation. */
const FREQUENCY_OPTIONS = [
  { id: "daily", label: "Daily", icon: Sun },
  { id: "alternate", label: "Alternate", icon: Repeat },
  { id: "weekly", label: "Weekly", icon: CalendarRange },
  { id: "custom", label: "Every N", icon: SlidersHorizontal },
] as const;

const PRIORITIES = ["low", "medium", "high"] as const;

const WEEKDAY_INITIALS = ["S", "M", "T", "W", "T", "F", "S"];
const WEEKDAY_NAMES = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

/** Strip runs Monday-first, which is why position 0 maps to dayOfWeek 1. */
const STRIP_INITIALS = ["M", "T", "W", "T", "F", "S", "S"];



/**
 * Two-week strip that renders exactly what the chosen frequency produces. It
 * borrows the dashboard's accent-tile language, so a schedule becomes something
 * you read at a glance instead of decode — and the caption lives inside the
 * card rather than adding a line below it.
 */
function SchedulePreview({
  freqType,
  selectedDays,
  interval,
}: {
  freqType: string;
  selectedDays: number[];
  interval: number;
}) {
  const active = Array.from({ length: 14 }, (_, position) => {
    switch (freqType) {
      case "weekly":
        return selectedDays.length > 0 && selectedDays.includes((position + 1) % 7);
      case "alternate":
        return position % 2 === 0;
      case "custom":
        return position % Math.max(1, interval) === 0;
      default:
        return true;
    }
  });

  const title =
    freqType === "daily"
      ? "Every single day"
      : freqType === "alternate"
        ? "Every other day"
        : freqType === "weekly"
          ? selectedDays.length > 0
            ? `${selectedDays.length}× a week`
            : "No days picked yet"
          : `Every ${interval} day${interval === 1 ? "" : "s"}`;

  // Which weekdays the pattern actually lands on, in first-occurrence order.
  const days = [
    ...new Set(active.flatMap((on, position) => (on ? [WEEKDAY_NAMES[(position + 1) % 7]] : []))),
  ].join(", ");

  const detail = freqType === "weekly" && selectedDays.length === 0 ? "Pick a day to get started" : days;

  return (
    <div className="mt-3 flex items-center gap-6 rounded-2xl border border-theme-border bg-theme-bg px-4 py-4">
      {/* One column per weekday, label sitting directly above its own two
          tiles. The earlier 14-cells-plus-7-labels layout let a single letter
          straddle two tiles, so no tile was anchored to a day. */}
      <div className="grid shrink-0 grid-cols-7 gap-1.5">
        {STRIP_INITIALS.map((initial, column) => (
          <div key={column} className="flex flex-col items-center gap-1.5">
            <span className="text-[10px] font-medium leading-none text-theme-muted">{initial}</span>
            {[0, 1].map((week) => (
              <span
                key={week}
                className={cn(
                  "h-7 w-7 rounded-[7px] transition-colors duration-300",
                  active[column + week * 7] ? "bg-theme-accent" : "bg-theme-border"
                )}
              />
            ))}
          </div>
        ))}
      </div>

      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-medium text-theme-text">{title}</p>
        <p className="mt-1 truncate text-xs text-theme-muted">{detail}</p>
      </div>
    </div>
  );
}

function TaskModal({
  task: editingTask,
  onClose,
  onSave,
  onDelete,
  onToggleArchive,
}: {
  task: Task | null;
  onClose: () => void;
  onSave: (data: any) => void;
  onDelete?: () => void;
  onToggleArchive?: () => void;
}) {
  // Give the dock back before the exit spring plays out, so it springs in the
  // instant you commit to closing instead of after the modal finishes fading.
  const releaseOverlay = useRegisterOverlay();

  const close = useCallback(() => {
    releaseOverlay();
    onClose();
  }, [releaseOverlay, onClose]);

  const [name, setName] = useState(editingTask?.name || "");
  const [category, setCategory] = useState(editingTask?.category || editingTask?.channelName || "");
  const [freqType, setFreqType] = useState<string>(editingTask?.frequency.type || "daily");
  const [endDate, setEndDate] = useState(editingTask?.endDate || "");
  const [notes, setNotes] = useState(editingTask?.notes || "");
  const [metric, setMetric] = useState(editingTask?.metric || "");
  const [priority, setPriority] = useState<string>(editingTask?.priority || "medium");

  const [selectedDays, setSelectedDays] = useState<number[]>(
    editingTask?.frequency.type === "weekly" ? editingTask.frequency.daysOfWeek : []
  );

  const [interval, setIntervalVal] = useState<number>(
    editingTask?.frequency.type === "custom" ? editingTask.frequency.interval : 2
  );

  const handleSave = useCallback(() => {
    if (!name.trim()) return;

    releaseOverlay();

    let frequency: Frequency;
    const nowStr = new Date().toISOString().split("T")[0];

    if (freqType === "daily") {
      frequency = { type: "daily" };
    } else if (freqType === "weekly") {
      frequency = { type: "weekly", daysOfWeek: selectedDays.length > 0 ? selectedDays : [1] };
    } else if (freqType === "alternate") {
      frequency = { type: "alternate", startDate: nowStr };
    } else {
      frequency = { type: "custom", interval, startDate: nowStr };
    }

    onSave({
      name: name.trim(),
      category: category.trim(),
      frequency,
      priority: priority as Priority,
      color: "#111111",
      notes: notes.trim(),
      // Only send metric when set, so clearing it in the editor removes it
      // rather than persisting an empty string.
      ...(metric.trim() ? { metric: metric.trim() } : {}),
      ...(endDate ? { endDate } : {}),
    });
  }, [
    name, category, freqType, selectedDays, interval, priority, notes, metric, endDate,
    onSave, releaseOverlay,
  ]);

  // Escape closes, ⌘/Ctrl + Enter saves — no need to reach for the buttons.
  useEffect(() => {
    function onKey(event: KeyboardEvent) {
      if (event.key === "Escape") {
        event.preventDefault();
        close();
      } else if ((event.metaKey || event.ctrlKey) && event.key === "Enter") {
        event.preventDefault();
        handleSave();
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [handleSave, close]);

  const toggleDay = (day: number) => {
    setSelectedDays(
      selectedDays.includes(day) ? selectedDays.filter((d) => d !== day) : [...selectedDays, day]
    );
  };

  const SPRING = { type: "spring", damping: 32, stiffness: 380 } as const;

  return (
    <div className="fixed inset-0 z-[100] flex items-end justify-center p-3 sm:items-center sm:p-6">
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        transition={{ duration: 0.22 }}
        onClick={close}
        className="absolute inset-0 bg-black/40 backdrop-blur-md"
      />

      <motion.div
        initial={{ opacity: 0, scale: 0.96, y: 24 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.97, y: 12 }}
        transition={SPRING}
        className="relative flex max-h-[90vh] w-full max-w-xl flex-col overflow-hidden rounded-[1.75rem] border border-theme-border bg-theme-surface shadow-[0_48px_90px_-32px_rgb(0_0_0/0.5)]"
      >
        {/* identity — the name field *is* the title, so nothing competes with it */}
        <div className="shrink-0 px-7 pt-7 pb-6">
          <div className="flex items-start gap-4">
            <div className="min-w-0 flex-1">
              <p className="text-[10px] font-semibold uppercase tracking-[0.22em] text-theme-muted">
                {editingTask ? "Editing habit" : "New habit"}
              </p>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Name your habit"
                autoFocus
                className="mt-2 w-full bg-transparent font-display text-[1.75rem] font-medium leading-tight tracking-tight text-theme-text outline-none placeholder:text-theme-muted/30 md:text-4xl"
              />
            </div>
            <button
              onClick={close}
              aria-label="Close"
              className="-mr-2 -mt-1 shrink-0 rounded-full p-2 text-theme-muted transition-colors hover:bg-theme-bg hover:text-theme-text"
            >
              <X className="h-5 w-5" />
            </button>
          </div>

          <div className="relative mt-4 w-full sm:w-64">
            <Tag className="absolute left-3.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-theme-muted" />
            <input
              type="text"
              value={category}
              onChange={(e) => setCategory(e.target.value)}
              placeholder="Add a category"
              className="w-full rounded-full border border-theme-border bg-theme-bg py-2 pl-10 pr-4 text-xs text-theme-text outline-none transition-colors duration-200 placeholder:text-theme-muted/50 focus:border-theme-text/35"
            />
          </div>
        </div>

        <div className="flex-1 space-y-6 overflow-y-auto border-t border-theme-border px-7 py-6">
          {/* schedule — self-documenting control, no section label needed */}
          <div className="grid grid-cols-2 gap-1 rounded-2xl border border-theme-border bg-theme-bg p-1 sm:grid-cols-4">
            {FREQUENCY_OPTIONS.map((option) => (
              <button
                key={option.id}
                type="button"
                onClick={() => setFreqType(option.id)}
                aria-pressed={freqType === option.id}
                className={cn(
                  "relative flex items-center justify-center gap-1.5 rounded-xl px-2 py-2.5 text-[11px] font-medium sm:text-xs",
                  "transition-colors duration-200",
                  freqType === option.id ? "text-theme-bg" : "text-theme-muted hover:text-theme-text"
                )}
              >
                {freqType === option.id && (
                  <motion.span
                    layoutId="task-modal-frequency"
                    transition={SPRING}
                    className="absolute inset-0 rounded-xl bg-theme-text"
                  />
                )}
                <option.icon className="relative h-3.5 w-3.5 shrink-0" />
                <span className="relative truncate">{option.label}</span>
              </button>
            ))}
          </div>

          <SchedulePreview freqType={freqType} selectedDays={selectedDays} interval={interval} />

          {freqType === "weekly" && (
            <div className="grid grid-cols-7 gap-1.5">
              {WEEKDAY_INITIALS.map((initial, day) => (
                <button
                  key={day}
                  type="button"
                  onClick={() => toggleDay(day)}
                  aria-pressed={selectedDays.includes(day)}
                  title={WEEKDAY_NAMES[day]}
                  className={cn(
                    "rounded-xl border py-2.5 text-sm font-semibold transition-all duration-200",
                    selectedDays.includes(day)
                      ? "border-theme-text bg-theme-text text-theme-bg"
                      : "border-theme-border text-theme-muted hover:border-theme-text/25 hover:text-theme-text"
                  )}
                >
                  {initial}
                </button>
              ))}
            </div>
          )}

          {freqType === "custom" && (
            <div className="flex items-center gap-2 rounded-2xl border border-theme-border bg-theme-bg px-2 py-2">
              <button
                type="button"
                onClick={() => setIntervalVal(Math.max(2, interval - 1))}
                disabled={interval <= 2}
                aria-label="Decrease interval"
                className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-theme-border text-theme-text transition-colors hover:bg-theme-surface disabled:cursor-not-allowed disabled:opacity-30"
              >
                <Minus className="h-4 w-4" />
              </button>
              <p className="flex-1 text-center text-sm font-medium text-theme-text">
                Every <span className="tabular-nums">{interval}</span> day{interval === 1 ? "" : "s"}
              </p>
              <button
                type="button"
                onClick={() => setIntervalVal(Math.min(365, interval + 1))}
                disabled={interval >= 365}
                aria-label="Increase interval"
                className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-theme-border text-theme-text transition-colors hover:bg-theme-surface disabled:cursor-not-allowed disabled:opacity-30"
              >
                <Plus className="h-4 w-4" />
              </button>
            </div>
          )}

          {/* Two equal columns with their own label row, so both captions sit on the
              same baseline and both controls line up beneath them. */}
          <div className="grid gap-5 sm:grid-cols-2">
            <div>
              <p className="mb-2 text-[10px] font-semibold uppercase tracking-[0.2em] text-theme-muted">
                Priority
              </p>
              <div className="flex gap-0.5 rounded-full border border-theme-border bg-theme-bg p-1">
                {PRIORITIES.map((level) => (
                  <button
                    key={level}
                    type="button"
                    onClick={() => setPriority(level)}
                    aria-pressed={priority === level}
                    className={cn(
                      "relative flex flex-1 items-center justify-center gap-1.5 rounded-full px-2 py-2 text-[11px] font-medium capitalize transition-colors duration-200",
                      priority === level ? "text-theme-bg" : "text-theme-muted hover:text-theme-text"
                    )}
                  >
                    {priority === level && (
                      <motion.span
                        layoutId="task-modal-priority"
                        transition={SPRING}
                        className="absolute inset-0 rounded-full bg-theme-text"
                      />
                    )}
                    <span className={cn("relative h-2.5 w-[3px] rounded-full", PRIORITY_TONE[level])} />
                    <span className="relative">{level}</span>
                  </button>
                ))}
              </div>
            </div>

            <div>
              <p className="mb-2 text-[10px] font-semibold uppercase tracking-[0.2em] text-theme-muted">
                End date
              </p>
              <div className="relative">
                <CalendarDays className="absolute left-4 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-theme-muted" />
                <input
                  type="date"
                  value={endDate}
                  onChange={(e) => setEndDate(e.target.value)}
                  aria-label="End date"
                  className="w-full rounded-full border border-theme-border bg-theme-bg py-2.5 pl-11 pr-4 text-sm text-theme-text outline-none transition-colors duration-200 focus:border-theme-text/35"
                />
              </div>
            </div>
          </div>

          <div>
            <p className="mb-2 text-[10px] font-semibold uppercase tracking-[0.2em] text-theme-muted">
              Metric <span className="normal-case tracking-normal opacity-60">(optional)</span>
            </p>
            <input
              type="text"
              value={metric}
              onChange={(e) => setMetric(e.target.value)}
              placeholder="15 min · 30 pages · 3L"
              className="w-full rounded-full border border-theme-border bg-theme-bg py-2.5 px-4 text-sm text-theme-text outline-none transition-colors duration-200 placeholder:text-theme-muted/50 focus:border-theme-text/35"
            />
          </div>

          <div>
            <p className="mb-2 text-[10px] font-semibold uppercase tracking-[0.2em] text-theme-muted">
              Notes
            </p>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Why does this matter?"
              className="min-h-[76px] w-full resize-none rounded-2xl border border-theme-border bg-theme-bg px-4 py-3 text-sm leading-relaxed text-theme-text outline-none transition-colors duration-200 placeholder:text-theme-muted/50 focus:border-theme-text/35"
            />
          </div>
        </div>

        {/* actions */}
        <div
          className="flex shrink-0 items-center justify-between gap-3 border-t border-theme-border px-7 pt-4"
          style={{ paddingBottom: "max(1rem, env(safe-area-inset-bottom))" }}
        >
          <div className="flex items-center gap-1">
            {editingTask ? (
              <>
                <button
                  onClick={() => {
                    releaseOverlay();
                    onDelete?.();
                  }}
                  className="rounded-full px-3.5 py-2 text-sm font-medium text-red-500 transition-colors hover:bg-red-500/10"
                >
                  Delete
                </button>
                <button
                  onClick={() => {
                    releaseOverlay();
                    onToggleArchive?.();
                  }}
                  className="rounded-full px-3.5 py-2 text-sm font-medium text-theme-muted transition-colors hover:text-theme-text"
                >
                  {editingTask.archived ? "Unarchive" : "Archive"}
                </button>
              </>
            ) : (
              <p className="hidden text-[11px] text-theme-muted sm:block">
                <kbd className="rounded border border-theme-border px-1.5 py-0.5 font-sans">Esc</kbd> to cancel
              </p>
            )}
          </div>

          <div className="flex items-center gap-1">
            <button
              onClick={close}
              className="rounded-full px-5 py-2.5 text-sm font-medium text-theme-muted transition-colors hover:text-theme-text"
            >
              Cancel
            </button>
            <button
              onClick={handleSave}
              disabled={!name.trim()}
              className="rounded-full bg-theme-text px-6 py-2.5 text-sm font-medium text-theme-bg transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-40"
            >
              {editingTask ? "Save" : "Create"}
            </button>
          </div>
        </div>
      </motion.div>
    </div>
  );
}