import { useStore } from "../store/useStore";
import { useMemo, useState } from "react";
import { createPortal } from "react-dom";
import { format, subDays, eachDayOfInterval, startOfYear, endOfYear, startOfMonth, endOfMonth } from "date-fns";
import { AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer } from "recharts";
import { Flame, Calendar as CalendarIcon, ChevronDown } from "lucide-react";
import { isTaskScheduledOnDate, cn } from "../lib/utils";

export function Stats() {
  const tasks = useStore((state) => state.tasks);
  const completions = useStore((state) => state.completions);

  // Task selection for chart
  const [selectedTaskId, setSelectedTaskId] = useState<string>('all');

  // Month / Year selection for consistency map
  const [heatmapYear, setHeatmapYear] = useState<number>(new Date().getFullYear());
  const [heatmapMonth, setHeatmapMonth] = useState<number | 'all'>('all');
  
  // Tooltip state for heatmap
  const [hoveredDay, setHoveredDay] = useState<{
    date: string;
    displayDate: string;
    count: number;
    scheduledCount: number;
    rect: DOMRect;
  } | null>(null);

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

  // Last 30 days data for chart based on selected task
  const chartData = useMemo(() => {
    const today = new Date();
    const last30 = eachDayOfInterval({ start: subDays(today, 29), end: today });
    
    return last30.map(day => {
      const dateStr = format(day, 'yyyy-MM-dd');
      let count = 0;
      if (selectedTaskId === 'all') {
        count = completions.filter(c => c.date === dateStr).length;
      } else {
        count = completions.filter(c => c.date === dateStr && c.taskId === selectedTaskId).length;
      }
      return {
        date: format(day, 'MMM d'),
        fullDate: dateStr,
        completions: count
      };
    });
  }, [completions, selectedTaskId]);

  // Available years based on data
  const availableYears = useMemo(() => {
    let minYear = new Date().getFullYear();
    completions.forEach(c => {
      const y = parseInt(c.date.split('-')[0]);
      if (!isNaN(y) && y < minYear) minYear = y;
    });
    tasks.forEach(t => {
      const y = new Date(t.createdAt).getFullYear();
      if (!isNaN(y) && y < minYear) minYear = y;
    });
    
    const years = [];
    for (let i = new Date().getFullYear(); i >= minYear; i--) {
      years.push(i);
    }
    return years.length > 0 ? years : [new Date().getFullYear()];
  }, [completions, tasks]);

  const MONTHS = [
    { value: 0, label: 'January' },
    { value: 1, label: 'February' },
    { value: 2, label: 'March' },
    { value: 3, label: 'April' },
    { value: 4, label: 'May' },
    { value: 5, label: 'June' },
    { value: 6, label: 'July' },
    { value: 7, label: 'August' },
    { value: 8, label: 'September' },
    { value: 9, label: 'October' },
    { value: 10, label: 'November' },
    { value: 11, label: 'December' },
  ];

  // Heatmap data based on month/year
  const heatmapData = useMemo(() => {
    let start, end;
    
    if (heatmapMonth === 'all') {
      start = startOfYear(new Date(heatmapYear, 0, 1));
      end = endOfYear(new Date(heatmapYear, 0, 1));
    } else {
      start = startOfMonth(new Date(heatmapYear, heatmapMonth as number, 1));
      end = endOfMonth(new Date(heatmapYear, heatmapMonth as number, 1));
    }
    
    const days = eachDayOfInterval({ start, end });
    
    // Group days by column (weeks). For a real calendar feel, we align to Sundays.
    // We pad the first week so the first day of the interval aligns with its dayOfWeek.
    const startPadding = start.getDay(); // 0 for Sunday
    const paddedDays: (Date | null)[] = Array(startPadding).fill(null);
    paddedDays.push(...days);
    
    const columns: any[][] = [];
    for (let i = 0; i < paddedDays.length; i += 7) {
      const weekDays = paddedDays.slice(i, i + 7);
      
      columns.push(weekDays.map(day => {
        if (!day) return null;
        
        const dateStr = format(day, 'yyyy-MM-dd');
        const count = completions.filter(c => c.date === dateStr).length;
        const scheduledCount = tasks.filter(t => isTaskScheduledOnDate(t, day)).length;
        
        return {
          date: dateStr,
          displayDate: format(day, 'MMM d, yyyy'),
          count,
          scheduledCount
        };
      }));
    }
    
    return columns;
  }, [completions, tasks, heatmapYear, heatmapMonth]);

  return (
    <div className="space-y-8 max-w-5xl mx-auto">
      <div>
        <h1 className="text-3xl font-light tracking-wide text-theme-text mb-1">Analytics</h1>
        <p className="text-theme-muted">Track your consistency over time.</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="bg-theme-surface border border-theme-border rounded-3xl p-8 flex flex-col justify-center relative overflow-hidden transition-all duration-300 hover:shadow-xl dark:hover:shadow-[0_8px_30px_rgb(0,0,0,0.2)] hover:border-orange-500/30 group">
          <div className="absolute top-0 right-0 p-6 opacity-10 group-hover:opacity-20 group-hover:scale-110 transition-all duration-500">
            <Flame className="w-24 h-24 text-orange-500" />
          </div>
          <div className="flex items-center gap-2 text-orange-500 mb-2">
            <Flame className="w-5 h-5" />
            <span className="font-medium tracking-wide uppercase text-sm">Current Streak</span>
          </div>
          <div className="text-5xl font-light text-theme-text relative z-10">{streak} <span className="text-xl text-theme-muted">days</span></div>
        </div>
        
        <div className="bg-theme-surface border border-theme-border rounded-3xl p-8 flex flex-col justify-center transition-all duration-300 hover:shadow-xl dark:hover:shadow-[0_8px_30px_rgb(0,0,0,0.2)] hover:border-theme-accent/30">
          <div className="text-theme-muted font-medium tracking-wide uppercase text-sm mb-2">Total Completed</div>
          <div className="text-5xl font-light text-theme-text">{completions.length}</div>
        </div>

        <div className="bg-theme-surface border border-theme-border rounded-3xl p-8 flex flex-col justify-center transition-all duration-300 hover:shadow-xl dark:hover:shadow-[0_8px_30px_rgb(0,0,0,0.2)] hover:border-theme-accent/30">
          <div className="text-theme-muted font-medium tracking-wide uppercase text-sm mb-2">Active Tasks</div>
          <div className="text-5xl font-light text-theme-text">{tasks.filter(t => !t.archived).length}</div>
        </div>
      </div>

      <div className="bg-theme-surface border border-theme-border rounded-3xl p-6 md:p-8 transition-all duration-300 hover:shadow-xl dark:hover:shadow-[0_8px_30px_rgb(0,0,0,0.2)] hover:border-theme-accent/30">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
          <h2 className="text-lg font-light text-theme-text">Activity (Last 30 Days)</h2>
          <div className="relative">
            <select
              value={selectedTaskId}
              onChange={(e) => setSelectedTaskId(e.target.value)}
              className="appearance-none bg-theme-bg border border-theme-border rounded-xl px-4 py-2 pr-10 text-sm text-theme-text focus:outline-none focus:border-theme-accent w-full sm:w-auto min-w-[200px]"
            >
              <option value="all">All Tasks</option>
              {tasks.map(t => (
                <option key={t.id} value={t.id}>{t.name}</option>
              ))}
            </select>
            <ChevronDown className="w-4 h-4 text-theme-muted absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none" />
          </div>
        </div>
        
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

      <div className="bg-theme-surface border border-theme-border rounded-3xl p-6 md:p-8 transition-all duration-300 hover:shadow-xl dark:hover:shadow-[0_8px_30px_rgb(0,0,0,0.2)] hover:border-theme-accent/30">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
          <h2 className="text-lg font-light text-theme-text">Consistency Map</h2>
          
          <div className="flex items-center gap-3">
            <div className="relative">
              <select
                value={heatmapMonth}
                onChange={(e) => setHeatmapMonth(e.target.value === 'all' ? 'all' : parseInt(e.target.value))}
                className="appearance-none bg-theme-bg border border-theme-border rounded-xl px-4 py-2 pr-10 text-sm text-theme-text focus:outline-none focus:border-theme-accent"
              >
                <option value="all">All Year</option>
                {MONTHS.map(m => (
                  <option key={m.value} value={m.value}>{m.label}</option>
                ))}
              </select>
              <ChevronDown className="w-4 h-4 text-theme-muted absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none" />
            </div>
            
            <div className="relative">
              <select
                value={heatmapYear}
                onChange={(e) => setHeatmapYear(parseInt(e.target.value))}
                className="appearance-none bg-theme-bg border border-theme-border rounded-xl px-4 py-2 pr-10 text-sm text-theme-text focus:outline-none focus:border-theme-accent"
              >
                {availableYears.map(year => (
                  <option key={year} value={year}>{year}</option>
                ))}
              </select>
              <ChevronDown className="w-4 h-4 text-theme-muted absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none" />
            </div>
          </div>
        </div>

        <div className="overflow-x-auto pb-4">
          <div className="flex gap-1.5 min-w-max">
            {heatmapData.map((col, colIdx) => (
              <div key={colIdx} className="flex flex-col gap-1.5">
                {col.map((day, rowIdx) => {
                  if (!day) {
                    return <div key={`empty-${rowIdx}`} className="w-4 h-4 rounded-sm bg-transparent" />;
                  }
                  return (
                    <div 
                      key={day.date}
                      className={cn(
                        "w-4 h-4 rounded-sm transition-colors duration-300 relative cursor-pointer",
                        day.count === 0 ? 'bg-theme-border/50' :
                        day.count < day.scheduledCount ? 'bg-theme-accent/40' :
                        'bg-theme-accent shadow-[0_0_8px_var(--accent-color)]'
                      )}
                      onMouseEnter={(e) => {
                        setHoveredDay({
                          ...day,
                          rect: e.currentTarget.getBoundingClientRect()
                        });
                      }}
                      onMouseLeave={() => setHoveredDay(null)}
                    />
                  );
                })}
              </div>
            ))}
          </div>
        </div>
        
        <div className="flex items-center gap-2 mt-4 text-xs text-theme-muted justify-end">
          <span>Less</span>
          <div className="w-3 h-3 rounded-sm bg-theme-border/50" />
          <div className="w-3 h-3 rounded-sm bg-theme-accent/40" />
          <div className="w-3 h-3 rounded-sm bg-theme-accent shadow-[0_0_8px_var(--accent-color)]" />
          <span>More</span>
        </div>
      </div>

      {hoveredDay && createPortal(
        <div 
          className="fixed z-[100] flex flex-col pointer-events-none w-max bg-theme-bg border border-theme-border rounded-lg px-3 py-2 shadow-xl"
          style={{
            top: hoveredDay.rect.top < 60 ? hoveredDay.rect.bottom + 8 : hoveredDay.rect.top - 8,
            left: Math.max(10, Math.min(window.innerWidth - 150, hoveredDay.rect.left + hoveredDay.rect.width / 2)),
            transform: hoveredDay.rect.top < 60 ? 'translate(-50%, 0)' : 'translate(-50%, -100%)'
          }}
        >
          <span className="text-xs font-medium text-theme-text mb-1 text-center">{hoveredDay.displayDate}</span>
          <div className="text-xs text-theme-muted text-center">
            {hoveredDay.count} / {hoveredDay.scheduledCount} Tasks Completed
          </div>
          {hoveredDay.rect.top >= 60 ? (
            <div className="absolute top-full left-1/2 -translate-x-1/2 -mt-[1px] border-[6px] border-transparent border-t-theme-bg" />
          ) : (
            <div className="absolute bottom-full left-1/2 -translate-x-1/2 -mb-[1px] border-[6px] border-transparent border-b-theme-bg" />
          )}
        </div>,
        document.body
      )}
    </div>
  );
}

