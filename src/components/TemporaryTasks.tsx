import React, { useState, useRef, useEffect } from 'react';
import { useStore } from '../store/useStore';
import { cn } from '../lib/utils';
import { Check, Plus, Trash2, GripVertical, Edit2 } from 'lucide-react';
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  DragEndEvent,
} from '@dnd-kit/core';
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  verticalListSortingStrategy,
  useSortable,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { TemporaryTask } from '../types';

interface TemporaryTasksProps {
  listId?: string;
  title?: string;
  isCustomList?: boolean;
  onRenameList?: (newName: string) => void;
  onDeleteList?: () => void;
}

export const TemporaryTasks: React.FC<TemporaryTasksProps> = ({
  listId = 'temporary',
  title = 'Temporary Tasks',
  isCustomList = false,
  onRenameList,
  onDeleteList,
}) => {
  const [newTaskName, setNewTaskName] = useState('');
  const [isEditingTitle, setIsEditingTitle] = useState(false);
  const [editedTitle, setEditedTitle] = useState(title);
  const titleInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    setEditedTitle(title);
  }, [title]);

  useEffect(() => {
    if (isEditingTitle && titleInputRef.current) {
      titleInputRef.current.focus();
      titleInputRef.current.select();
    }
  }, [isEditingTitle]);

  const handleTitleSave = () => {
    if (editedTitle.trim() && editedTitle !== title && onRenameList) {
      onRenameList(editedTitle.trim());
    } else {
      setEditedTitle(title);
    }
    setIsEditingTitle(false);
  };
  
  const allTasks = useStore((state) => state.temporaryTasks || []);
  const temporaryTasks = allTasks.filter((t) => (t.listId || 'temporary') === listId);
  const addTemporaryTask = useStore((state) => state.addTemporaryTask);
  const reorderTemporaryTasks = useStore((state) => state.reorderTemporaryTasks);
  const clearCompletedTemporaryTasks = useStore((state) => state.clearCompletedTemporaryTasks);

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 5,
      },
    }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    
    if (over && active.id !== over.id) {
      const oldIndex = sortedTasks.findIndex((t) => t.id === active.id);
      const newIndex = sortedTasks.findIndex((t) => t.id === over.id);
      
      const newTasks = arrayMove(sortedTasks, oldIndex, newIndex).map((t, i) => ({
        ...t,
        order: i,
      }));
      
      reorderTemporaryTasks(newTasks, listId);
    }
  };

  const handleAdd = (e: React.FormEvent) => {
    e.preventDefault();
    if (newTaskName.trim()) {
      addTemporaryTask(newTaskName.trim(), listId);
      setNewTaskName('');
    }
  };

  const sortedTasks = [...temporaryTasks].sort((a, b) => a.order - b.order);
  const hasCompleted = sortedTasks.some(t => t.completed);

  return (
    <div className="w-full">
      <div className="flex items-center justify-between mb-6 pl-6 pr-2">
        <div className="flex items-center gap-3">
          {isEditingTitle ? (
            <input
              ref={titleInputRef}
              type="text"
              value={editedTitle}
              onChange={(e) => setEditedTitle(e.target.value)}
              onBlur={handleTitleSave}
              onKeyDown={(e) => {
                if (e.key === 'Enter') handleTitleSave();
                if (e.key === 'Escape') {
                  setEditedTitle(title);
                  setIsEditingTitle(false);
                }
              }}
              className="text-xl font-display font-medium text-theme-text bg-transparent border-b border-theme-text focus:outline-none px-0 py-0.5"
            />
          ) : (
            <h3 
              onClick={() => isCustomList && onRenameList && setIsEditingTitle(true)}
              className={cn(
                "text-xl font-display font-medium text-theme-text flex items-center gap-2",
                isCustomList && "cursor-pointer group"
              )}
            >
              <span>{title}</span>
              {isCustomList && onRenameList && (
                <Edit2 className="w-3.5 h-3.5 text-theme-muted opacity-0 group-hover:opacity-100 transition-opacity" />
              )}
            </h3>
          )}
          {isCustomList && onDeleteList && (
            <button
              onClick={() => {
                if (window.confirm(`Are you sure you want to delete the "${title}" tab and all its tasks?`)) {
                  onDeleteList();
                }
              }}
              title="Delete this tab"
              className="p-1 text-theme-muted hover:text-red-500 rounded-lg hover:bg-red-500/10 transition-colors"
            >
              <Trash2 className="w-4 h-4" />
            </button>
          )}
        </div>

        {hasCompleted && (
          <button 
            onClick={() => clearCompletedTemporaryTasks(listId)}
            className="text-xs font-medium text-theme-muted hover:text-theme-text transition-colors flex items-center gap-1"
          >
            Clear completed
          </button>
        )}
      </div>

      <DndContext
        sensors={sensors}
        collisionDetection={closestCenter}
        onDragEnd={handleDragEnd}
      >
        <SortableContext
          items={sortedTasks.map(t => t.id)}
          strategy={verticalListSortingStrategy}
        >
          <div className="space-y-1.5 mb-6 pl-6">
            {sortedTasks.length === 0 ? (
              <p className="text-sm text-theme-muted/60 italic py-2">No tasks in this list yet.</p>
            ) : (
              sortedTasks.map((task) => (
                <SortableTaskItem key={task.id} task={task} />
              ))
            )}
          </div>
        </SortableContext>
      </DndContext>

      <form onSubmit={handleAdd} className="relative ml-6">
        <input
          type="text"
          value={newTaskName}
          onChange={(e) => setNewTaskName(e.target.value)}
          placeholder={`Add task to ${title}...`}
          className="w-full bg-transparent border-b border-theme-border/50 px-2 py-2 text-sm text-theme-text placeholder-theme-muted/50 focus:outline-none focus:border-theme-text transition-colors"
        />
        <button
          type="submit"
          disabled={!newTaskName.trim()}
          className="absolute right-0 top-1/2 -translate-y-1/2 p-1 text-theme-muted hover:text-theme-text disabled:opacity-50 transition-colors"
        >
          <Plus className="w-4 h-4" />
        </button>
      </form>
    </div>
  );
}

const SortableTaskItem: React.FC<{ task: TemporaryTask }> = ({ task }) => {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: task.id });

  const toggleTemporaryTask = useStore((state) => state.toggleTemporaryTask);
  const deleteTemporaryTask = useStore((state) => state.deleteTemporaryTask);
  const updateTemporaryTask = useStore((state) => state.updateTemporaryTask);

  const [isEditing, setIsEditing] = useState(false);
  const [editName, setEditName] = useState(task.name);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (isEditing && inputRef.current) {
      inputRef.current.focus();
    }
  }, [isEditing]);

  const handleSave = () => {
    if (editName.trim() && editName !== task.name) {
      updateTemporaryTask(task.id, editName.trim());
    } else {
      setEditName(task.name);
    }
    setIsEditing(false);
  };

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    zIndex: isDragging ? 10 : 1,
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={cn(
        "group flex items-center gap-3 py-1.5 px-2 -ml-2 rounded-lg transition-colors relative",
        isDragging && "opacity-75 bg-theme-text/5"
      )}
    >
      <div 
        {...attributes} 
        {...listeners}
        className="cursor-grab active:cursor-grabbing text-theme-muted hover:text-theme-text opacity-0 group-hover:opacity-100 transition-opacity absolute -left-5 p-1"
      >
        <GripVertical className="w-3.5 h-3.5" />
      </div>

      <div className="relative flex items-center justify-center shrink-0 cursor-pointer" onClick={() => toggleTemporaryTask(task.id)}>
        <input 
          type="checkbox" 
          checked={task.completed}
          readOnly
          className="peer sr-only"
        />
        <div className={cn(
          "w-4 h-4 rounded-full border-[1.5px] transition-all duration-300 flex items-center justify-center",
          task.completed 
            ? "border-theme-text bg-theme-text" 
            : "border-theme-text/30 bg-transparent peer-hover:border-theme-text/60"
        )}>
          <Check className={cn(
            "w-2.5 h-2.5 text-theme-bg transition-transform duration-300",
            task.completed ? "scale-100" : "scale-0"
          )} strokeWidth={3} />
        </div>
      </div>

      {isEditing ? (
        <input
          ref={inputRef}
          type="text"
          value={editName}
          onChange={(e) => setEditName(e.target.value)}
          onBlur={handleSave}
          onKeyDown={(e) => {
            if (e.key === 'Enter') handleSave();
            if (e.key === 'Escape') {
              setEditName(task.name);
              setIsEditing(false);
            }
          }}
          className="flex-1 min-w-0 bg-transparent border-b border-theme-text/30 focus:border-theme-text text-sm text-theme-text focus:outline-none px-0 py-0"
        />
      ) : (
        <span 
          onClick={() => setIsEditing(true)}
          className={cn(
            "flex-1 min-w-0 text-sm truncate transition-colors cursor-text hover:bg-theme-text/5 px-1 -ml-1 rounded",
            task.completed ? "text-theme-muted line-through decoration-theme-muted/50" : "text-theme-text"
          )}
        >
          {task.name}
        </span>
      )}

      <button
        onClick={() => deleteTemporaryTask(task.id)}
        className="p-1 text-theme-muted hover:text-red-500 opacity-0 group-hover:opacity-100 transition-all shrink-0"
      >
        <Trash2 className="w-3.5 h-3.5" />
      </button>
    </div>
  );
};
