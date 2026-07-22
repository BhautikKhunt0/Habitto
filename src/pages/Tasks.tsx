import React, { useState } from "react";
import { createPortal } from "react-dom";
import { useStore } from "../store/useStore";
import { Plus, Trash2, Edit2, Archive, ArchiveRestore } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { Task, Frequency } from "../types";
import { cn } from "../lib/utils";
import { format } from "date-fns";

export function Tasks() {
  const tasks = useStore((state) => state.tasks);
  const addTask = useStore((state) => state.addTask);
  const updateTask = useStore((state) => state.updateTask);
  const deleteTask = useStore((state) => state.deleteTask);
  
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingTask, setEditingTask] = useState<Task | null>(null);
  
  const [taskToDelete, setTaskToDelete] = useState<string | null>(null);

  const openNewTaskModal = () => {
    setEditingTask(null);
    setIsModalOpen(true);
  };

  const confirmDelete = () => {
    if (taskToDelete) {
      deleteTask(taskToDelete, false);
      setTaskToDelete(null);
    }
  };

  return (
    <div className="space-y-8 max-w-4xl mx-auto">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-light tracking-wide text-theme-text mb-1">Tasks & Channels</h1>
          <p className="text-theme-muted">Manage your recurring upload habits.</p>
        </div>
        <button 
          onClick={openNewTaskModal}
          className="flex items-center gap-2 bg-theme-accent text-theme-bg px-6 py-3 rounded-full hover:bg-theme-accent/90 transition-colors font-medium active:scale-95"
        >
          <Plus className="w-5 h-5" />
          <span>New Task</span>
        </button>
      </div>

      <div className="grid grid-cols-1 gap-4">
        <AnimatePresence mode="popLayout">
          {tasks.length === 0 && (
            <motion.div 
              initial={{ opacity: 0 }} animate={{ opacity: 1 }}
              className="text-center py-20 bg-theme-surface border border-theme-border rounded-3xl"
            >
              <p className="text-theme-muted">No tasks yet. Create one to get started.</p>
            </motion.div>
          )}
          {tasks.map((task) => (
            <motion.div
              layout
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95 }}
              whileHover={{ scale: 1.01, translateY: -2 }}
              key={task.id}
              className={cn(
                "bg-theme-surface border border-theme-border p-6 rounded-3xl flex flex-col md:flex-row md:items-center justify-between gap-6 transition-all duration-300 hover:shadow-[0_8px_30px_rgb(0,0,0,0.04)] dark:hover:shadow-[0_8px_30px_rgb(0,0,0,0.2)] hover:border-theme-accent/30",
                task.archived && "opacity-50 grayscale hover:scale-100 hover:translate-y-0 hover:shadow-none"
              )}
            >
              <div className="flex items-start gap-4">
                <div className="w-10 h-10 rounded-full shrink-0 flex items-center justify-center border border-theme-border" style={{ backgroundColor: `${task.color}20` }}>
                  <div className="w-4 h-4 rounded-full" style={{ backgroundColor: task.color }} />
                </div>
                <div>
                  <h3 className="text-xl font-medium text-theme-text mb-1">{task.name}</h3>
                  <div className="flex flex-wrap items-center gap-x-4 gap-y-2 text-sm text-theme-muted">
                    {task.channelName && <span className="flex items-center gap-1.5"><span className="w-1.5 h-1.5 rounded-full bg-theme-muted" /> {task.channelName}</span>}
                    <span className="flex items-center gap-1.5"><span className="w-1.5 h-1.5 rounded-full bg-theme-muted" /> {formatFrequency(task.frequency)}</span>
                    {task.archived && <span className="text-amber-500 bg-amber-500/10 px-2 py-0.5 rounded-md text-xs">Archived</span>}
                  </div>
                </div>
              </div>
              
              <div className="flex items-center gap-2 self-end md:self-auto">
                <button 
                  onClick={() => updateTask(task.id, { archived: !task.archived })}
                  className="p-2 text-theme-muted hover:text-theme-text hover:bg-theme-border rounded-full transition-colors"
                  title={task.archived ? "Unarchive" : "Archive"}
                >
                  {task.archived ? <ArchiveRestore className="w-5 h-5" /> : <Archive className="w-5 h-5" />}
                </button>
                <button 
                  onClick={() => { setEditingTask(task); setIsModalOpen(true); }}
                  className="p-2 text-theme-muted hover:text-theme-text hover:bg-theme-border rounded-full transition-colors"
                >
                  <Edit2 className="w-5 h-5" />
                </button>
                <button 
                  onClick={() => setTaskToDelete(task.id)}
                  className="p-2 text-red-400 hover:bg-red-500/10 rounded-full transition-colors"
                >
                  <Trash2 className="w-5 h-5" />
                </button>
              </div>
            </motion.div>
          ))}
        </AnimatePresence>
      </div>

      <AnimatePresence>
        {isModalOpen && (
          <TaskModal 
            onClose={() => setIsModalOpen(false)} 
            editingTask={editingTask}
            onSave={(taskData) => {
              if (editingTask) {
                updateTask(editingTask.id, taskData);
              } else {
                addTask(taskData);
              }
              setIsModalOpen(false);
            }}
          />
        )}
      </AnimatePresence>

      <AnimatePresence>
        {taskToDelete && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
            <motion.div 
              initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              className="absolute inset-0 bg-black/60 backdrop-blur-sm"
              onClick={() => setTaskToDelete(null)}
            />
            <motion.div 
              initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.95 }}
              className="relative bg-theme-surface border border-theme-border rounded-3xl p-6 md:p-8 w-full max-w-sm shadow-2xl"
            >
              <h2 className="text-xl font-medium text-theme-text mb-4">Delete Task?</h2>
              <p className="text-theme-muted mb-8">This action cannot be undone. All completion history for this task will be lost.</p>
              <div className="flex justify-end gap-3">
                <button 
                  onClick={() => setTaskToDelete(null)}
                  className="px-5 py-2.5 rounded-xl text-theme-muted hover:bg-theme-border transition-colors font-medium"
                >
                  Cancel
                </button>
                <button 
                  onClick={confirmDelete}
                  className="px-5 py-2.5 rounded-xl bg-red-500/10 text-red-500 hover:bg-red-500/20 transition-colors font-medium"
                >
                  Delete
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}

function formatFrequency(freq: Frequency): string {
  switch (freq.type) {
    case 'daily': return 'Daily';
    case 'alternate': return 'Every other day';
    case 'weekly': {
      const days = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
      return freq.daysOfWeek.map(d => days[d]).join(', ');
    }
    case 'custom': return `Every ${freq.interval} days`;
  }
}

function TaskModal({ onClose, editingTask, onSave }: { onClose: () => void, editingTask: Task | null, onSave: (task: any) => void }) {
  const [name, setName] = useState(editingTask?.name || "");
  const [channelName, setChannelName] = useState(editingTask?.channelName || "");
  const [color, setColor] = useState(editingTask?.color || "#a855f7");
  const [freqType, setFreqType] = useState<Frequency['type']>(editingTask?.frequency.type || 'daily');
  
  // Weekly specific
  const [selectedDays, setSelectedDays] = useState<number[]>(
    editingTask?.frequency.type === 'weekly' ? editingTask.frequency.daysOfWeek : [1, 3, 5]
  );
  
  // Custom / Alternate specific
  const [interval, setInterval] = useState(
    editingTask?.frequency.type === 'custom' ? editingTask.frequency.interval : 3
  );
  const [startDate, setStartDate] = useState(
    (editingTask?.frequency.type === 'alternate' || editingTask?.frequency.type === 'custom') 
      ? editingTask.frequency.startDate 
      : format(new Date(), 'yyyy-MM-dd')
  );

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;

    let frequency: Frequency;
    if (freqType === 'daily') {
      frequency = { type: 'daily' };
    } else if (freqType === 'alternate') {
      frequency = { type: 'alternate', startDate };
    } else if (freqType === 'weekly') {
      frequency = { type: 'weekly', daysOfWeek: selectedDays };
    } else {
      frequency = { type: 'custom', interval, startDate };
    }

    onSave({
      name: name.trim(),
      channelName: channelName.trim(),
      color,
      frequency
    });
  };

  const toggleDay = (day: number) => {
    if (selectedDays.includes(day)) {
      if (selectedDays.length > 1) setSelectedDays(selectedDays.filter(d => d !== day));
    } else {
      setSelectedDays([...selectedDays, day].sort());
    }
  };

  const colors = ["#ef4444", "#f97316", "#f59e0b", "#10b981", "#14b8a6", "#3b82f6", "#6366f1", "#8b5cf6", "#d946ef", "#f43f5e"];

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
      <motion.div 
        initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
        className="absolute inset-0 bg-black/60 backdrop-blur-sm"
        onClick={onClose}
      />
      <motion.div 
        initial={{ opacity: 0, scale: 0.95, y: 20 }} animate={{ opacity: 1, scale: 1, y: 0 }} exit={{ opacity: 0, scale: 0.95, y: 20 }}
        className="relative bg-theme-surface border border-theme-border rounded-3xl p-6 md:p-8 w-full max-w-lg shadow-2xl overflow-y-auto max-h-[90vh]"
      >
        <h2 className="text-2xl font-light text-theme-text mb-6">{editingTask ? 'Edit Task' : 'New Task'}</h2>
        
        <form onSubmit={handleSubmit} className="space-y-6">
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-theme-muted mb-1.5">Task Name</label>
              <input 
                autoFocus
                type="text" 
                required
                value={name}
                onChange={e => setName(e.target.value)}
                className="w-full bg-theme-bg border border-theme-border rounded-xl px-4 py-3 text-theme-text focus:outline-none focus:border-theme-accent transition-colors"
                placeholder="e.g. Upload Tech Review"
              />
            </div>
            
            <div>
              <label className="block text-sm font-medium text-theme-muted mb-1.5">Channel Name (Optional)</label>
              <input 
                type="text" 
                value={channelName}
                onChange={e => setChannelName(e.target.value)}
                className="w-full bg-theme-bg border border-theme-border rounded-xl px-4 py-3 text-theme-text focus:outline-none focus:border-theme-accent transition-colors"
                placeholder="e.g. Marques Brownlee"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-theme-muted mb-2">Color</label>
              <div className="flex flex-wrap gap-3">
                {colors.map(c => (
                  <button
                    key={c}
                    type="button"
                    onClick={() => setColor(c)}
                    className={cn(
                      "w-8 h-8 rounded-full flex items-center justify-center transition-transform",
                      color === c ? "scale-110 ring-2 ring-theme-bg ring-offset-2 ring-offset-theme-accent" : "hover:scale-110"
                    )}
                    style={{ backgroundColor: c }}
                  />
                ))}
              </div>
            </div>

            <div className="pt-4 border-t border-theme-border">
              <label className="block text-sm font-medium text-theme-muted mb-3">Frequency</label>
              <div className="grid grid-cols-2 gap-2 mb-4">
                {(['daily', 'weekly', 'alternate', 'custom'] as const).map(type => (
                  <button
                    key={type}
                    type="button"
                    onClick={() => setFreqType(type)}
                    className={cn(
                      "px-4 py-2 rounded-lg text-sm transition-colors border",
                      freqType === type 
                        ? "bg-theme-accent/20 border-theme-accent/50 text-theme-accent" 
                        : "bg-theme-bg border-transparent text-theme-muted hover:bg-theme-border hover:text-theme-text"
                    )}
                  >
                    <span className="capitalize">{type}</span>
                  </button>
                ))}
              </div>

              {freqType === 'weekly' && (
                <div className="flex gap-1.5 mt-4">
                  {['S', 'M', 'T', 'W', 'T', 'F', 'S'].map((day, i) => (
                    <button
                      key={i}
                      type="button"
                      onClick={() => toggleDay(i)}
                      className={cn(
                        "w-10 h-10 rounded-full flex items-center justify-center text-sm font-medium transition-colors border",
                        selectedDays.includes(i)
                          ? "bg-theme-accent border-theme-accent text-theme-bg"
                          : "bg-theme-bg border-theme-border text-theme-muted hover:bg-theme-border"
                      )}
                    >
                      {day}
                    </button>
                  ))}
                </div>
              )}

              {(freqType === 'alternate' || freqType === 'custom') && (
                <div className="space-y-4 mt-4 bg-theme-bg p-4 rounded-xl border border-theme-border">
                  {freqType === 'custom' && (
                    <div>
                      <label className="block text-sm text-theme-muted mb-1.5">Interval (Days)</label>
                      <input 
                        type="number" 
                        min="1"
                        value={interval}
                        onChange={e => setInterval(parseInt(e.target.value) || 1)}
                        className="w-full bg-theme-surface border border-theme-border rounded-lg px-3 py-2 text-theme-text focus:outline-none focus:border-theme-accent"
                      />
                    </div>
                  )}
                  <div>
                    <label className="block text-sm text-theme-muted mb-1.5">Start Date</label>
                    <input 
                      type="date" 
                      value={startDate}
                      onChange={e => setStartDate(e.target.value)}
                      className="w-full bg-theme-surface border border-theme-border rounded-lg px-3 py-2 text-theme-text focus:outline-none focus:border-theme-accent"
                    />
                  </div>
                </div>
              )}
            </div>
          </div>

          <div className="flex justify-end gap-3 pt-6">
            <button 
              type="button" 
              onClick={onClose}
              className="px-6 py-2.5 rounded-full text-theme-muted hover:bg-theme-border transition-colors font-medium"
            >
              Cancel
            </button>
            <button 
              type="submit"
              className="px-6 py-2.5 rounded-full bg-theme-accent text-theme-bg hover:bg-theme-accent/90 transition-colors font-medium"
            >
              Save Task
            </button>
          </div>
        </form>
      </motion.div>
    </div>
  );
}

