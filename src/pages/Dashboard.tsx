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
import { useRef, useEffect, useState } from "react";

export function Dashboard() {
  const [currentMonth, setCurrentMonth] = useState(new Date());
  const [selectedDate, setSelectedDate] = useState<Date>(new Date());
  
  const tasks = useStore((state) => state.tasks);
  const completions = useStore((state) => state.completions);
  const toggleCompletion = useStore((state) => state.toggleCompletion);
  const quote = useStore((state) => state.quote);
  const setQuote = useStore((state) => state.setQuote);

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
      // It was just checked. Are all tasks for this date completed now?
      const scheduledTasks = tasks.filter(t => isTaskScheduledOnDate(t, dateStr));
      const completedTasksIds = new Set(
        completions.filter(c => c.date === dateStr).map(c => c.taskId)
      );
      completedTasksIds.add(taskId); // Because we just completed it
      
      if (scheduledTasks.length > 0 && scheduledTasks.every(t => completedTasksIds.has(t.id))) {
        confetti({
          particleCount: 100,
          spread: 70,
          origin: { y: 0.6 },
          colors: ['#8b5cf6', '#a855f7', '#d946ef', '#14b8a6']
        });
      }
    }
  };

  const getTasksForDate = (date: Date) => {
    return tasks.filter(t => isTaskScheduledOnDate(t, date));
  };

  const selectedDateStr = format(selectedDate, 'yyyy-MM-dd');
  const selectedTasks = getTasksForDate(selectedDate);
  
  // Quick calculation for monthly flow (progress)
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
    <div className="flex flex-col xl:flex-row gap-8 items-start">
      {/* Left Column: Progress & Calendar */}
      <div className="flex-1 w-full space-y-8">
        
        {/* Progress Bento */}
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5, staggerChildren: 0.1 }} className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <motion.div whileHover={{ scale: 1.02, y: -4 }} className="bg-theme-surface border border-theme-border rounded-3xl p-6 flex items-center gap-6 relative overflow-hidden group shadow-sm hover:shadow-xl transition-shadow duration-300">
            <div className="absolute inset-0 bg-theme-accent/5 opacity-0 group-hover:opacity-100 transition-opacity duration-500" />
            <div className="relative w-24 h-24 shrink-0 flex items-center justify-center">
              <svg className="w-full h-full -rotate-90" viewBox="0 0 100 100">
                <circle cx="50" cy="50" r="48" fill="none" stroke="var(--border-color)" strokeWidth="2" />
                <circle 
                  cx="50" cy="50" r="48" fill="none" 
                  stroke="var(--accent-color, #ddb7ff)" 
                  strokeWidth="2" 
                  strokeDasharray="301" 
                  strokeDashoffset={301 - (301 * progressPercent) / 100}
                  strokeLinecap="round"
                  className="transition-all duration-1000 ease-out"
                />
              </svg>
              <div className="absolute inset-0 flex items-center justify-center">
                <span className="text-2xl font-light text-theme-accent">{progressPercent}%</span>
              </div>
            </div>
            <div>
              <h2 className="text-xl font-light text-theme-text mb-1">Monthly Flow</h2>
              <p className="text-sm text-theme-muted">
                {progressPercent === 100 ? "Perfect month!" : progressPercent > 70 ? "On track." : "Keep pushing."}
              </p>
            </div>
          </motion.div>
          
          <motion.div whileHover={{ scale: 1.02, y: -4 }} className="bg-theme-surface border border-theme-border rounded-3xl p-6 flex items-center relative overflow-hidden group shadow-sm hover:shadow-xl transition-shadow duration-300">
             <div className="absolute top-0 left-0 w-1 h-full bg-theme-accent/30" />
             <div className="pl-4 relative z-10 w-full flex flex-col justify-center">
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
                   className="w-full bg-transparent text-xl md:text-2xl font-light text-theme-text opacity-90 leading-snug outline-none resize-none overflow-hidden"
                   rows={3}
                 />
               ) : (
                 <blockquote className="cursor-pointer relative" onClick={() => setIsEditingQuote(true)}>
                   <p className="text-xl md:text-2xl font-light text-theme-text opacity-90 leading-snug pr-8">
                     "{quote || 'Consistency is the only bridge between goals and accomplishment.'}"
                   </p>
                   <button className="absolute top-0 right-0 opacity-0 group-hover:opacity-100 transition-opacity text-theme-muted hover:text-theme-text">
                     <Edit3 className="w-4 h-4" />
                   </button>
                 </blockquote>
               )}
             </div>
          </motion.div>
        </motion.div>

        {/* Calendar */}
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5, delay: 0.1 }} className="bg-transparent mt-8">
          <div className="flex justify-between items-center mb-8">
            <h2 className="text-3xl font-light tracking-wide text-theme-text">
              {format(currentMonth, 'MMMM')}
            </h2>
            <div className="flex gap-2">
              <button 
                onClick={() => setCurrentMonth(subMonths(currentMonth, 1))}
                className="p-2 rounded-full text-theme-muted hover:bg-theme-border hover:text-theme-text transition-colors"
              >
                <ChevronLeft className="w-5 h-5" />
              </button>
              <button 
                onClick={() => setCurrentMonth(addMonths(currentMonth, 1))}
                className="p-2 rounded-full text-theme-muted hover:bg-theme-border hover:text-theme-text transition-colors"
              >
                <ChevronRight className="w-5 h-5" />
              </button>
            </div>
          </div>
          
          <div className="grid grid-cols-7 gap-0 mb-4 border-l border-t border-theme-border">
            {['S', 'M', 'T', 'W', 'T', 'F', 'S'].map((day, i) => (
              <div key={`header-${i}`} className="text-center text-xs font-light tracking-widest text-theme-muted py-4 border-r border-b border-theme-border">
                {day}
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

              return (
                <button
                  key={day.toString()}
                  onClick={() => setSelectedDate(day)}
                  className={cn(
                    "aspect-square flex flex-col items-center justify-center relative transition-all duration-200 group border-r border-b border-theme-border",
                    isSelected 
                      ? "bg-theme-accent/5" 
                      : "hover:bg-theme-surface",
                    !isCurrentMonth && "opacity-30",
                    isTodayDate && !isSelected && "bg-theme-surface"
                  )}
                >
                  {isSelected && <div className="absolute inset-0 border border-theme-accent/30 z-10" />}
                  <span className={cn(
                    "text-sm md:text-base font-light",
                    isTodayDate && "text-theme-accent font-medium",
                    !isTodayDate && !isSelected && "text-theme-muted group-hover:text-theme-text",
                    isSelected && "text-theme-accent font-medium"
                  )}>
                    {format(day, 'd')}
                  </span>
                  
                  {/* Dots indicator */}
                  {dayTasks.length > 0 && (
                    <div className="flex gap-1 mt-2 absolute bottom-2 md:bottom-4">
                      {allDone ? (
                        <div className="w-1.5 h-1.5 rounded-full bg-theme-accent shadow-[0_0_8px_var(--accent-color)]" />
                      ) : (
                        dayTasks.slice(0, 3).map((t, i) => (
                          <div 
                            key={i} 
                            className="w-1 h-1 md:w-1.5 md:h-1.5 rounded-full opacity-60"
                            style={{ backgroundColor: t.color || 'var(--accent-color)' }}
                          />
                        ))
                      )}
                    </div>
                  )}
                </button>
              );
            })}
          </div>
        </motion.div>
      </div>

      {/* Right Sidebar: Selected Date Tasks */}
      <motion.div initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} transition={{ duration: 0.5, delay: 0.2 }} className="w-full xl:w-96 shrink-0 bg-transparent xl:sticky xl:top-6">
        <div className="mb-8">
          <h2 className="text-2xl font-light tracking-wide text-theme-text mb-1">
            {isToday(selectedDate) ? "Today's Focus" : format(selectedDate, 'EEEE, MMM d')}
          </h2>
          <p className="text-theme-muted text-sm">
            {selectedTasks.length === 0 
              ? "No tasks scheduled for this day." 
              : `${selectedTasks.length} task${selectedTasks.length === 1 ? '' : 's'} scheduled.`}
          </p>
        </div>

        <div className="space-y-3">
          <AnimatePresence mode="popLayout">
            {selectedTasks.map((task) => {
              const isCompleted = completions.some(c => c.taskId === task.id && c.date === selectedDateStr);
              return (
                <TaskItem 
                  key={task.id} 
                  task={task} 
                  isCompleted={isCompleted} 
                  onToggle={() => handleToggle(task.id, selectedDateStr)} 
                />
              )
            })}
          </AnimatePresence>
        </div>
      </motion.div>
    </div>
  );
}

function TaskItem({ task, isCompleted, onToggle }: { key?: string | number, task: Task, isCompleted: boolean, onToggle: () => void }) {
  return (
    <motion.label
      layout
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, scale: 0.95 }}
      whileHover={{ scale: 1.02 }}
      whileTap={{ scale: 0.98 }}
      className={cn(
        "flex items-center gap-4 p-4 rounded-2xl cursor-pointer transition-colors border",
        isCompleted 
          ? "bg-theme-surface border-theme-border/50 opacity-60" 
          : "bg-theme-surface border-theme-border hover:border-theme-accent/30 hover:bg-theme-accent/5"
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
          "w-5 h-5 md:w-6 md:h-6 rounded-sm border transition-all duration-300 flex items-center justify-center",
          isCompleted 
            ? "border-transparent bg-theme-accent/30 shadow-[0_0_10px_var(--accent-color)]" 
            : "border-theme-border bg-transparent peer-hover:border-theme-accent/40"
        )}>
          <Check className={cn(
            "w-3.5 h-3.5 text-theme-accent transition-transform duration-300",
            isCompleted ? "scale-100" : "scale-0"
          )} strokeWidth={3} />
        </div>
      </div>
      
      <div className="flex-1 min-w-0">
        <h3 className={cn(
          "font-medium text-lg truncate transition-colors",
          isCompleted ? "text-theme-muted line-through decoration-theme-muted/50" : "text-theme-text"
        )}>
          {task.name}
        </h3>
        {task.channelName && (
          <div className="flex items-center gap-2 mt-0.5">
            <div className="w-2 h-2 rounded-full" style={{ backgroundColor: task.color || 'var(--accent-color)' }} />
            <span className="text-xs text-theme-muted truncate">{task.channelName}</span>
          </div>
        )}
      </div>
    </motion.label>
  );
}

