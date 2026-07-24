import { MeasuringStrategy } from "@dnd-kit/core";
import { snapCenterToCursor } from "@dnd-kit/modifiers";
import React, { useState, useEffect, useCallback, forwardRef } from 'react';
import { useStore } from '../store/useStore';
import { KanbanTask } from '../types';
import { 
  DndContext, 
  DragOverlay, 
  closestCorners, 
  KeyboardSensor, 
  PointerSensor, 
  useSensor, 
  useSensors, 
  DragStartEvent, 
  DragOverEvent, 
  DragEndEvent, 
  useDroppable,
  defaultDropAnimationSideEffects,
  DragCancelEvent
} from '@dnd-kit/core';
import { 
  arrayMove, 
  SortableContext, 
  sortableKeyboardCoordinates, 
  verticalListSortingStrategy, 
  useSortable 
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { Plus, X, Flag } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { cn } from '../lib/utils';
import { createPortal } from 'react-dom';

const COLUMNS: { id: KanbanTask['status'], title: string }[] = [
  { id: 'todo', title: 'To Do' },
  { id: 'in-progress', title: 'In Progress' },
  { id: 'done', title: 'Done' }
];

export function Kanban() {
  const kanbanTasks = useStore(state => state.kanbanTasks) || [];
  const addKanbanTask = useStore(state => state.addKanbanTask);
  const updateKanbanTask = useStore(state => state.updateKanbanTask);
  const deleteKanbanTask = useStore(state => state.deleteKanbanTask);

  const [activeId, setActiveId] = useState<string | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingTask, setEditingTask] = useState<KanbanTask | null>(null);

  const [columnsData, setColumnsData] = useState<Record<string, KanbanTask[]>>({ 'todo': [], 'in-progress': [], 'done': [] });

  useEffect(() => {
    if (activeId) return;
    const data: Record<string, KanbanTask[]> = { 'todo': [], 'in-progress': [], 'done': [] };
    const sorted = [...kanbanTasks].sort((a, b) => a.order - b.order);
    sorted.forEach(t => {
      if (data[t.status]) {
        data[t.status].push(t);
      }
    });
    setColumnsData(data);
  }, [kanbanTasks, activeId]);

  const findContainer = useCallback((id: string) => {
    if (id === 'todo' || id === 'in-progress' || id === 'done') return id;
    for (const key in columnsData) {
      if (columnsData[key].find(t => t.id === id)) return key;
    }
    return null;
  }, [columnsData]);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  );

  const handleDragStart = (event: DragStartEvent) => {
    setActiveId(event.active.id as string);
  };

  const handleDragOver = (event: DragOverEvent) => {
    const { active, over } = event;
    if (!over) return;

    const activeId = active.id as string;
    const overId = over.id as string;

    const activeContainer = findContainer(activeId);
    const overContainer = findContainer(overId);

    if (!activeContainer || !overContainer || activeContainer === overContainer) {
      return;
    }

    setColumnsData(prev => {
      const activeItems = prev[activeContainer];
      const overItems = prev[overContainer];

      const activeIndex = activeItems.findIndex(t => t.id === activeId);
      const overIndex = overItems.findIndex(t => t.id === overId);

      let newIndex;
      if (overId === 'todo' || overId === 'in-progress' || overId === 'done') {
        newIndex = overItems.length + 1;
      } else {
        const overItemIndex = overItems.findIndex(t => t.id === overId);
        const isBelowOverItem = over && active.rect.current?.translated && active.rect.current?.translated.top > over.rect.top + over.rect.height;
        const modifier = isBelowOverItem ? 1 : 0;
        newIndex = overItemIndex >= 0 ? overItemIndex + modifier : overItems.length + 1;
      }

      const movedItem = { ...activeItems[activeIndex], status: overContainer as KanbanTask['status'] };

      return {
        ...prev,
        [activeContainer]: prev[activeContainer].filter(item => item.id !== activeId),
        [overContainer]: [
          ...prev[overContainer].slice(0, newIndex),
          movedItem,
          ...prev[overContainer].slice(newIndex, prev[overContainer].length)
        ]
      };
    });
  };

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    
    if (!over) {
      setActiveId(null);
      return;
    }

    const activeId = active.id as string;
    const overId = over.id as string;

    const activeContainer = findContainer(activeId);
    const overContainer = findContainer(overId);

    if (!activeContainer || !overContainer) {
      setActiveId(null);
      return;
    }

    if (activeContainer === overContainer) {
      setColumnsData(prev => {
        const items = prev[activeContainer];
        const oldIndex = items.findIndex(t => t.id === activeId);
        const newIndex = items.findIndex(t => t.id === overId);

        let nextColumns = prev;
        if (oldIndex !== newIndex) {
          nextColumns = {
            ...prev,
            [activeContainer]: arrayMove(items, oldIndex, newIndex)
          };
        }

        // Persist ALL columns to store to ensure status and order is correct
        Object.keys(nextColumns).forEach(key => {
          nextColumns[key].forEach((t, i) => {
            updateKanbanTask(t.id, { order: i, status: key as KanbanTask['status'] });
          });
        });

        return nextColumns;
      });
    }

    setActiveId(null);
  };

  const handleDragCancel = (event: DragCancelEvent) => {
    setActiveId(null);
  }

  const getActiveTask = () => {
    if (!activeId) return null;
    for (const key in columnsData) {
      const task = columnsData[key].find(t => t.id === activeId);
      if (task) return task;
    }
    return null;
  };
  const activeTask = getActiveTask();

  return (
    <div className="w-full pt-4 space-y-8 flex flex-col h-full min-h-[calc(100vh-140px)]">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-3xl font-display font-medium text-theme-text">Kanban</h2>
          <p className="text-theme-muted mt-1">Organize and prioritize your tasks.</p>
        </div>
        
        <button
          onClick={() => {
            setEditingTask(null);
            setIsModalOpen(true);
          }}
          className="flex items-center gap-2 bg-theme-text text-theme-bg px-6 py-3 rounded-full hover:opacity-90 transition-opacity font-medium"
        >
          <Plus className="w-5 h-5" />
          <span>New Task</span>
        </button>
      </div>

      <div className="flex-1 flex gap-6 overflow-x-auto pb-4 items-stretch h-full">
        <DndContext
          sensors={sensors}
          collisionDetection={closestCorners}
          onDragStart={handleDragStart}
          onDragOver={handleDragOver}
          onDragEnd={handleDragEnd}
          onDragCancel={handleDragCancel}
          measuring={{ droppable: { strategy: MeasuringStrategy.Always } }}
        >
          {COLUMNS.map(col => (
            <KanbanColumn 
              key={col.id} 
              id={col.id} 
              title={col.title} 
              tasks={columnsData[col.id]} 
              onEdit={(task) => {
                setEditingTask(task);
                setIsModalOpen(true);
              }}
              onDelete={deleteKanbanTask}
            />
          ))}
          <DragOverlay
            adjustScale={false}
            modifiers={[snapCenterToCursor]}
            dropAnimation={{
              sideEffects: defaultDropAnimationSideEffects({ styles: { active: { opacity: '0.4' } } }),
            }}
          >
            {activeTask ? <TaskCard task={activeTask} isOverlay /> : null}
          </DragOverlay>
        </DndContext>
      </div>

      <AnimatePresence>
        {isModalOpen && (
          <TaskModal 
            onClose={() => setIsModalOpen(false)} 
            task={editingTask} 
          />
        )}
      </AnimatePresence>
    </div>
  );
}

function KanbanColumn({ id, title, tasks, onEdit, onDelete, key }: { id: string, title: string, tasks: KanbanTask[], onEdit: (t: KanbanTask) => void, onDelete: (id: string) => void, key?: React.Key }) {
  const { setNodeRef } = useDroppable({
    id: id,
    data: {
      type: 'Column',
      column: { id }
    }
  });

  return (
    <div className="flex-1 min-w-[300px] max-w-[400px] flex flex-col gap-4">
      <div className="flex items-center justify-between mb-2 px-1">
        <h3 className="font-semibold text-theme-text flex items-center gap-2">
          {title}
          <span className="text-xs font-medium bg-theme-surface border border-theme-border text-theme-muted px-2 py-0.5 rounded-full">
            {tasks.length}
          </span>
        </h3>
      </div>
      
      <div ref={setNodeRef} className="flex-1 bg-theme-surface/30 rounded-3xl p-3 border border-theme-border/50 flex flex-col gap-3 min-h-[200px]">
        <SortableContext id={id} items={tasks.map(t => t.id)} strategy={verticalListSortingStrategy}>
          {tasks.map(task => (
            <SortableTask key={task.id} task={task} onEdit={() => onEdit(task)} onDelete={() => onDelete(task.id)} />
          ))}
        </SortableContext>
      </div>
    </div>
  );
}

function SortableTask({ task, onEdit, onDelete, key }: { task: KanbanTask, onEdit: () => void, onDelete: () => void, key?: React.Key }) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging
  } = useSortable({ id: task.id, data: { type: 'Task', task } });

  const style = {
    transform: isDragging ? undefined : CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.3 : 1
  };

  return (
    <TaskCard 
      task={task} 
      onEdit={onEdit} 
      onDelete={onDelete}
      ref={setNodeRef}
      style={style}
      attributes={attributes}
      listeners={listeners}
    />
  );
}

const TaskCard = forwardRef<HTMLDivElement, { task: KanbanTask, isOverlay?: boolean, onEdit?: () => void, onDelete?: () => void, style?: React.CSSProperties, attributes?: any, listeners?: any }>(
  ({ task, isOverlay, onEdit, onDelete, style, attributes, listeners }, ref) => {
    return (
      <div 
        ref={ref}
        style={style}
        {...attributes}
        {...listeners}
        className={cn(
          "w-full touch-none bg-theme-surface border rounded-[1.5rem] p-4 flex flex-col gap-3 group relative cursor-grab active:cursor-grabbing",
          isOverlay ? "border-theme-text/30 shadow-2xl " : "border-theme-border shadow-sm hover:border-theme-text/20 hover:shadow-md transition-all"
        )}
      >
        <div className="flex items-start justify-between gap-2">
          <h4 className="font-medium text-theme-text break-words line-clamp-2 leading-tight">{task.title}</h4>
          {!isOverlay && (
            <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
              <button 
                onPointerDown={(e) => { e.stopPropagation(); onEdit?.(); }}
                className="p-1.5 text-theme-muted hover:text-theme-text rounded-lg hover:bg-theme-bg"
    
          >
                Edit
              </button>
              <button 
                onPointerDown={(e) => { e.stopPropagation(); onDelete?.(); }}
                className="p-1.5 text-red-400 hover:text-red-500 rounded-lg hover:bg-red-500/10"
    
          >
                <X className="w-4 h-4" />
              </button>
            </div>
          )}
        </div>
        
        {task.description && (
          <p className="text-sm text-theme-muted line-clamp-2">{task.description}</p>
        )}

        <div className="flex items-center gap-2 mt-1">
          <span className={cn(
            "text-xs font-semibold px-2.5 py-1 rounded-full flex items-center gap-1",
            task.priority === 'high' ? "bg-red-500/10 text-red-500" :
            task.priority === 'medium' ? "bg-orange-500/10 text-orange-500" :
            "bg-blue-500/10 text-blue-500"
          )}>
            <Flag className="w-3 h-3" />
            <span className="capitalize">{task.priority}</span>
          </span>
        </div>
      </div>
    );
  }
);

function TaskModal({ onClose, task }: { onClose: () => void, task: KanbanTask | null }) {
  const addKanbanTask = useStore(state => state.addKanbanTask);
  const updateKanbanTask = useStore(state => state.updateKanbanTask);
  const kanbanTasks = useStore(state => state.kanbanTasks) || [];

  const [title, setTitle] = useState(task?.title || '');
  const [description, setDescription] = useState(task?.description || '');
  const [priority, setPriority] = useState<KanbanTask['priority']>(task?.priority || 'medium');
  const [status, setStatus] = useState<KanbanTask['status']>(task?.status || 'todo');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) return;

    if (task) {
      updateKanbanTask(task.id, {
        title,
        description,
        priority,
        status
      });
    } else {
      addKanbanTask({
        title,
        description,
        priority,
        status,
        order: kanbanTasks.filter(t => t.status === status).length
      });
    }
    onClose();
  };

  return createPortal(
    <div className="fixed inset-0 z-50 flex items-center justify-center px-4">
      <motion.div 
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        onClick={onClose}
        className="absolute inset-0 bg-theme-bg/80 backdrop-blur-sm"
      />
      <motion.div 
        initial={{ opacity: 0, scale: 0.95, y: 20 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.95, y: 20 }}
        className="bg-theme-surface border border-theme-border w-full max-w-md rounded-[2.5rem] p-8 shadow-2xl relative z-10"
      >
        <div className="flex items-center justify-between mb-8">
          <h2 className="text-2xl font-display font-medium text-theme-text">
            {task ? 'Edit Task' : 'New Task'}
          </h2>
          <button 
            onClick={onClose}
            className="w-10 h-10 rounded-full bg-theme-bg flex items-center justify-center text-theme-muted hover:text-theme-text transition-colors"

          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-6">
          <div className="space-y-2">
            <label className="text-xs font-semibold tracking-widest uppercase text-theme-muted">Title</label>
            <input 
              type="text" 
              value={title}
              onChange={e => setTitle(e.target.value)}
              className="w-full bg-theme-bg border border-theme-border rounded-2xl px-5 py-3 text-theme-text focus:outline-none focus:border-theme-text/30 focus:ring-1 focus:ring-theme-text/30 transition-all"
              placeholder="What needs to be done?"
              autoFocus
            />
          </div>

          <div className="space-y-2">
            <label className="text-xs font-semibold tracking-widest uppercase text-theme-muted">Description (Optional)</label>
            <textarea 
              value={description}
              onChange={e => setDescription(e.target.value)}
              className="w-full bg-theme-bg border border-theme-border rounded-2xl px-5 py-3 text-theme-text focus:outline-none focus:border-theme-text/30 focus:ring-1 focus:ring-theme-text/30 transition-all min-h-[100px] resize-none"
              placeholder="Add details..."
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <label className="text-xs font-semibold tracking-widest uppercase text-theme-muted">Priority</label>
              <select 
                value={priority}
                onChange={e => setPriority(e.target.value as any)}
                className="w-full bg-theme-bg border border-theme-border rounded-2xl px-5 py-3 text-theme-text focus:outline-none focus:border-theme-text/30 focus:ring-1 focus:ring-theme-text/30 transition-all appearance-none"
    
          >
                <option value="low">Low</option>
                <option value="medium">Medium</option>
                <option value="high">High</option>
              </select>
            </div>
            <div className="space-y-2">
              <label className="text-xs font-semibold tracking-widest uppercase text-theme-muted">Status</label>
              <select 
                value={status}
                onChange={e => setStatus(e.target.value as any)}
                className="w-full bg-theme-bg border border-theme-border rounded-2xl px-5 py-3 text-theme-text focus:outline-none focus:border-theme-text/30 focus:ring-1 focus:ring-theme-text/30 transition-all appearance-none"
    
          >
                <option value="todo">To Do</option>
                <option value="in-progress">In Progress</option>
                <option value="done">Done</option>
              </select>
            </div>
          </div>

          <button 
            type="submit"
            disabled={!title.trim()}
            className="w-full bg-theme-text text-theme-bg font-medium py-4 rounded-2xl hover:opacity-90 transition-opacity disabled:opacity-50 disabled:cursor-not-allowed mt-4"

          >
            {task ? 'Save Changes' : 'Create Task'}
          </button>
        </form>
      </motion.div>
    </div>,
    document.body
  );
}
