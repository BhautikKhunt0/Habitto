import { useState } from "react";
import { useStore } from "../store/useStore";
import { Task, Frequency } from "../types";
import { Plus, X, Calendar, Search, Edit2 } from "lucide-react";
import { formatFrequency, cn } from "../lib/utils";
import { motion, AnimatePresence } from "framer-motion";

export function Tasks() {
  const tasks = useStore((state) => state.tasks);
  const addTask = useStore((state) => state.addTask);
  const updateTask = useStore((state) => state.updateTask);
  const deleteTask = useStore((state) => state.deleteTask);
  const animationsEnabled = useStore(state => state.animationsEnabled);

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingTask, setEditingTask] = useState<Task | null>(null);
  
  const [searchQuery, setSearchQuery] = useState("");
  const [showArchived, setShowArchived] = useState(false);

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

  return (
    <div className="w-full pt-4">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-10">
        <h2 className="text-3xl font-display font-medium text-theme-text">Tasks</h2>
        
        <div className="flex items-center gap-3 w-full md:w-auto">
          <div className="relative flex-1 md:w-64">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-theme-muted" />
            <input 
              type="text" 
              placeholder="Search..."
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              className="w-full bg-theme-bg border border-theme-border rounded-full pl-11 pr-4 py-2.5 text-sm text-theme-text focus:outline-none focus:border-theme-text transition-colors placeholder:text-theme-muted/50"
            />
          </div>
          <button 
            onClick={() => handleOpenModal()}
            className="flex items-center justify-center w-10 h-10 rounded-full bg-theme-text text-theme-bg hover:opacity-90 transition-opacity shrink-0"
          >
            <Plus className="w-5 h-5" />
          </button>
        </div>
      </div>

      <div className="flex gap-4 mb-8 border-b border-theme-border pb-1">
        <button 
          onClick={() => setShowArchived(false)}
          className={cn(
            "pb-3 text-sm font-medium tracking-wide transition-colors relative",
            !showArchived ? "text-theme-text" : "text-theme-muted hover:text-theme-text"
          )}
        >
          Active
          {!showArchived && <motion.div layoutId="tab-indicator" className="absolute bottom-0 left-0 right-0 h-[2px] bg-theme-text" />}
        </button>
        <button 
          onClick={() => setShowArchived(true)}
          className={cn(
            "pb-3 text-sm font-medium tracking-wide transition-colors relative",
            showArchived ? "text-theme-text" : "text-theme-muted hover:text-theme-text"
          )}
        >
          Archived
          {showArchived && <motion.div layoutId="tab-indicator" className="absolute bottom-0 left-0 right-0 h-[2px] bg-theme-text" />}
        </button>
      </div>

      {filteredTasks.length === 0 ? (
        <div className="text-center py-20 border border-dashed border-theme-border rounded-[2rem]">
          <p className="text-theme-muted text-sm uppercase tracking-widest font-medium mb-4">No tasks found</p>
          {!showArchived && (
            <button 
              onClick={() => handleOpenModal()}
              className="px-6 py-2.5 rounded-full border border-theme-border hover:border-theme-text text-theme-text text-sm font-medium transition-colors"
            >
              Create your first task
            </button>
          )}
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          <AnimatePresence mode="popLayout">
            {filteredTasks.map(task => (
              <motion.div
                layout={animationsEnabled}
                initial={animationsEnabled ? { opacity: 0, scale: 0.95 } : { opacity: 1, scale: 1 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={animationsEnabled ? { opacity: 0, scale: 0.95 } : { opacity: 0, scale: 0.95 }}
                key={task.id}
                className="bg-theme-surface border border-theme-border rounded-[2rem] p-6 group hover:border-theme-text/20 transition-all duration-300 relative flex flex-col justify-between min-h-[160px]"
              >
                <div>
                  <div className="flex justify-between items-start gap-4 mb-2">
                    <h3 className="font-display text-xl font-medium text-theme-text leading-tight">{task.name}</h3>
                  </div>
                  {task.notes && (
                    <p className="text-sm text-theme-muted line-clamp-2 mt-2">{task.notes}</p>
                  )}
                </div>

                <div className="mt-6 flex items-center justify-between">
                  <div className="flex flex-wrap items-center gap-x-3 gap-y-2 text-[11px] font-semibold tracking-widest uppercase text-theme-muted">
                    {task.priority && (
                      <span className={cn(
                        "px-2 py-0.5 rounded-md",
                        task.priority === 'high' ? "bg-red-500/10 text-red-500" :
                        task.priority === 'medium' ? "bg-orange-500/10 text-orange-500" :
                        "bg-green-500/10 text-green-500"
                      )}>{task.priority}</span>
                    )}
                    {(task.category || task.channelName) && <span>{task.category || task.channelName}</span>}
                    <span className="w-1 h-1 rounded-full bg-theme-border" />
                    <span>{formatFrequency(task.frequency)}</span>
                  </div>
                  
                  <button 
                    onClick={() => handleOpenModal(task)}
                    className="w-8 h-8 rounded-full border border-theme-border flex items-center justify-center text-theme-text hover:bg-theme-text hover:text-theme-bg transition-colors opacity-0 group-hover:opacity-100"
                  >
                    <Edit2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              </motion.div>
            ))}
          </AnimatePresence>
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

function TaskModal({ 
  task: editingTask, 
  onClose, 
  onSave, 
  onDelete, 
  onToggleArchive 
}: { 
  task: Task | null, 
  onClose: () => void, 
  onSave: (data: any) => void,
  onDelete?: () => void,
  onToggleArchive?: () => void
}) {
  const [name, setName] = useState(editingTask?.name || "");
  const [category, setCategory] = useState(editingTask?.category || editingTask?.channelName || "");
  const [freqType, setFreqType] = useState<string>(editingTask?.frequency.type || 'daily');
  const [endDate, setEndDate] = useState(editingTask?.endDate || "");
  const [notes, setNotes] = useState(editingTask?.notes || "");
  const [priority, setPriority] = useState<string>(editingTask?.priority || "medium");
  
  const [selectedDays, setSelectedDays] = useState<number[]>(
    editingTask?.frequency.type === 'weekly' ? editingTask.frequency.daysOfWeek : []
  );
  
  const [interval, setIntervalVal] = useState<number>(
    editingTask?.frequency.type === 'custom' ? editingTask.frequency.interval : 2
  );

  const handleSave = () => {
    if (!name.trim()) return;

    let frequency: Frequency;
    const nowStr = new Date().toISOString().split('T')[0];

    if (freqType === 'daily') {
      frequency = { type: 'daily' };
    } else if (freqType === 'weekly') {
      frequency = { type: 'weekly', daysOfWeek: selectedDays.length > 0 ? selectedDays : [1] };
    } else if (freqType === 'alternate') {
      frequency = { type: 'alternate', startDate: nowStr };
    } else {
      frequency = { type: 'custom', interval, startDate: nowStr };
    }

    onSave({
      name: name.trim(),
      category: category.trim(),
      frequency,
      priority: priority as any,
      color: '#111111',
      notes: notes.trim(),
      ...(endDate ? { endDate } : {})
    });
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
      <motion.div 
        initial={{ opacity: 0 }} 
        animate={{ opacity: 1 }} 
        exit={{ opacity: 0 }}
        className="absolute inset-0 bg-black/30 backdrop-blur-md"
        onClick={onClose}
      />
      <motion.div 
        initial={{ opacity: 0, scale: 0.95, y: 10 }} 
        animate={{ opacity: 1, scale: 1, y: 0 }} 
        exit={{ opacity: 0, scale: 0.95, y: 10 }}
        className="relative bg-theme-surface border border-theme-border rounded-[2.5rem] w-full max-w-lg shadow-2xl flex flex-col max-h-[90vh] overflow-hidden"
      >
        <div className="flex items-center justify-between p-6 md:p-8 border-b border-theme-border">
          <h2 className="text-xl font-display font-medium text-theme-text">{editingTask ? 'Edit Task' : 'New Task'}</h2>
          <button onClick={onClose} className="p-2 -mr-2 text-theme-muted hover:text-theme-text transition-colors rounded-full hover:bg-theme-bg">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-6 md:p-8 space-y-8">
          
          <div className="space-y-4">
            <div>
              <input 
                type="text" 
                value={name}
                onChange={e => setName(e.target.value)}
                placeholder="Task name"
                className="w-full bg-transparent border-b-2 border-theme-border focus:border-theme-text px-0 py-3 text-2xl font-display font-medium text-theme-text focus:outline-none transition-colors placeholder:text-theme-muted/50"
                autoFocus
              />
            </div>
            <div>
              <input 
                type="text" 
                value={category}
                onChange={e => setCategory(e.target.value)}
                placeholder="Category (Optional)"
                className="w-full bg-theme-bg border border-theme-border rounded-2xl px-4 py-3 text-sm text-theme-text focus:outline-none focus:border-theme-text transition-colors"
              />
            </div>
          </div>

          <div className="space-y-4">
            <label className="block text-xs font-semibold tracking-widest uppercase text-theme-muted">Frequency</label>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
              {(['daily', 'alternate', 'weekly', 'custom'] as const).map(type => (
                <button
                  key={type}
                  onClick={() => setFreqType(type)}
                  className={cn(
                    "px-4 py-3 rounded-2xl text-sm font-medium transition-colors border",
                    freqType === type 
                      ? "bg-theme-text text-theme-bg border-theme-text" 
                      : "bg-theme-bg text-theme-text border-theme-border hover:border-theme-text/30"
                  )}
                >
                  {type === 'alternate' ? 'Alternate' : type.charAt(0).toUpperCase() + type.slice(1)}
                </button>
              ))}
            </div>

            {freqType === 'weekly' && (
              <div className="pt-2 flex flex-wrap gap-2">
                {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map((day, idx) => (                  <button
                    key={day}
                    onClick={() => {
                      if (selectedDays.includes(idx)) {
                        setSelectedDays(selectedDays.filter(d => d !== idx));
                      } else {
                        setSelectedDays([...selectedDays, idx]);
                      }
                    }}
                    className={cn(
                      "w-10 h-10 rounded-full text-sm font-medium transition-colors border",
                      selectedDays.includes(idx) 
                        ? "bg-theme-text text-theme-bg border-theme-text" 
                        : "bg-theme-bg text-theme-text border-theme-border hover:border-theme-text/30"
                    )}
                  >
                    {day.charAt(0)}
                  </button>
                ))}
              </div>
            )}

            {freqType === 'custom' && (
              <div className="pt-2 flex items-center gap-3">
                <span className="text-theme-text text-sm">Every</span>
                <input 
                  type="number" 
                  min="2" 
                  max="365"
                  value={interval}
                  onChange={e => setIntervalVal(parseInt(e.target.value) || 2)}
                  className="w-20 bg-theme-bg border border-theme-border rounded-xl px-3 py-2 text-center text-theme-text focus:outline-none focus:border-theme-text"
                />
                <span className="text-theme-text text-sm">days</span>
              </div>
            )}
            
          </div>

          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-semibold tracking-widest uppercase text-theme-muted mb-2">Priority</label>
                <div className="flex bg-theme-bg border border-theme-border rounded-2xl p-1">
                  {(['low', 'medium', 'high'] as const).map(p => (
                    <button
                      key={p}
                      onClick={() => setPriority(p)}
                      className={cn(
                        "flex-1 py-2 text-sm font-medium rounded-xl transition-colors capitalize",
                        priority === p ? "bg-theme-text text-theme-bg shadow-sm" : "text-theme-muted hover:text-theme-text"
                      )}
                    >
                      {p}
                    </button>
                  ))}
                </div>
              </div>
              <div>
                <label className="block text-xs font-semibold tracking-widest uppercase text-theme-muted mb-2">End Date (Optional)</label>
                <div className="relative">
                  <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-theme-muted" />
                  <input 
                    type="date" 
                    value={endDate}
                    onChange={e => setEndDate(e.target.value)}
                    className="w-full bg-theme-bg border border-theme-border rounded-2xl pl-10 pr-4 py-3 text-sm text-theme-text focus:outline-none focus:border-theme-text transition-colors"
                  />
                </div>
              </div>
            </div>
            
            <div>
              <label className="block text-xs font-semibold tracking-widest uppercase text-theme-muted mb-2">Notes</label>
              <textarea 
                value={notes}
                onChange={e => setNotes(e.target.value)}
                placeholder="Optional details..."
                className="w-full bg-theme-bg border border-theme-border rounded-2xl px-4 py-3 text-sm text-theme-text focus:outline-none focus:border-theme-text transition-colors min-h-[80px]"
              />
            </div>
          </div>
        </div>

        <div className="p-6 md:p-8 border-t border-theme-border bg-theme-surface flex items-center justify-between gap-4">
          {editingTask ? (
            <div className="flex items-center gap-2">
              <button 
                onClick={onDelete}
                className="px-4 py-3 rounded-full text-sm font-medium text-red-500 bg-red-500/10 hover:bg-red-500/20 transition-colors"
              >
                Delete
              </button>
              <button 
                onClick={onToggleArchive}
                className="px-4 py-3 rounded-full text-sm font-medium text-theme-text bg-theme-bg border border-theme-border hover:border-theme-text/30 transition-colors"
              >
                {editingTask.archived ? 'Unarchive' : 'Archive'}
              </button>
            </div>
          ) : <div />}
          
          <button 
            onClick={handleSave}
            disabled={!name.trim()}
            className="px-8 py-3 rounded-full bg-theme-text text-theme-bg text-sm font-medium hover:opacity-90 transition-opacity disabled:opacity-50 disabled:cursor-not-allowed"
          >
            Save Task
          </button>
        </div>
      </motion.div>
    </div>
  );
}
