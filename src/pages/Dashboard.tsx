import { endOfMonth, format, startOfMonth } from "date-fns";
import { Check, Edit3, Flame, ListChecks, Target } from "lucide-react";
import { motion } from "framer-motion";
import { useEffect, useMemo, useRef, useState } from "react";

import { Analytics } from "../components/Analytics";
import { TaskBoard } from "../components/TaskBoard";
import { useStore } from "../store/useStore";
import { buildDayStats, currentStreak, indexCompletions } from "../lib/stats";

const DEFAULT_QUOTE = "Consistency is the only bridge between goals and accomplishment.";

/** Ring geometry: r=54 in a 120 viewBox → 339.29 units of circumference. */
const RING_CIRCUMFERENCE = 2 * Math.PI * 54;

function greetingFor(date: Date): string {
  const hour = date.getHours();
  if (hour < 5) return "Still up";
  if (hour < 12) return "Good morning";
  if (hour < 17) return "Good afternoon";
  if (hour < 21) return "Good evening";
  return "Good night";
}

export function Dashboard() {
  const tasks = useStore((state) => state.tasks);
  const completions = useStore((state) => state.completions);
  const quote = useStore((state) => state.quote);
  const setQuote = useStore((state) => state.setQuote);

  const [selectedDate, setSelectedDate] = useState<Date>(() => new Date());

  const [isEditingQuote, setIsEditingQuote] = useState(false);
  const [tempQuote, setTempQuote] = useState(quote || DEFAULT_QUOTE);
  const quoteRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    if (isEditingQuote && quoteRef.current) quoteRef.current.focus();
  }, [isEditingQuote]);

  const handleQuoteSave = () => {
    if (tempQuote.trim()) {
      setQuote(tempQuote.trim());
    } else {
      setTempQuote(quote || DEFAULT_QUOTE);
    }
    setIsEditingQuote(false);
  };

  const today = useMemo(() => new Date(), []);
  const completionIndex = useMemo(() => indexCompletions(completions), [completions]);
  const activeTasks = useMemo(() => tasks.filter((t) => !t.archived), [tasks]);

  /* --- headline numbers ------------------------------------------------- */

  const monthStat = useMemo(() => {
    const start = startOfMonth(today);
    return buildDayStats(activeTasks, completionIndex, start, endOfMonth(start));
  }, [activeTasks, completionIndex, today]);

  const monthScheduled = monthStat.reduce((sum, s) => sum + s.scheduled, 0);
  const monthCompleted = monthStat.reduce((sum, s) => sum + s.completed, 0);
  const monthProgress = monthScheduled > 0 ? Math.round((monthCompleted / monthScheduled) * 100) : 0;

  const todayStat = useMemo(() => {
    const [stat] = buildDayStats(activeTasks, completionIndex, today, today);
    return stat ?? { scheduled: 0, completed: 0, rate: 0, hasSignal: false };
  }, [activeTasks, completionIndex, today]);

  const streak = useMemo(() => currentStreak(completionIndex, today), [completionIndex, today]);

  const verdict =
    monthScheduled === 0
      ? "No habits scheduled this month"
      : monthProgress === 100
        ? "Flawless execution."
        : monthProgress >= 70
          ? "Momentum is building."
          : "Requires focus.";

  return (
    <div className="pt-4 pb-24 space-y-14 md:space-y-20">
      {/* ================================================================ hero */}
      <section className="group/hero relative overflow-hidden rounded-[2.5rem] border border-theme-border bg-theme-surface transition-colors duration-500 hover:border-theme-text/20">
        {/* a whisper of accent wash bleeding in from the corner */}
        <div
          aria-hidden="true"
          className="pointer-events-none absolute -right-20 -top-28 h-80 w-80 rounded-full blur-3xl"
          style={{ background: "radial-gradient(circle, rgb(var(--accent-rgb)/0.09), transparent 70%)" }}
        />

        <div className="relative grid gap-12 p-8 md:p-12 lg:grid-cols-[minmax(0,1fr)_auto] lg:items-center">
          <div className="min-w-0">
            <div className="flex items-center gap-3">
              <span className="relative flex h-2 w-2 shrink-0">
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-theme-accent opacity-60 motion-reduce:animate-none" />
                <span className="relative inline-flex h-2 w-2 rounded-full bg-theme-accent" />
              </span>
              <span className="text-[11px] font-semibold uppercase tracking-[0.22em] text-theme-muted">
                {greetingFor(today)} · {format(today, "EEEE, MMMM d")}
              </span>
            </div>

            {/* editable quote — the page's anchor line */}
            <div className="group relative mt-7">
              {isEditingQuote ? (
                <textarea
                  ref={quoteRef}
                  value={tempQuote}
                  onChange={(event) => setTempQuote(event.target.value)}
                  onBlur={handleQuoteSave}
                  onKeyDown={(event) => {
                    if (event.key === "Enter" && !event.shiftKey) {
                      event.preventDefault();
                      handleQuoteSave();
                    }
                  }}
                  rows={3}
                  className="w-full resize-none overflow-hidden bg-transparent font-display text-3xl font-light leading-[1.15] tracking-tight text-theme-text outline-none md:text-5xl"
                />
              ) : (
                <button
                  type="button"
                  onClick={() => setIsEditingQuote(true)}
                  className="block w-full cursor-pointer text-left"
                >
                  <span className="pointer-events-none pr-10 font-display text-3xl font-light leading-[1.15] tracking-tight text-theme-text transition-colors duration-300 group-hover:text-theme-accent md:text-5xl">
                    {quote || DEFAULT_QUOTE}
                  </span>
                  <Edit3 className="absolute right-0 top-2 h-5 w-5 text-theme-muted opacity-0 transition-opacity duration-300 group-hover:opacity-100" />
                </button>
              )}
            </div>

            {/* structural metrics */}
            <div className="mt-10 flex flex-wrap items-center gap-x-9 gap-y-5">
              <Metric icon={ListChecks} label="Today" value={`${todayStat.completed}/${todayStat.scheduled}`} />
              <Metric icon={Flame} label="Streak" value={`${streak}d`} />
              <Metric icon={Target} label="Habits" value={String(activeTasks.length)} />
            </div>
          </div>

          {/* monthly flow ring */}
          <div className="flex flex-col items-center gap-5 lg:pl-6">
            <div className="relative h-36 w-36 shrink-0 md:h-44 md:w-44">
              <svg viewBox="0 0 120 120" className="h-full w-full -rotate-90">
                <circle cx="60" cy="60" r="54" fill="none" stroke="var(--border-color)" strokeWidth="2.5" />
                <motion.circle
                  cx="60"
                  cy="60"
                  r="54"
                  fill="none"
                  stroke="rgb(var(--accent-rgb))"
                  strokeWidth="5"
                  strokeLinecap="round"
                  strokeDasharray={RING_CIRCUMFERENCE}
                  initial={{ strokeDashoffset: RING_CIRCUMFERENCE }}
                  animate={{ strokeDashoffset: RING_CIRCUMFERENCE * (1 - monthProgress / 100) }}
                  transition={{ duration: 1.1, ease: [0.22, 1, 0.36, 1] }}
                  style={{ filter: "drop-shadow(0 0 5px rgb(var(--accent-rgb)/0.35))" }}
                />
              </svg>

              <div className="absolute inset-0 flex flex-col items-center justify-center">
                <span className="font-display text-5xl font-light tabular-nums tracking-tighter text-theme-text md:text-6xl">
                  {monthProgress}
                  <span className="text-2xl text-theme-muted md:text-3xl">%</span>
                </span>
                <span className="mt-1 text-[10px] font-semibold uppercase tracking-[0.2em] text-theme-muted">
                  this month
                </span>
              </div>
            </div>

            <div className="text-center">
              <p className="text-sm font-medium text-theme-text">
                {monthCompleted} of {monthScheduled} completed
              </p>
              <p className="mt-1 text-xs text-theme-muted">{verdict}</p>
            </div>
          </div>
        </div>
      </section>

      {/* =============================================== habits board */}
      <TaskBoard date={selectedDate} onDateChange={setSelectedDate} />

      {/* ============================================================ analytics */}
      <Analytics />
    </div>
  );
}

function Metric({ icon: Icon, label, value }: { icon: typeof Check; label: string; value: string }) {
  return (
    <div>
      <div className="flex items-center gap-2 text-theme-muted">
        <Icon className="h-3.5 w-3.5" />
        <span className="text-[10px] font-semibold uppercase tracking-[0.18em]">{label}</span>
      </div>
      <p className="mt-1.5 font-display text-2xl font-light tabular-nums text-theme-text">{value}</p>
    </div>
  );
}
