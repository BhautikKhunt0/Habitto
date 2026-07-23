import { 
  startOfMonth, endOfMonth, startOfWeek, endOfWeek, 
  eachDayOfInterval, format, isSameMonth, isToday, 
  addMonths, subMonths, isSameDay, subDays
} from "date-fns";
import { ChevronLeft, ChevronRight, Check, Edit3, Flame, Trophy, Target } from "lucide-react";
import { useStore } from "../store/useStore";
import { isTaskScheduledOnDate, cn } from "../lib/utils";
import confetti from "canvas-confetti";
import { motion, AnimatePresence } from "framer-motion";
import { Task } from "../types";
import { useRef, useEffect, useState, useMemo } from "react";
import { BarChart, Bar, XAxis, Tooltip, ResponsiveContainer, Cell, YAxis } from 'recharts';

export function Dashboard() {
  const [currentMonth, setCurrentMonth] = useState(new Date());
  const [selectedDate, setSelectedDate] = useState<Date>(new Date());
  
  const tasks = useStore((state) => state.tasks);
  const completions = useStore((state) => state.completions);
  const toggleCompletion = useStore((state) => state.toggleCompletion);
  const quote = useStore((state) => state.quote);
  const setQuote = useStore((state) => state.setQuote);
  const animationsEnabled = useStore((state) => state.animationsEnabled);
  const themeColor = useStore((state) => state.themeColor) || '#a855f7';

  const [isEditingQuote, setIsEditingQuote] = useState(false);
  const [tempQuote, setTempQuote] = useState(quote || "Consistency is the only bridge between goals and accomplishment.");
  const quoteRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    if (isEditingQuote && quoteRef.current) {
      quoteRef.current.focus();
    }
  }, [isEditingQuote]);

  const handleQuoteSave = () => {
    if (tempQuote.trim()) {
      setQuote(tempQuote.trim());
    } else {
      setTempQuote(quote || "Consistency is the only bridge between goals and accomplishment.");
    }
    setIsEditingQuote(false);
  };

  // Calendar logic
  const monthStart = startOfMonth(currentMonth);
  const monthEnd = endOfMonth(monthStart);
  const startDate = startOfWeek(monthStart);
  const endDate = endOfWeek(monthEnd);

  const days = eachDayOfInterval({ start: startDate, end: endDate });

  const handleToggle = (taskId: string, dateStr: string) => {
    toggleCompletion(taskId, dateStr);
    
    // Check if all tasks for this date are now completed
    const existing = completions.find(c => c.taskId === taskId && c.date === dateStr);
    if (!existing) {
      const scheduledTasks = tasks.filter(t => isTaskScheduledOnDate(t, dateStr));
      const completedTasksIds = new Set(
        completions.filter(c => c.date === dateStr).map(c => c.taskId)
      );
      completedTasksIds.add(taskId); // Because we just completed it
      
      if (scheduledTasks.length > 0 && scheduledTasks.every(t => completedTasksIds.has(t.id))) {
        if (animationsEnabled) {
          confetti({
            particleCount: 150,
            spread: 80,
            origin: { y: 0.6 },
            colors: ['#8b5cf6', '#a855f7', '#d946ef', '#14b8a6', '#f59e0b']
          });
        }
      }
    }
  };

  const getTasksForDate = (date: Date) => {
    return tasks.filter(t => isTaskScheduledOnDate(t, date));
  };

  const selectedDateStr = format(selectedDate, 'yyyy-MM-dd');
  const selectedTasks = getTasksForDate(selectedDate);
  const completedSelectedCount = selectedTasks.filter(t => completions.some(c => c.taskId === t.id && c.date === selectedDateStr)).length;
  
  // Weekly Chart Data
  const last7Days = useMemo(() => {
    return Array.from({ length: 7 }).map((_, i) => {
      const date = subDays(new Date(), 6 - i);
      const dateStr = format(date, 'yyyy-MM-dd');
      const scheduledTasks = tasks.filter(t => isTaskScheduledOnDate(t, date));
      const completedCount = scheduledTasks.filter(t => 
        completions.some(c => c.taskId === t.id && c.date === dateStr)
      ).length;
      return {
        name: format(date, 'EEE'),
        completed: completedCount,
        scheduled: scheduledTasks.length,
        isToday: isToday(date)
      };
    });
  }, [tasks, completions]);

  // Streak Calculation
  const currentStreak = useMemo(() => {
    let streak = 0;
    let currDate = new Date();
    
    while (true) {
      const dateStr = format(currDate, 'yyyy-MM-dd');
      const scheduled = tasks.filter(t => isTaskScheduledOnDate(t, currDate));
      const completed = scheduled.filter(t => completions.some(c => c.taskId === t.id && c.date === dateStr)).length;
      
      if (scheduled.length > 0) {
        if (completed === scheduled.length) {
          streak++;
        } else if (!isToday(currDate)) {
          // If not today and didn't complete all, break streak
          break;
        }
      }
      currDate = subDays(currDate, 1);
      // Failsafe limit
      if (streak > 1000) break;
    }
    return streak;
  }, [tasks, completions]);

  // Progress Calculation
  const daysInMonth = eachDayOfInterval({ start: monthStart, end: monthEnd });
  let totalScheduled = 0;
  let totalCompleted = 0;
  
  daysInMonth.forEach(day => {
    const dayStr = format(day, 'yyyy-MM-dd');
    const dayTasks = getTasksForDate(day);
    totalScheduled += dayTasks.length;
    dayTasks.forEach(t => {
      if (completions.some(c => c.taskId === t.id && c.date === dayStr)) {
        totalCompleted++;
      }
    });
  });

  const progressPercent = totalScheduled > 0 ? Math.round((totalCompleted / totalScheduled) * 100) : 0;
  
  const greeting = useMemo(() => {
    const hour = new Date().getHours();
    if (hour < 12) return "Good morning";
    if (hour < 18) return "Good afternoon";
    return "Good evening";
  }, []);

  // Animation variants
  const containerVariants = {
    hidden: { opacity: 0 },
    show: {
      opacity: 1,
      transition: { staggerChildren: 0.1 }
    }
  };

  const itemVariants = {
    hidden: { opacity: 0, y: 20 },
    show: { opacity: 1, y: 0, transition: { type: "spring", stiffness: 300, damping: 24 } }
  };

  return (
    <div className="flex flex-col xl:flex-row gap-8 items-start max-w-7xl mx-auto">
      {/* Left Column: Bento Grid & Calendar */}
      <motion.div 
        variants={animationsEnabled ? containerVariants : undefined}
        initial={animationsEnabled ? "hidden" : undefined}
        animate={animationsEnabled ? "show" : undefined}
        className="flex-1 w-full space-y-6 md:space-y-8"
      >
        {/* Header Section */}
        <motion.div variants={animationsEnabled ? itemVariants : undefined} className="mb-4">
          <h1 className="text-3xl md:text-4xl font-light tracking-tight text-theme-text mb-2">
            {greeting}, <span className="font-medium text-theme-accent">User</span>
          </h1>
          <p className="text-theme-muted text-lg">
            {isToday(selectedDate) ? (
              selectedTasks.length === 0 ? "You have no tasks scheduled for today." :
              completedSelectedCount === selectedTasks.length ? "You've completed all your tasks for today! 🎉" :
              `You have ${selectedTasks.length - completedSelectedCount} tasks left to conquer today.`
            ) : (
              "Here is an overview of your progress and habits."
            )}
          </p>
        </motion.div>
        
        {/* Bento Grid */}
        <div className="grid grid-cols-1 md:grid-cols-12 gap-4 md:gap-6">
          
          {/* Progress Card */}
          <motion.div variants={animationsEnabled ? itemVariants : undefined} className="col-span-1 md:col-span-5 bg-theme-surface border border-theme-border rounded-[2rem] p-6 flex flex-col justify-between relative overflow-hidden group hover:shadow-2xl dark:hover:shadow-[0_8px_30px_rgb(0,0,0,0.3)] transition-all duration-500">
            <div className="absolute inset-0 bg-gradient-to-br from-theme-accent/10 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500" />
            
            <div className="flex justify-between items-start z-10 mb-6">
              <div>
                <h2 className="text-lg font-medium text-theme-text">Monthly Flow</h2>
                <p className="text-sm text-theme-muted mt-1">{format(currentMonth, 'MMMM yyyy')}</p>
              </div>
              <div className="w-10 h-10 rounded-full bg-theme-accent/10 flex items-center justify-center text-theme-accent">
                <Target className="w-5 h-5" />
              </div>
            </div>

            <div className="flex items-center gap-6 z-10">
              <div className="relative w-28 h-28 shrink-0 flex items-center justify-center drop-shadow-[0_0_15px_rgb(var(--accent-rgb)/0.2)]">
                <svg className="w-full h-full -rotate-90" viewBox="0 0 100 100">
                  <circle cx="50" cy="50" r="45" fill="none" stroke="var(--border-color)" strokeWidth="4" />
                  <motion.circle 
                    initial={animationsEnabled ? { strokeDashoffset: 283 } : false}
                    animate={animationsEnabled ? { strokeDashoffset: 283 - (283 * progressPercent) / 100 } : { strokeDashoffset: 283 - (283 * progressPercent) / 100 }}
                    transition={{ duration: 1.5, ease: "easeOut", delay: 0.2 }}
                    cx="50" cy="50" r="45" fill="none" 
                    stroke="var(--accent-color, #ddb7ff)" 
                    strokeWidth="4" 
                    strokeDasharray="283" 
                    strokeLinecap="round"
                  />
                </svg>
                <div className="absolute inset-0 flex flex-col items-center justify-center">
                  <span className="text-3xl font-light text-theme-text">{progressPercent}</span>
                  <span className="text-xs font-medium text-theme-muted uppercase tracking-wider">%</span>
                </div>
              </div>
              <div>
                <div className="text-3xl font-light text-theme-text mb-1">{totalCompleted} <span className="text-base text-theme-muted">/ {totalScheduled}</span></div>
                <p className="text-sm text-theme-muted">
                  {progressPercent === 100 ? "Flawless execution!" : progressPercent > 75 ? "Excellent pacing." : "Every step counts."}
                </p>
              </div>
            </div>
          </motion.div>
          
          {/* Activity Chart Card */}
          <motion.div variants={animationsEnabled ? itemVariants : undefined} className="col-span-1 md:col-span-7 bg-theme-surface border border-theme-border rounded-[2rem] p-6 relative overflow-hidden group hover:shadow-2xl dark:hover:shadow-[0_8px_30px_rgb(0,0,0,0.3)] transition-all duration-500 flex flex-col">
            <div className="flex justify-between items-start mb-6 z-10">
              <div>
                <h2 className="text-lg font-medium text-theme-text">7-Day Pulse</h2>
                <p className="text-sm text-theme-muted mt-1">Your recent activity</p>
              </div>
              <div className="flex gap-4">
                <div className="flex items-center gap-2">
                  <Flame className="w-5 h-5 text-orange-500" />
                  <div>
                    <div className="text-lg font-medium text-theme-text leading-none">{currentStreak}</div>
                    <div className="text-[10px] text-theme-muted uppercase tracking-wider mt-1">Day Streak</div>
                  </div>
                </div>
              </div>
            </div>

            <div className="flex-1 w-full min-h-[140px] z-10">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={last7Days} margin={{ top: 10, right: 0, left: 0, bottom: 0 }} barSize={28}>
                  <XAxis 
                    dataKey="name" 
                    axisLine={false} 
                    tickLine={false} 
                    tick={{ fill: 'var(--text-secondary)', fontSize: 12 }}
                    dy={10}
                  />
                  <Tooltip 
                    cursor={{ fill: 'var(--text-secondary)', opacity: 0.1 }}
                    content={({ active, payload }) => {
                      if (active && payload && payload.length) {
                        return (
                          <div className="bg-theme-surface border border-theme-border p-3 rounded-xl shadow-xl">
                            <p className="text-sm font-medium text-theme-text mb-1">{payload[0].payload.name}</p>
                            <p className="text-xs text-theme-muted flex items-center gap-2">
                              <span className="w-2 h-2 rounded-full" style={{ backgroundColor: themeColor }}></span>
                              {payload[0].value} / {payload[0].payload.scheduled} completed
                            </p>
                          </div>
                        );
                      }
                      return null;
                    }}
                  />
                  <Bar dataKey="completed" radius={[6, 6, 6, 6]}>
                    {last7Days.map((entry, index) => (
                      <Cell 
                        key={`cell-${index}`} 
                        fill={themeColor} 
                        className={entry.isToday ? "opacity-100" : "opacity-30 hover:opacity-70 transition-opacity"}
                      />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          </motion.div>

          {/* Quote Card */}
          <motion.div variants={animationsEnabled ? itemVariants : undefined} className="col-span-1 md:col-span-12 bg-gradient-to-r from-theme-surface to-theme-bg border border-theme-border rounded-[2rem] p-6 md:p-8 flex flex-col justify-center relative overflow-hidden group hover:shadow-xl transition-all duration-300">
             <div className="absolute top-0 left-0 w-1.5 h-full bg-theme-accent opacity-50 group-hover:opacity-100 transition-opacity duration-300" />
             <div className="pl-4 relative z-10 w-full">
               {isEditingQuote ? (
                 <textarea
                   ref={quoteRef}
                   value={tempQuote}
                   onChange={e => setTempQuote(e.target.value)}
                   onBlur={handleQuoteSave}
                   onKeyDown={e => {
                     if (e.key === 'Enter' && !e.shiftKey) {
                       e.preventDefault();
                       handleQuoteSave();
                     }
                   }}
                   className="w-full bg-transparent text-xl md:text-2xl font-serif italic text-theme-text opacity-90 leading-relaxed outline-none resize-none overflow-hidden"
                   rows={2}
                 />
               ) : (
                 <blockquote className="cursor-pointer relative" onClick={() => setIsEditingQuote(true)}>
                   <p className="text-xl md:text-2xl font-serif italic text-theme-text opacity-90 leading-relaxed pr-8">
                     "{quote || 'Consistency is the only bridge between goals and accomplishment.'}"
                   </p>
                   <button className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity text-theme-muted hover:text-theme-text bg-theme-surface p-2 rounded-full border border-theme-border shadow-sm">
                     <Edit3 className="w-4 h-4" />
                   </button>
                 </blockquote>
               )}
             </div>
          </motion.div>
        </div>

        {/* Calendar Section */}
        <motion.div variants={animationsEnabled ? itemVariants : undefined} className="bg-theme-surface/50 border border-theme-border rounded-[2rem] p-6 md:p-8 mt-8">
          <div className="flex justify-between items-center mb-8">
            <h2 className="text-2xl md:text-3xl font-light tracking-wide text-theme-text flex items-center gap-3">
              {format(currentMonth, 'MMMM yyyy')}
            </h2>
            <div className="flex gap-2 bg-theme-bg p-1 rounded-full border border-theme-border">
              <button 
                onClick={() => setCurrentMonth(subMonths(currentMonth, 1))}
                className="p-2 rounded-full text-theme-muted hover:bg-theme-surface hover:text-theme-text hover:shadow-sm transition-all"
              >
                <ChevronLeft className="w-5 h-5" />
              </button>
              <button 
                onClick={() => setCurrentMonth(addMonths(currentMonth, 1))}
                className="p-2 rounded-full text-theme-muted hover:bg-theme-surface hover:text-theme-text hover:shadow-sm transition-all"
              >
                <ChevronRight className="w-5 h-5" />
              </button>
            </div>
          </div>
          
          <div className="grid grid-cols-7 gap-1 md:gap-2 mb-2">
            {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map((day, i) => (
              <div key={`header-${i}`} className="text-center text-xs font-medium uppercase tracking-wider text-theme-muted py-2">
                <span className="hidden md:inline">{day}</span>
                <span className="md:hidden">{day.charAt(0)}</span>
              </div>
            ))}
            
            {days.map((day, dayIdx) => {
              const dayStr = format(day, 'yyyy-MM-dd');
              const isSelected = isSameDay(day, selectedDate);
              const isCurrentMonth = isSameMonth(day, currentMonth);
              const isTodayDate = isToday(day);
              
              const dayTasks = getTasksForDate(day);
              const completedTasksCount = dayTasks.filter(t => 
                completions.some(c => c.taskId === t.id && c.date === dayStr)
              ).length;
              
              const allDone = dayTasks.length > 0 && completedTasksCount === dayTasks.length;
              const someDone = completedTasksCount > 0 && !allDone;

              return (
                <button
                  key={day.toString()}
                  onClick={() => setSelectedDate(day)}
                  className={cn(
                    "aspect-square flex flex-col items-center justify-center relative transition-all duration-300 rounded-xl md:rounded-2xl border",
                    isSelected 
                      ? "bg-theme-accent/10 border-theme-accent shadow-lg shadow-theme-accent/10 scale-105 z-10" 
                      : "bg-theme-bg border-transparent hover:border-theme-border hover:bg-theme-surface",
                    !isCurrentMonth && "opacity-30",
                    isTodayDate && !isSelected && "border-theme-accent/30 bg-theme-accent/5",
                    !isTodayDate && !isSelected && "text-theme-muted"
                  )}
                >
                  <span className={cn(
                    "text-sm md:text-lg font-medium",
                    isTodayDate && !isSelected && "text-theme-accent",
                    isSelected && "text-theme-accent"
                  )}>
                    {format(day, 'd')}
                  </span>
                  
                  {/* Dots indicator */}
                  {dayTasks.length > 0 && (
                    <div className="flex gap-1 mt-1 md:mt-1.5">
                      {allDone ? (
                        <div className="w-1.5 h-1.5 rounded-full bg-theme-accent" />
                      ) : someDone ? (
                         <div className="w-1.5 h-1.5 rounded-full bg-theme-accent/50" />
                      ) : (
                        <div className="w-1.5 h-1.5 rounded-full bg-theme-muted/30" />
                      )}
                    </div>
                  )}
                </button>
              );
            })}
          </div>
        </motion.div>
      </motion.div>

      {/* Right Sidebar: Selected Date Tasks */}
      <motion.div 
        initial={animationsEnabled ? { opacity: 0, x: 20 } : undefined}
        animate={animationsEnabled ? { opacity: 1, x: 0 } : undefined}
        transition={{ duration: 0.5, type: "spring", stiffness: 200, damping: 20 }}
        className="w-full xl:w-[400px] shrink-0 bg-theme-surface/30 border border-theme-border rounded-[2rem] p-6 xl:sticky xl:top-6 flex flex-col h-[calc(100vh-3rem)] max-h-[800px]"
      >
        <div className="mb-6 pb-6 border-b border-theme-border">
          <h2 className="text-2xl font-medium tracking-tight text-theme-text mb-2">
            {isToday(selectedDate) ? "Today's Agenda" : format(selectedDate, 'EEEE, MMM d')}
          </h2>
          <div className="flex items-center gap-3">
            <div className="flex-1 h-2 bg-theme-bg rounded-full overflow-hidden">
              <motion.div 
                className="h-full bg-theme-accent" 
                initial={animationsEnabled ? { width: 0 } : { width: `${selectedTasks.length > 0 ? (completedSelectedCount / selectedTasks.length) * 100 : 0}%` }}
                animate={{ width: `${selectedTasks.length > 0 ? (completedSelectedCount / selectedTasks.length) * 100 : 0}%` }}
                transition={{ duration: 0.5, ease: "easeOut" }}
              />
            </div>
            <span className="text-sm font-medium text-theme-muted w-12 text-right">
              {selectedTasks.length > 0 ? Math.round((completedSelectedCount / selectedTasks.length) * 100) : 0}%
            </span>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto pr-2 -mr-2 space-y-3 custom-scrollbar">
          <AnimatePresence mode="popLayout">
            {selectedTasks.length === 0 ? (
              <motion.div 
                initial={animationsEnabled ? { opacity: 0 } : undefined}
                animate={animationsEnabled ? { opacity: 1 } : undefined}
                className="flex flex-col items-center justify-center h-40 text-center"
              >
                <div className="w-16 h-16 rounded-full bg-theme-bg flex items-center justify-center mb-4">
                  <Check className="w-8 h-8 text-theme-muted/50" />
                </div>
                <p className="text-theme-muted font-medium">Nothing on the agenda.</p>
                <p className="text-xs text-theme-muted/70 mt-1">Take a break or add a new habit.</p>
              </motion.div>
            ) : (
              selectedTasks.map((task, i) => {
                const isCompleted = completions.some(c => c.taskId === task.id && c.date === selectedDateStr);
                return (
                  <TaskItem 
                    key={task.id} 
                    task={task} 
                    isCompleted={isCompleted} 
                    onToggle={() => handleToggle(task.id, selectedDateStr)} 
                    animationsEnabled={animationsEnabled}
                    index={i}
                  />
                )
              })
            )}
          </AnimatePresence>
        </div>
      </motion.div>
    </div>
  );
}

function TaskItem({ 
  task, 
  isCompleted, 
  onToggle, 
  animationsEnabled,
  index 
}: { 
  key?: string | number, 
  task: Task, 
  isCompleted: boolean, 
  onToggle: () => void,
  animationsEnabled: boolean,
  index: number
}) {
  return (
    <motion.label
      layout={animationsEnabled}
      initial={animationsEnabled ? { opacity: 0, y: 20, scale: 0.95 } : undefined}
      animate={animationsEnabled ? { opacity: 1, y: 0, scale: 1 } : undefined}
      exit={animationsEnabled ? { opacity: 0, scale: 0.9, transition: { duration: 0.2 } } : undefined}
      transition={{ delay: animationsEnabled ? index * 0.05 : 0, type: "spring", stiffness: 300, damping: 24 }}
      whileHover={animationsEnabled ? { scale: 1.02, y: -2 } : undefined}
      whileTap={animationsEnabled ? { scale: 0.98 } : undefined}
      className={cn(
        "flex items-center gap-4 p-4 rounded-2xl cursor-pointer transition-all duration-300 border bg-theme-bg",
        isCompleted 
          ? "border-theme-border/50 opacity-60" 
          : "border-theme-border shadow-sm hover:border-theme-accent/50 hover:shadow-md dark:hover:shadow-[0_4px_20px_rgba(0,0,0,0.2)]"
      )}
    >
      <div className="relative flex items-center justify-center shrink-0">
        <input 
          type="checkbox" 
          checked={isCompleted}
          onChange={onToggle}
          className="peer sr-only"
        />
        <div className={cn(
          "w-6 h-6 rounded-lg border-2 transition-all duration-300 flex items-center justify-center",
          isCompleted 
            ? "border-theme-accent bg-theme-accent/20 text-theme-accent" 
            : "border-theme-border bg-theme-surface peer-hover:border-theme-accent/60"
        )}>
          <motion.div
            initial={false}
            animate={{ scale: isCompleted ? 1 : 0, opacity: isCompleted ? 1 : 0 }}
            transition={{ type: "spring", stiffness: 400, damping: 25 }}
          >
            <Check className="w-4 h-4" strokeWidth={3} />
          </motion.div>
        </div>
      </div>
      
      <div className="flex-1 min-w-0 flex flex-col justify-center">
        <h3 className={cn(
          "font-medium text-[15px] truncate transition-all duration-300",
          isCompleted ? "text-theme-muted line-through decoration-theme-muted/50" : "text-theme-text"
        )}>
          {task.name}
        </h3>
        {(task.category || task.channelName) && (
          <div className="flex items-center gap-2 mt-1 opacity-80">
            <div className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: task.color || 'var(--accent-color)' }} />
            <span className="text-[11px] font-medium text-theme-muted uppercase tracking-wider truncate">{task.category || task.channelName}</span>
          </div>
        )}
      </div>
    </motion.label>
  );
}


