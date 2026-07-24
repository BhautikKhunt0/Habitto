import { 
  startOfMonth, endOfMonth, startOfWeek, endOfWeek, 
  eachDayOfInterval, format, isSameMonth, isToday, 
  addMonths, subMonths, isSameDay 
} from "date-fns";
import { ChevronLeft, ChevronRight, Check, Edit3 } from "lucide-react";
import { useStore } from "../store/useStore";
import { isTaskScheduledOnDate, cn } from "../lib/utils";
import confetti from "canvas-confetti";
import { motion, AnimatePresence } from "framer-motion";
import { Task } from "../types";
import React, { useRef, useEffect, useState } from "react";

export function Dashboard() {
  const [currentMonth, setCurrentMonth] = useState(new Date());
  const [selectedDate, setSelectedDate] = useState<Date>(new Date());
  
  const tasks = useStore((state) => state.tasks);
  const completions = useStore((state) => state.completions);
  const toggleCompletion = useStore((state) => state.toggleCompletion);
  const quote = useStore((state) => state.quote);
  const setQuote = useStore((state) => state.setQuote);
  const animationsEnabled = useStore(state => state.animationsEnabled);

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

  const monthStart = startOfMonth(currentMonth);
  const monthEnd = endOfMonth(monthStart);
  const startDate = startOfWeek(monthStart);
  const endDate = endOfWeek(monthEnd);

  const days = eachDayOfInterval({ start: startDate, end: endDate });

  const handleToggle = (taskId: string, dateStr: string) => {
    toggleCompletion(taskId, dateStr);
    
    const existing = completions.find(c => c.taskId === taskId && c.date === dateStr);
    if (!existing) {
      const scheduledTasks = tasks.filter(t => isTaskScheduledOnDate(t, dateStr));
      const completedTasksIds = new Set(
        completions.filter(c => c.date === dateStr).map(c => c.taskId)
      );
      completedTasksIds.add(taskId); 
      
      if (scheduledTasks.length > 0 && scheduledTasks.every(t => completedTasksIds.has(t.id))) {
        if (animationsEnabled) {
          confetti({
            particleCount: 100,
            spread: 70,
            origin: { y: 0.6 },
            colors: ['#000000', '#ffffff', '#888888']
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

  return (
    <div className="flex flex-col xl:flex-row gap-12 items-start pt-4">
      
      {/* Left Column */}
      <div className="flex-1 w-full space-y-12">
        
        {/* Quote Block (Stark Typography) */}
        <div className="group relative">
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
              className="w-full bg-transparent font-display text-3xl md:text-5xl font-light text-theme-text leading-tight md:leading-[1.1] outline-none resize-none overflow-hidden"
              rows={3}
            />
          ) : (
            <blockquote className="cursor-pointer relative" onClick={() => setIsEditingQuote(true)}>
              <p className="font-display text-3xl md:text-5xl font-light text-theme-text leading-tight md:leading-[1.1] tracking-tight pr-8">
                {quote || 'Consistency is the only bridge between goals and accomplishment.'}
              </p>
              <button className="absolute top-0 right-0 opacity-0 group-hover:opacity-100 transition-opacity text-theme-muted hover:text-theme-text mt-2">
                <Edit3 className="w-5 h-5" />
              </button>
            </blockquote>
          )}
        </div>

        {/* Structural Metrics & Calendar Bento */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          
          <div className="bg-theme-bg border border-theme-border rounded-[2rem] p-8 flex flex-col justify-between">
            <h2 className="text-sm font-medium text-theme-muted uppercase tracking-widest mb-8">Monthly Flow</h2>
            <div className="flex items-end justify-between">
              <div className="text-7xl font-display font-light text-theme-text tracking-tighter">
                {progressPercent}<span className="text-4xl text-theme-muted">%</span>
              </div>
              <div className="w-16 h-16 shrink-0 relative">
                <svg className="w-full h-full -rotate-90" viewBox="0 0 100 100">
                  <circle cx="50" cy="50" r="48" fill="none" stroke="var(--border-color)" strokeWidth="4" />
                  <circle 
                    cx="50" cy="50" r="48" fill="none" 
                    stroke="var(--text-primary)" 
                    strokeWidth="4" 
                    strokeDasharray="301" 
                    strokeDashoffset={301 - (301 * progressPercent) / 100}
                    strokeLinecap="round"
                    className="transition-all duration-1000 ease-out"
                  />
                </svg>
              </div>
            </div>
            <p className="mt-6 text-sm text-theme-muted">
              {progressPercent === 100 ? "Flawless execution." : progressPercent > 70 ? "Momentum is building." : "Requires focus."}
            </p>
          </div>

          <div className="bg-theme-bg border border-theme-border rounded-[2rem] p-6 md:p-8">
            <div className="flex justify-between items-center mb-6">
              <h2 className="text-lg font-medium text-theme-text">
                {format(currentMonth, 'MMMM yyyy')}
              </h2>
              <div className="flex gap-1">
                <button 
                  onClick={() => setCurrentMonth(subMonths(currentMonth, 1))}
                  className="p-1.5 rounded-full text-theme-muted hover:bg-theme-border hover:text-theme-text transition-colors"
                >
                  <ChevronLeft className="w-4 h-4" />
                </button>
                <button 
                  onClick={() => setCurrentMonth(addMonths(currentMonth, 1))}
                  className="p-1.5 rounded-full text-theme-muted hover:bg-theme-border hover:text-theme-text transition-colors"
                >
                  <ChevronRight className="w-4 h-4" />
                </button>
              </div>
            </div>
            
            <div className="grid grid-cols-7 gap-1">
              {['S', 'M', 'T', 'W', 'T', 'F', 'S'].map((day, i) => (
                <div key={`header-${i}`} className="text-center text-[10px] font-semibold tracking-widest text-theme-muted py-2">
                  {day}
                </div>
              ))}
              
              {days.map((day) => {
                const dayStr = format(day, 'yyyy-MM-dd');
                const isSelected = isSameDay(day, selectedDate);
                const isCurrentMonth = isSameMonth(day, currentMonth);
                const isTodayDate = isToday(day);
                
                const dayTasks = getTasksForDate(day);
                const completedTasksCount = dayTasks.filter(t => 
                  completions.some(c => c.taskId === t.id && c.date === dayStr)
                ).length;
                
                const allDone = dayTasks.length > 0 && completedTasksCount === dayTasks.length;
                const someDone = dayTasks.length > 0 && completedTasksCount > 0 && completedTasksCount < dayTasks.length;

                return (
                  <button
                    key={day.toString()}
                    onClick={() => setSelectedDate(day)}
                    className={cn(
                      "aspect-square flex flex-col items-center justify-center rounded-xl relative transition-all duration-200 group",
                      isSelected ? "bg-theme-text text-theme-bg" : "hover:bg-theme-surface",
                      !isCurrentMonth && !isSelected && "opacity-20",
                      isTodayDate && !isSelected && "ring-1 ring-theme-text ring-inset"
                    )}
                  >
                    <span className={cn(
                      "text-xs font-medium",
                      isTodayDate && !isSelected && "text-theme-text",
                      !isTodayDate && !isSelected && "text-theme-muted group-hover:text-theme-text"
                    )}>
                      {format(day, 'd')}
                    </span>
                    
                    {dayTasks.length > 0 && (
                      <div className="absolute bottom-1.5 left-1/2 -translate-x-1/2 flex gap-0.5">
                        {allDone ? (
                          <div className={cn("w-1 h-1 rounded-full", isSelected ? "bg-theme-bg" : "bg-theme-text")} />
                        ) : someDone ? (
                          <div className={cn("w-1 h-1 rounded-full", isSelected ? "bg-theme-bg/50" : "bg-theme-text/40")} />
                        ) : (
                          <div className={cn("w-1 h-1 rounded-full", isSelected ? "bg-theme-bg/20" : "bg-theme-border")} />
                        )}
                      </div>
                    )}
                  </button>
                );
              })}
            </div>
          </div>

        </div>
      </div>

      {/* Right Sidebar */}
      <div className="w-full xl:w-[400px] shrink-0 bg-transparent xl:sticky xl:top-8 pt-4">
        <div className="mb-8">
          <h2 className="text-3xl font-display font-medium text-theme-text mb-2">
            {isToday(selectedDate) ? "Today" : format(selectedDate, 'MMM d')}
          </h2>
          <p className="text-theme-muted text-sm font-medium">
            {selectedTasks.length === 0 
              ? "Zero tasks scheduled." 
              : `${selectedTasks.length} TASK${selectedTasks.length === 1 ? '' : 'S'}`}
          </p>
        </div>

        <div className="space-y-2">
          <AnimatePresence mode="popLayout">
            {selectedTasks.map((task) => {
              const isCompleted = completions.some(c => c.taskId === task.id && c.date === selectedDateStr);
              return (
                <TaskItem 
                  key={task.id} 
                  task={task} 
                  isCompleted={isCompleted} 
                  onToggle={() => handleToggle(task.id, selectedDateStr)}
                  animationsEnabled={animationsEnabled}
                />
              )
            })}
          </AnimatePresence>
        </div>
      </div>
    </div>
  );
}

function TaskItem({ task, isCompleted, onToggle, animationsEnabled, key }: { task: Task, isCompleted: boolean, onToggle: () => void, animationsEnabled: boolean, key?: React.Key }) {
  return (
    <motion.label
      layout={animationsEnabled}
      initial={animationsEnabled ? { opacity: 0, y: 10 } : { opacity: 1, y: 0 }}
      animate={{ opacity: 1, y: 0 }}
      exit={animationsEnabled ? { opacity: 0, scale: 0.95 } : { opacity: 0 }}
      whileHover={animationsEnabled ? { scale: 1.01 } : {}}
      whileTap={animationsEnabled ? { scale: 0.99 } : {}}
      className={cn(
        "flex items-center gap-4 p-4 rounded-[1.25rem] cursor-pointer transition-all duration-300",
        isCompleted 
          ? "bg-transparent opacity-50" 
          : "bg-theme-surface border border-theme-border hover:border-theme-text/20 shadow-sm"
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
          "w-6 h-6 rounded-full border-[1.5px] transition-all duration-300 flex items-center justify-center",
          isCompleted 
            ? "border-theme-text bg-theme-text" 
            : "border-theme-text/30 bg-transparent peer-hover:border-theme-text/60"
        )}>
          <Check className={cn(
            "w-3.5 h-3.5 text-theme-bg transition-transform duration-300",
            isCompleted ? "scale-100" : "scale-0"
          )} strokeWidth={3} />
        </div>
      </div>
      
      <div className="flex-1 min-w-0">
        <h3 className={cn(
          "font-medium text-base truncate transition-colors",
          isCompleted ? "text-theme-muted line-through decoration-theme-muted/50" : "text-theme-text"
        )}>
          {task.name}
        </h3>
        {(task.category || task.channelName || task.priority) && (
          <div className="flex items-center gap-2 mt-1">
            {task.priority && (
              <span className={cn(
                "text-[10px] font-bold tracking-wider uppercase px-1.5 py-0.5 rounded flex items-center justify-center",
                task.priority === 'high' ? "bg-red-500/10 text-red-500" :
                task.priority === 'medium' ? "bg-orange-500/10 text-orange-500" :
                "bg-green-500/10 text-green-500"
              )}>
                {task.priority}
              </span>
            )}
            {(task.category || task.channelName) && (
              <span className="text-[11px] font-semibold tracking-wider uppercase text-theme-muted truncate">
                {task.category || task.channelName}
              </span>
            )}
          </div>
        )}
      </div>
    </motion.label>
  );
}

