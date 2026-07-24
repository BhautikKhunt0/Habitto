import { useMemo, useState } from "react";
import { useStore } from "../store/useStore";
import { format, subDays, startOfDay, isSameDay, eachDayOfInterval, startOfYear, endOfYear, getMonth, getYear } from "date-fns";
import { AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer } from 'recharts';
import { Trophy, Flame, Target, ChevronDown } from "lucide-react";
import { isTaskScheduledOnDate, cn } from "../lib/utils";
import { createPortal } from "react-dom";

export function Stats() {
  const tasks = useStore((state) => state.tasks);
  const completions = useStore((state) => state.completions);
  const [selectedTaskId, setSelectedTaskId] = useState<string>("all");
  
  const [heatmapYear, setHeatmapYear] = useState(getYear(new Date()));
  const [heatmapMonth, setHeatmapMonth] = useState<number | 'all'>('all');
  const [hoveredDay, setHoveredDay] = useState<any | null>(null);

  const stats = useMemo(() => {
    let currentStreak = 0;
    let longestStreak = 0;
    
    // Simplistic overall streak: days in a row where at least ONE task was completed
    const uniqueDates = [...new Set(completions.map(c => c.date))].sort((a, b) => b.localeCompare(a));
    
    let tempStreak = 0;
    let expectedDate = startOfDay(new Date());

    for (let i = 0; i < uniqueDates.length; i++) {
      const date = startOfDay(new Date(uniqueDates[i]));
      if (isSameDay(date, expectedDate)) {
        tempStreak++;
        expectedDate = subDays(expectedDate, 1);
      } else if (i === 0 && isSameDay(date, subDays(expectedDate, 1))) {
        // missed today, but did yesterday
        tempStreak++;
        expectedDate = subDays(date, 1);
      } else {
        break;
      }
    }
    currentStreak = tempStreak;

    // longest streak calculation
    tempStreak = 0;
    let prevDate: Date | null = null;
    
    [...uniqueDates].reverse().forEach(dateStr => {
      const date = startOfDay(new Date(dateStr));
      if (!prevDate) {
        tempStreak = 1;
      } else {
        const diff = (date.getTime() - prevDate.getTime()) / (1000 * 3600 * 24);
        if (diff === 1) {
          tempStreak++;
        } else {
          longestStreak = Math.max(longestStreak, tempStreak);
          tempStreak = 1;
        }
      }
      prevDate = date;
    });
    longestStreak = Math.max(longestStreak, tempStreak);

    return { currentStreak, longestStreak };
  }, [completions]);

  const chartData = useMemo(() => {
    const data = [];
    for (let i = 29; i >= 0; i--) {
      const date = subDays(new Date(), i);
      const dateStr = format(date, 'yyyy-MM-dd');
      
      let count = 0;
      if (selectedTaskId === 'all') {
        count = completions.filter(c => c.date === dateStr).length;
      } else {
        count = completions.filter(c => c.taskId === selectedTaskId && c.date === dateStr).length;
      }
      
      data.push({
        date: format(date, 'MMM d'),
        fullDate: dateStr,
        completions: count
      });
    }
    return data;
  }, [completions, selectedTaskId]);

  const heatmapData = useMemo(() => {
    const yearStart = startOfYear(new Date(heatmapYear, 0, 1));
    const yearEnd = endOfYear(yearStart);
    const allDays = eachDayOfInterval({ start: yearStart, end: yearEnd });
    
    const filteredDays = heatmapMonth === 'all' 
      ? allDays 
      : allDays.filter(d => getMonth(d) === heatmapMonth);

    const cols: any[][] = [];
    let currentCol: any[] = [];
    
    // Padding for first week alignment if we are showing all months
    if (heatmapMonth === 'all' && filteredDays.length > 0) {
      const firstDayOfWeek = filteredDays[0].getDay();
      for (let i = 0; i < firstDayOfWeek; i++) {
        currentCol.push(null);
      }
    }

    filteredDays.forEach(day => {
      const dateStr = format(day, 'yyyy-MM-dd');
      let count = 0;
      let scheduledCount = 0;
      
      if (selectedTaskId === 'all') {
        count = completions.filter(c => c.date === dateStr).length;
        scheduledCount = tasks.filter(t => isTaskScheduledOnDate(t, day)).length;
      } else {
        count = completions.filter(c => c.taskId === selectedTaskId && c.date === dateStr).length;
        const task = tasks.find(t => t.id === selectedTaskId);
        if (task && isTaskScheduledOnDate(task, day)) scheduledCount = 1;
      }

      currentCol.push({
        date: dateStr,
        displayDate: format(day, 'MMM d, yyyy'),
        count,
        scheduledCount
      });

      if (currentCol.length === 7) {
        cols.push(currentCol);
        currentCol = [];
      }
    });

    if (currentCol.length > 0) {
      while (currentCol.length < 7) {
        currentCol.push(null);
      }
      cols.push(currentCol);
    }

    return cols;
  }, [completions, heatmapYear, heatmapMonth, selectedTaskId, tasks]);

  const availableYears = useMemo(() => {
    const years = new Set([getYear(new Date())]);
    completions.forEach(c => years.add(getYear(new Date(c.date))));
    return Array.from(years).sort((a, b) => b - a);
  }, [completions]);

  const MONTHS = [
    { value: 0, label: 'January' }, { value: 1, label: 'February' }, { value: 2, label: 'March' },
    { value: 3, label: 'April' }, { value: 4, label: 'May' }, { value: 5, label: 'June' },
    { value: 6, label: 'July' }, { value: 7, label: 'August' }, { value: 8, label: 'September' },
    { value: 9, label: 'October' }, { value: 10, label: 'November' }, { value: 11, label: 'December' }
  ];

  return (
    <div className="w-full pt-4 space-y-8">
      <div>
        <h2 className="text-3xl font-display font-medium text-theme-text">Analytics</h2>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        
        <div className="bg-theme-bg border border-theme-border rounded-[2rem] p-8 flex flex-col justify-center">
          <div className="flex items-center gap-3 mb-4 text-theme-muted">
            <Flame className="w-5 h-5" />
            <span className="font-semibold tracking-widest uppercase text-xs">Current Streak</span>
          </div>
          <div className="text-5xl font-display font-light text-theme-text">{stats.currentStreak} <span className="text-2xl text-theme-muted">days</span></div>
        </div>
        
        <div className="bg-theme-bg border border-theme-border rounded-[2rem] p-8 flex flex-col justify-center">
          <div className="flex items-center gap-3 mb-4 text-theme-muted">
            <Trophy className="w-5 h-5" />
            <span className="font-semibold tracking-widest uppercase text-xs">Best Streak</span>
          </div>
          <div className="text-5xl font-display font-light text-theme-text">{stats.longestStreak} <span className="text-2xl text-theme-muted">days</span></div>
        </div>

        <div className="bg-theme-bg border border-theme-border rounded-[2rem] p-8 flex flex-col justify-center">
          <div className="flex items-center gap-3 mb-4 text-theme-muted">
            <Target className="w-5 h-5" />
            <span className="font-semibold tracking-widest uppercase text-xs">Total Completed</span>
          </div>
          <div className="text-5xl font-display font-light text-theme-text">{completions.length}</div>
        </div>

        <div className="bg-theme-bg border border-theme-border rounded-[2rem] p-8 flex flex-col justify-center">
          <div className="flex items-center gap-3 mb-4 text-theme-muted">
            <Target className="w-5 h-5" />
            <span className="font-semibold tracking-widest uppercase text-xs">Active Tasks</span>
          </div>
          <div className="text-5xl font-display font-light text-theme-text">{tasks.filter(t => !t.archived).length}</div>
        </div>

      </div>

      <div className="bg-theme-surface border border-theme-border rounded-[2rem] p-6 md:p-10">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-8">
          <h2 className="text-xl font-display font-medium text-theme-text">Activity (Last 30 Days)</h2>
          <div className="relative">
            <select
              value={selectedTaskId}
              onChange={(e) => setSelectedTaskId(e.target.value)}
              className="appearance-none bg-theme-bg border border-theme-border rounded-xl px-4 py-3 pr-10 text-sm text-theme-text focus:outline-none focus:border-theme-text w-full sm:w-auto min-w-[200px]"
            >
              <option value="all">All Tasks</option>
              {tasks.map(t => (
                <option key={t.id} value={t.id}>{t.name}</option>
              ))}
            </select>
            <ChevronDown className="w-4 h-4 text-theme-muted absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none" />
          </div>
        </div>
        
        <div className="h-72 w-full">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={chartData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
              <defs>
                <linearGradient id="colorCompletions" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="var(--text-primary)" stopOpacity={0.1}/>
                  <stop offset="95%" stopColor="var(--text-primary)" stopOpacity={0}/>
                </linearGradient>
              </defs>
              <XAxis dataKey="date" stroke="var(--text-secondary)" fontSize={12} tickLine={false} axisLine={false} />
              <YAxis stroke="var(--text-secondary)" fontSize={12} tickLine={false} axisLine={false} allowDecimals={false} />
              <Tooltip 
                 contentStyle={{ backgroundColor: 'var(--surface-color)', borderColor: 'var(--border-color)', borderRadius: '1rem', color: 'var(--text-primary)', boxShadow: '0 10px 25px -5px rgba(0, 0, 0, 0.1)' }}
                itemStyle={{ color: 'var(--text-primary)' }}
              />
              <Area type="monotone" dataKey="completions" stroke="var(--text-primary)" strokeWidth={3} fillOpacity={1} fill="url(#colorCompletions)" />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </div>

      <div className="bg-theme-surface border border-theme-border rounded-[2rem] p-6 md:p-10">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-8">
          <h2 className="text-xl font-display font-medium text-theme-text">Consistency Map</h2>
          
          <div className="flex items-center gap-3">
            <div className="relative">
              <select
                value={heatmapMonth}
                onChange={(e) => setHeatmapMonth(e.target.value === 'all' ? 'all' : parseInt(e.target.value))}
                className="appearance-none bg-theme-bg border border-theme-border rounded-xl px-4 py-3 pr-10 text-sm text-theme-text focus:outline-none focus:border-theme-text"
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
                className="appearance-none bg-theme-bg border border-theme-border rounded-xl px-4 py-3 pr-10 text-sm text-theme-text focus:outline-none focus:border-theme-text"
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
          <div className="flex gap-2 min-w-max">
            {heatmapData.map((col, colIdx) => (
              <div key={colIdx} className="flex flex-col gap-2">
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
                        day.count < day.scheduledCount ? 'bg-theme-text/40' :
                        'bg-theme-text'
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
        
        <div className="flex items-center gap-2 mt-6 text-xs text-theme-muted justify-end uppercase tracking-widest font-semibold">
          <span>Less</span>
          <div className="w-3 h-3 rounded-sm bg-theme-border/50" />
          <div className="w-3 h-3 rounded-sm bg-theme-text/40" />
          <div className="w-3 h-3 rounded-sm bg-theme-text" />
          <span>More</span>
        </div>
      </div>

      {hoveredDay && createPortal(
        <div 
          className="fixed z-[100] flex flex-col pointer-events-none w-max bg-theme-text text-theme-bg rounded-lg px-3 py-2 shadow-xl"
          style={{
            top: hoveredDay.rect.top < 60 ? hoveredDay.rect.bottom + 8 : hoveredDay.rect.top - 8,
            left: Math.max(10, Math.min(window.innerWidth - 150, hoveredDay.rect.left + hoveredDay.rect.width / 2)),
            transform: hoveredDay.rect.top < 60 ? 'translate(-50%, 0)' : 'translate(-50%, -100%)'
          }}
        >
          <span className="text-xs font-semibold mb-1 text-center">{hoveredDay.displayDate}</span>
          <div className="text-xs text-theme-bg/70 text-center">
            {hoveredDay.count} / {hoveredDay.scheduledCount} Tasks Completed
          </div>
        </div>,
        document.body
      )}
    </div>
  );
}
