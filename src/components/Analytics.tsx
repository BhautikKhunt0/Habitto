import { useMemo, useState } from "react";
import { format, subDays } from "date-fns";
import { Area, AreaChart, CartesianGrid, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { Activity, BarChart3 } from "lucide-react";
import { motion, useReducedMotion } from "framer-motion";

import { useStore } from "../store/useStore";
import { cn } from "../lib/utils";
import { CustomSelect } from "./CustomSelect";
import {
  buildDayStats,
  buildRhythm,
  indexCompletions,
  scopeIndex,
  type DayStat,
  type RhythmBucket,
} from "../lib/stats";

const RANGES = [
  { value: 7, label: "7D" },
  { value: 30, label: "30D" },
  { value: 90, label: "90D" },
] as const;

/** Rhythm averages need enough samples per weekday to mean anything. */
const RHYTHM_WINDOW_DAYS = 84;

export function Analytics() {
  const tasks = useStore((state) => state.tasks);
  const completions = useStore((state) => state.completions);

  const [taskFilter, setTaskFilter] = useState<string>("all");
  const [range, setRange] = useState<number>(30);

  const activeTasks = useMemo(() => tasks.filter((t) => !t.archived), [tasks]);

  // One filter + one index feed every widget below, so the cards can never disagree.
  const scoped = useMemo(() => {
    const index = scopeIndex(indexCompletions(completions), taskFilter === "all" ? null : taskFilter);
    const scopedTasks = taskFilter === "all" ? activeTasks : activeTasks.filter((t) => t.id === taskFilter);
    return { index, tasks: scopedTasks };
  }, [completions, activeTasks, taskFilter]);

  const today = useMemo(() => new Date(), []);

  const activity = useMemo(
    () => buildDayStats(scoped.tasks, scoped.index, subDays(today, range - 1), today),
    [scoped, range, today],
  );

  const rhythm = useMemo(
    () => buildRhythm(buildDayStats(scoped.tasks, scoped.index, subDays(today, RHYTHM_WINDOW_DAYS - 1), today)),
    [scoped, today],
  );

  if (activeTasks.length === 0) {
    return (
      <section className="space-y-6">
        <SectionHeader />
        <div className="rounded-[2rem] border border-dashed border-theme-border px-6 py-20 text-center">
          <Activity className="w-6 h-6 mx-auto mb-4 text-theme-muted" />
          <p className="text-sm uppercase tracking-widest font-semibold text-theme-muted">Nothing to measure yet</p>
          <p className="mt-2 text-sm text-theme-muted/80">
            Create a task and start ticking it off — activity and rhythm fill in here.
          </p>
        </div>
      </section>
    );
  }

  return (
    <section className="space-y-6">
      <SectionHeader
        filter={
          <div className="w-full sm:w-64">
            <CustomSelect
              value={taskFilter}
              onChange={(value) => setTaskFilter(String(value))}
              options={[
                { value: "all", label: "All habits" },
                ...activeTasks.map((t) => ({ value: t.id, label: t.name })),
              ]}
            />
          </div>
        }
      />

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 md:gap-6">
        <ActivityCard
          stats={activity}
          range={range}
          onRangeChange={setRange}
          className="lg:col-span-2"
        />
        <RhythmCard buckets={rhythm} className="lg:col-span-1" />
      </div>
    </section>
  );
}

/* ------------------------------------------------------------------ chrome */

function SectionHeader({ filter }: { filter?: React.ReactNode }) {
  return (
    <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4">
      <div>
        <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-theme-muted">Analytics</p>
        <h2 className="mt-2 text-3xl font-display font-medium text-theme-text tracking-tight">Your momentum</h2>
      </div>
      {filter}
    </div>
  );
}

function Card({
  icon: Icon,
  title,
  meta,
  tools,
  className,
  children,
}: {
  icon: typeof Activity;
  title: string;
  meta?: React.ReactNode;
  tools?: React.ReactNode;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: "-80px" }}
      transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
      className={cn(
        "group card-surface relative rounded-[2rem] border border-theme-border bg-theme-surface p-6 md:p-7",
        "hover:border-theme-text/20",
        className
      )}
    >
      <div className="mb-6 flex items-start justify-between gap-4">
        <div className="min-w-0">
          <div className="flex items-center gap-2.5">
            <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-theme-accent/10 text-theme-accent transition-colors duration-300 group-hover:bg-theme-accent group-hover:text-theme-bg">
              <Icon className="h-3.5 w-3.5" />
            </span>
            <span className="text-[11px] font-semibold uppercase tracking-[0.2em] text-theme-muted transition-colors duration-300 group-hover:text-theme-text">
              {title}
            </span>
          </div>
          {meta && <p className="mt-2.5 pl-[38px] text-xs text-theme-muted/80">{meta}</p>}
        </div>
        {tools && <div className="shrink-0">{tools}</div>}
      </div>
      {children}
    </motion.div>
  );
}

function RangeToggle({ value, onChange }: { value: number; onChange: (value: number) => void }) {
  return (
    <div className="flex items-center gap-1 rounded-full border border-theme-border bg-theme-bg p-1">
      {RANGES.map((option) => (
        <button
          key={option.value}
          type="button"
          onClick={() => onChange(option.value)}
          className={cn(
            "rounded-full px-3 py-1.5 text-[11px] font-semibold tracking-wider transition-colors duration-300",
            value === option.value
              ? "bg-theme-text text-theme-bg"
              : "text-theme-muted hover:text-theme-text"
          )}
        >
          {option.label}
        </button>
      ))}
    </div>
  );
}

function EmptyHint({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex items-center justify-center rounded-2xl border border-dashed border-theme-border py-16 text-center text-sm text-theme-muted px-6">
      {children}
    </div>
  );
}

/* ----------------------------------------------------------- activity chart */

interface ActivityPoint {
  label: string;
  fullLabel: string;
  completed: number;
  scheduled: number;
}

function ActivityCard({
  stats,
  range,
  onRangeChange,
  className,
}: {
  stats: DayStat[];
  range: number;
  onRangeChange: (value: number) => void;
  className?: string;
}) {
  const reduceMotion = useReducedMotion();

  const points: ActivityPoint[] = useMemo(
    () =>
      stats.map((stat) => ({
        // Weekday matters inside a single week; beyond that the month does.
        label: format(stat.date, range <= 7 ? "EEE d" : "MMM d"),
        fullLabel: format(stat.date, "EEEE, MMM d"),
        completed: stat.completed,
        scheduled: stat.scheduled,
      })),
    [stats, range],
  );

  const summary = useMemo(() => {
    const active = stats.filter((s) => s.hasSignal);
    const scheduled = active.reduce((sum, s) => sum + s.scheduled, 0);
    const completed = active.reduce((sum, s) => sum + s.completed, 0);
    const rate = scheduled > 0 ? Math.round((completed / scheduled) * 100) : 0;
    const dailyAverage = active.length > 0 ? completed / active.length : 0;
    return { rate, dailyAverage, completed, scheduled, activeDays: active.length };
  }, [stats]);

  const hasData = summary.scheduled > 0;

  return (
    <Card
      icon={Activity}
      title="Activity"
      meta={
        hasData
          ? `${summary.rate}% of ${summary.scheduled} scheduled · avg ${summary.dailyAverage.toFixed(1)}/day`
          : "No habits scheduled in this window"
      }
      tools={<RangeToggle value={range} onChange={onRangeChange} />}
      className={className}
    >
      {hasData ? (
        <div className="h-56 md:h-64 w-full -ml-2">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={points} margin={{ top: 8, right: 8, bottom: 0, left: 0 }}>
              <defs>
                <linearGradient id="activity-fill" x1="0" y1="0" x2="0" y2="1">
                  {/* --chart-fill is inherited from .card-surface, so hovering the
                      card deepens the fill with no React state. */}
                  <stop
                    offset="0%"
                    style={{ stopColor: "rgb(var(--accent-rgb))", stopOpacity: "var(--chart-fill)" }}
                  />
                  <stop offset="100%" style={{ stopColor: "rgb(var(--accent-rgb))", stopOpacity: 0 }} />
                </linearGradient>
              </defs>

              <CartesianGrid stroke="var(--border-color)" vertical={false} />
              <XAxis
                dataKey="label"
                stroke="var(--text-secondary)"
                tickLine={false}
                axisLine={false}
                tickMargin={12}
                /* Let Recharts thin the ticks to whatever actually fits. An
                   explicit interval renders EVERY label — at 90D that stacks
                   90 dates on top of each other. "preserveStartEnd" also keeps
                   the most recent date labelled, which is the one you want. */
                interval="preserveStartEnd"
                minTickGap={range <= 7 ? 8 : 40}
                fontSize={11}
              />
              <YAxis
                stroke="var(--text-secondary)"
                tickLine={false}
                axisLine={false}
                allowDecimals={false}
                width={28}
                fontSize={11}
              />
              <ReferenceLine
                y={summary.dailyAverage}
                stroke="var(--text-secondary)"
                strokeDasharray="4 4"
                strokeOpacity={0.45}
              />
              <Tooltip
                cursor={{ stroke: "var(--border-color)", strokeWidth: 1 }}
                content={<ActivityTooltip />}
              />
              <Area
                type="monotone"
                dataKey="completed"
                name="Completed"
                stroke="rgb(var(--accent-rgb))"
                strokeWidth={2.5}
                fill="url(#activity-fill)"
                dot={false}
                activeDot={{ r: 4, fill: "rgb(var(--accent-rgb))", stroke: "var(--surface-color)", strokeWidth: 2 }}
                isAnimationActive={!reduceMotion}
                animationDuration={700}
              />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      ) : (
        <EmptyHint>Nothing scheduled in the last {range} days.</EmptyHint>
      )}
    </Card>
  );
}

function ActivityTooltip({ active, payload }: any) {
  if (!active || !payload?.length) return null;
  const point = payload[0].payload as ActivityPoint;
  return (
    <div className="rounded-xl bg-theme-text text-theme-bg px-3 py-2 shadow-xl">
      <p className="text-[10px] uppercase tracking-[0.18em] opacity-60">{point.fullLabel}</p>
      <p className="mt-0.5 text-sm font-semibold">
        {point.completed} of {point.scheduled} done
      </p>
    </div>
  );
}

/* ----------------------------------------------------------- weekly rhythm */

function RhythmCard({
  buckets,
  className,
}: {
  buckets: RhythmBucket[];
  className?: string;
}) {
  const reduceMotion = useReducedMotion();
  const [hovered, setHovered] = useState<number | null>(null);

  const measured = buckets.filter((b) => b.samples > 0);
  const best = measured.reduce<RhythmBucket | null>(
    (top, bucket) => (!top || bucket.rate > top.rate ? bucket : top),
    null,
  );
  const average = measured.length
    ? Math.round(measured.reduce((sum, b) => sum + b.rate, 0) / measured.length)
    : 0;

  const focused = hovered === null ? null : buckets[hovered];

  return (
    <Card
      icon={BarChart3}
      title="Weekly rhythm"
      meta={
        focused && focused.samples > 0
          ? `${focused.label} · ${focused.completed}/${focused.scheduled} done over ${focused.samples} scheduled ${focused.samples === 1 ? "day" : "days"}`
          : best
            ? `Strongest on ${best.label} · ${best.rate}%`
            : "Log a few days to reveal your pattern"
      }
      className={className}
    >
      {measured.length ? (
        <>
          <div className="relative flex h-56 gap-1.5 md:h-64 md:gap-2">
            {/* average reference */}
            <div
              className="pointer-events-none absolute inset-x-0 border-t border-dashed border-theme-border"
              style={{ bottom: `${average}%` }}
              aria-hidden="true"
            />

            {buckets.map((bucket, index) => {
              const isBest = best !== null && bucket.weekday === best.weekday;
              const isHovered = hovered === bucket.weekday;
              const height = bucket.samples === 0 ? "3px" : `${Math.max(bucket.rate, 3)}%`;

              return (
                <div
                  key={bucket.weekday}
                  className="flex h-full flex-1 cursor-default flex-col justify-end"
                  onMouseEnter={() => setHovered(bucket.weekday)}
                  onMouseLeave={() => setHovered(null)}
                >
                  <motion.div
                    initial={reduceMotion ? { height } : { height: 0 }}
                    animate={{ height }}
                    transition={{
                      duration: 0.75,
                      delay: reduceMotion ? 0 : index * 0.05,
                      ease: [0.22, 1, 0.36, 1],
                    }}
                    className="relative w-full"
                  >
                    {(isHovered || (isBest && hovered === null)) && (
                      <span className="absolute -top-5 left-1/2 -translate-x-1/2 text-[11px] font-semibold tabular-nums text-theme-text">
                        {bucket.rate}%
                      </span>
                    )}

                    <span
                      className={cn(
                        "block w-full rounded-full transition-colors duration-300",
                        bucket.samples === 0
                          ? "bg-theme-border"
                          : isBest
                            ? "bg-theme-accent"
                            : isHovered
                              ? "bg-theme-accent/75"
                              : "bg-theme-accent/30"
                      )}
                      style={{ height: "100%" }}
                    />
                  </motion.div>
                </div>
              );
            })}
          </div>

          <div className="mt-3 flex items-center gap-1.5 md:gap-2">
            {buckets.map((bucket) => {
              const isBest = best !== null && bucket.weekday === best.weekday;
              return (
                <span
                  key={bucket.weekday}
                  className={cn(
                    "relative flex-1 text-center text-[11px] font-medium tracking-wider transition-colors",
                    isBest ? "text-theme-text" : "text-theme-muted"
                  )}
                >
                  {bucket.label}
                  {isBest && (
                    <span className="absolute -bottom-1 left-1/2 h-[2px] w-3 -translate-x-1/2 rounded-full bg-theme-accent" />
                  )}
                </span>
              );
            })}
          </div>

          <p className="mt-5 text-[11px] text-theme-muted/70">
            Averaged over the last {RHYTHM_WINDOW_DAYS} days · overall {average}%
          </p>
        </>
      ) : (
        <EmptyHint>No habits scheduled in the last {RHYTHM_WINDOW_DAYS} days.</EmptyHint>
      )}
    </Card>
  );
}
