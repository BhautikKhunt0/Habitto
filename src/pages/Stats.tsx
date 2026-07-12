import { useStore } from "../store/useStore";
import { useMemo } from "react";
import { format, subDays, eachDayOfInterval } from "date-fns";
import { AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer } from "recharts";
import { Flame } from "lucide-react";
import { isTaskScheduledOnDate, cn } from "../lib/utils";

export function Stats() {
  const tasks = useStore((state) => state.tasks);
  const completions = useStore((state) => state.completions);

  // Compute total streak (days in a row with at least one completion)
  const streak = useMemo(() => {
    let currentStreak = 0;
    let maxStreak = 0;
    const today = new Date();
    
    // Check up to 365 days back
    for (let i = 0; i < 365; i++) {
      const date = format(subDays(today, i), 'yyyy-MM-dd');
      const hasCompletion = completions.some(c => c.date === date);
      
      if (hasCompletion) {
        currentStreak++;
        maxStreak = Math.max(maxStreak, currentStreak);
      } else {
        if (i > 0) { // allow missing today
          break;
        }
      }
    }
    return currentStreak;
  }, [completions]);

  // Last 30 days data for chart
  const chartData = useMemo(() => {
    const today = new Date();
    const last30 = eachDayOfInterval({ start: subDays(today, 29), end: today });
    
    return last30.map(day => {
      const dateStr = format(day, 'yyyy-MM-dd');
      const count = completions.filter(c => c.date === dateStr).length;
      return {
        date: format(day, 'MMM d'),
        fullDate: dateStr,
        completions: count
      };
    });
  }, [completions]);

  // Heatmap data (last 90 days)
  const heatmapData = useMemo(() => {
    const today = new Date();
    const last90 = eachDayOfInterval({ start: subDays(today, 89), end: today });
    
    return last90.map(day => {
      const dateStr = format(day, 'yyyy-MM-dd');
      const count = completions.filter(c => c.date === dateStr).length;
      const scheduledCount = tasks.filter(t => isTaskScheduledOnDate(t, day)).length;
      
      return {
        date: dateStr,
        displayDate: format(day, 'MMM d, yyyy'),
        count,
        scheduledCount
      };
    });
  }, [completions, tasks]);

  return (
    <div className="space-y-8 max-w-5xl mx-auto">
      <div>
        <h1 className="text-3xl font-light tracking-wide text-theme-text mb-1">Analytics</h1>
        <p className="text-theme-muted">Track your consistency over time.</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="bg-theme-surface border border-theme-border rounded-3xl p-8 flex flex-col justify-center relative overflow-hidden">
          <div className="absolute top-0 right-0 p-6 opacity-10">
            <Flame className="w-24 h-24 text-orange-500" />
          </div>
          <div className="flex items-center gap-2 text-orange-500 mb-2">
            <Flame className="w-5 h-5" />
            <span className="font-medium tracking-wide uppercase text-sm">Current Streak</span>
          </div>
          <div className="text-5xl font-light text-theme-text">{streak} <span className="text-xl text-theme-muted">days</span></div>
        </div>
        
        <div className="bg-theme-surface border border-theme-border rounded-3xl p-8 flex flex-col justify-center">
          <div className="text-theme-muted font-medium tracking-wide uppercase text-sm mb-2">Total Completed</div>
          <div className="text-5xl font-light text-theme-text">{completions.length}</div>
        </div>

        <div className="bg-theme-surface border border-theme-border rounded-3xl p-8 flex flex-col justify-center">
          <div className="text-theme-muted font-medium tracking-wide uppercase text-sm mb-2">Active Tasks</div>
          <div className="text-5xl font-light text-theme-text">{tasks.filter(t => !t.archived).length}</div>
        </div>
      </div>

      <div className="bg-theme-surface border border-theme-border rounded-3xl p-6 md:p-8">
        <h2 className="text-lg font-light text-theme-text mb-6">Activity (Last 30 Days)</h2>
        <div className="h-64 w-full">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={chartData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
              <defs>
                <linearGradient id="colorCompletions" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="var(--accent-color, #ddb7ff)" stopOpacity={0.3}/>
                  <stop offset="95%" stopColor="var(--accent-color, #ddb7ff)" stopOpacity={0}/>
                </linearGradient>
              </defs>
              <XAxis dataKey="date" stroke="currentColor" className="text-theme-muted" fontSize={12} tickLine={false} axisLine={false} />
              <YAxis stroke="currentColor" className="text-theme-muted" fontSize={12} tickLine={false} axisLine={false} allowDecimals={false} />
              <Tooltip 
                contentStyle={{ backgroundColor: 'var(--surface-color)', borderColor: 'var(--border-color)', borderRadius: '12px', color: 'var(--text-primary)' }}
                itemStyle={{ color: 'var(--accent-color)' }}
              />
              <Area type="monotone" dataKey="completions" stroke="var(--accent-color, #ddb7ff)" strokeWidth={3} fillOpacity={1} fill="url(#colorCompletions)" />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </div>

      <div className="bg-theme-surface border border-theme-border rounded-3xl p-6 md:p-8 overflow-x-auto">
        <h2 className="text-lg font-light text-theme-text mb-6">Consistency Map (Last 90 Days)</h2>
        <div className="flex gap-1.5 min-w-max pb-4">
          {/* Group into weeks roughly */}
          {Array.from({ length: Math.ceil(heatmapData.length / 7) }).map((_, colIdx) => (
            <div key={colIdx} className="flex flex-col gap-1.5">
              {heatmapData.slice(colIdx * 7, (colIdx + 1) * 7).map((day) => (
                <div 
                  key={day.date}
                  className={cn(
                    "w-4 h-4 rounded-sm transition-colors duration-300 relative group cursor-pointer",
                    day.count === 0 ? 'bg-theme-border/50' :
                    day.count < day.scheduledCount ? 'bg-theme-accent/40' :
                    'bg-theme-accent shadow-[0_0_8px_var(--accent-color)]'
                  )}
                >
                  <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 hidden group-hover:flex flex-col items-center z-50 w-max bg-theme-bg border border-theme-border rounded-lg px-3 py-2 shadow-xl">
                    <span className="text-xs font-medium text-theme-text mb-1">{day.displayDate}</span>
                    <div className="text-xs text-theme-muted">
                      {day.count} / {day.scheduledCount} Tasks Completed
                    </div>
                    {/* Tooltip arrow */}
                    <div className="absolute top-full left-1/2 -translate-x-1/2 -mt-[1px] border-[6px] border-transparent border-t-theme-bg" />
                  </div>
                </div>
              ))}
            </div>
          ))}
        </div>
        <div className="flex items-center gap-2 mt-2 text-xs text-theme-muted justify-end">
          <span>Less</span>
          <div className="w-3 h-3 rounded-sm bg-theme-border/50" />
          <div className="w-3 h-3 rounded-sm bg-theme-accent/40" />
          <div className="w-3 h-3 rounded-sm bg-theme-accent" />
          <span>More</span>
        </div>
      </div>
    </div>
  );
}
