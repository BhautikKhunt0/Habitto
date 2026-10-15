import React, { useState, useRef, useEffect, useMemo } from 'react';
import { useStore } from '../store/useStore';
import { cn } from '../lib/utils';
import { AnimatePresence, motion } from 'framer-motion';
import { Check, Plus, Trash2, GripVertical, ListChecks, CornerDownLeft } from 'lucide-react';
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from '@dnd-kit/core';
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  verticalListSortingStrategy,
  useSortable,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import type { TemporaryTask } from '../types';

interface TemporaryTasksProps {
  listId?: string;
  title?: string;
}

/**
 * A scratch list — things with no schedule behind them.
 *
 * Drag works from anywhere on the row except the controls: a 5px activation
 * distance means a plain click still reaches the name to rename it, while any
 * real movement picks the row up. Transforms are deliberately split across two
 * elements — dnd-kit owns the outer one, Framer Motion the inner — so the two
 * libraries never fight over the same `transform` while a card is in the air.
 */
export const TemporaryTasks: React.FC<TemporaryTasksProps> = ({
  listId = 'temporary',
  title = 'Temporary Tasks',
}) => {
  const [newTaskName, setNewTaskName] = useState('');

  const allTasks = useStore((state) => state.temporaryTasks || []);
  const addTemporaryTask = useStore((state) => state.addTemporaryTask);
  const reorderTemporaryTasks = useStore((state) => state.reorderTemporaryTasks);
  const clearCompletedTemporaryTasks = useStore((state) => state.clearCompletedTemporaryTasks);

  const sortedTasks = useMemo(
    () =>
      allTasks
        .filter((t) => (t.listId || 'temporary') === listId)
        .sort((a, b) => a.order - b.order),
    [allTasks, listId],
  );

  const doneCount = sortedTasks.filter((t) => t.completed).length;
  const hasCompleted = doneCount > 0;

  const sensors = useSensors(
    // A few pixels of travel, so tapping the checkbox never starts a drag.
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;

    const oldIndex = sortedTasks.findIndex((t) => t.id === active.id);
    const newIndex = sortedTasks.findIndex((t) => t.id === over.id);
    if (oldIndex < 0 || newIndex < 0) return;

    reorderTemporaryTasks(
      arrayMove(sortedTasks, oldIndex, newIndex).map((t, i) => ({ ...t, order: i })),
      listId,
    );
  };

  const handleAdd = (e: React.FormEvent) => {
    e.preventDefault();
    const name = newTaskName.trim();
    if (!name) return;
    addTemporaryTask(name, listId);
    setNewTaskName('');
  };

  return (
    <div className="w-full">
      {/* --------------------------------------------------------- header */}
      <div className="mb-7 flex flex-wrap items-end justify-between gap-4">
        <div className="min-w-0">
          <div className="flex items-center gap-2.5">
            <h3 className="truncate font-display text-2xl font-medium tracking-tight text-theme-text">
              {title}
            </h3>
            <span className="rounded-full bg-theme-text/[0.07] px-2 py-0.5 text-[11px] font-semibold tabular-nums text-theme-muted">
              {sortedTasks.length}
            </span>
          </div>
        </div>

        {hasCompleted && (
          <motion.button
            whileHover={{ y: -1 }}
            whileTap={{ scale: 0.97 }}
            onClick={() => clearCompletedTemporaryTasks(listId)}
            className="shrink-0 rounded-full border border-theme-border bg-theme-surface px-3.5 py-1.5 text-[11px] font-medium text-theme-muted shadow-sm transition-colors duration-200 hover:border-theme-text/30 hover:text-theme-text"
          >
            Clear {doneCount} completed
          </motion.button>
        )}
      </div>

      {/* ----------------------------------------------------------- list */}
      <DndContext
        sensors={sensors}
        collisionDetection={closestCenter}
        onDragEnd={handleDragEnd}
      >
        <SortableContext items={sortedTasks.map((t) => t.id)} strategy={verticalListSortingStrategy}>
          <div className="space-y-2.5">
            {sortedTasks.length === 0 ? (
              <div className="rounded-[1.5rem] border border-dashed border-theme-border px-6 py-16 text-center">
                <ListChecks className="mx-auto h-5 w-5 text-theme-muted" strokeWidth={1.5} />
                <p className="mt-4 font-display text-base font-medium text-theme-text">
                  Nothing on this list
                </p>
                <p className="mt-1.5 text-sm text-theme-muted">
                  Errands, one-offs, half-thoughts — add them below.
                </p>
              </div>
            ) : (
              <AnimatePresence initial={false}>
                {sortedTasks.map((task, index) => (
                  <SortableTaskItem key={task.id} task={task} index={index} />
                ))}
              </AnimatePresence>
            )}
          </div>
        </SortableContext>
      </DndContext>

      {/* ------------------------------------------------------- composer */}
      <form onSubmit={handleAdd} className="mt-4">
        <div className="group relative rounded-[1.25rem] border border-theme-border bg-theme-bg shadow-sm transition-colors duration-200 focus-within:border-theme-text/40">
          <Plus className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-theme-muted transition-colors duration-200 group-focus-within:text-theme-text" />
          <input
            type="text"
            value={newTaskName}
            onChange={(e) => setNewTaskName(e.target.value)}
            placeholder={`Add to ${title.toLowerCase()}...`}
            aria-label={`Add a task to ${title}`}
            className="w-full bg-transparent py-3 pl-11 pr-12 text-sm text-theme-text outline-none placeholder:text-theme-muted/50"
          />
          <button
            type="submit"
            disabled={!newTaskName.trim()}
            aria-label="Add task"
            className="absolute right-2.5 top-1/2 flex h-7 w-7 -translate-y-1/2 items-center justify-center rounded-full transition-all duration-200 enabled:bg-theme-text enabled:text-theme-bg enabled:hover:opacity-90 disabled:text-theme-muted/30"
          >
            <CornerDownLeft className="h-3.5 w-3.5" />
          </button>
        </div>
        <p className="mt-2 pl-1 text-[11px] text-theme-muted/70">
          Press <span className="font-medium text-theme-muted">Enter</span> to add · drag any row to
          reorder
        </p>
      </form>
    </div>
  );
};

const SortableTaskItem: React.FC<{ task: TemporaryTask; index: number }> = ({ task, index }) => {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: task.id,
  });

  const toggleTemporaryTask = useStore((state) => state.toggleTemporaryTask);
  const deleteTemporaryTask = useStore((state) => state.deleteTemporaryTask);
  const updateTemporaryTask = useStore((state) => state.updateTemporaryTask);

  const [isEditing, setIsEditing] = useState(false);
  const [editName, setEditName] = useState(task.name);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (isEditing && inputRef.current) inputRef.current.focus();
  }, [isEditing]);

  const handleSave = () => {
    if (editName.trim() && editName !== task.name) {
      updateTemporaryTask(task.id, editName.trim());
    } else {
      setEditName(task.name);
    }
    setIsEditing(false);
  };

  return (
    // Outer: dnd-kit owns this transform and the CSS transition siblings use
    // to slide out of the way.
    <div
      ref={setNodeRef}
      style={{
        transform: CSS.Translate.toString(transform),
        transition,
        zIndex: isDragging ? 20 : undefined,
      }}
      className={cn(
        'drag-row group relative overflow-hidden rounded-[1.25rem] border select-none',
        'transition-[border-color,box-shadow] duration-300',
        task.completed
          ? 'border-theme-accent/35 bg-theme-accent/[0.10]'
          : 'border-theme-border/70 bg-theme-surface hover:border-theme-text/20 hover:shadow-[0_12px_28px_-22px_rgb(0_0_0/0.5)]',
        isDragging &&
          'border-theme-accent/50 shadow-[0_30px_54px_-26px_rgb(0_0_0/0.65)]',
      )}
      {...attributes}
      {...listeners}
    >
      {/* Inner: Framer Motion owns this one, so enter/exit never fights the
          drag transform on the element above. */}
      <motion.div
        initial={{ opacity: 0, scale: 0.97 }}
        animate={{ opacity: isDragging ? 0.35 : 1, scale: isDragging ? 1.012 : 1 }}
        exit={{ opacity: 0, scale: 0.96 }}
        transition={{
          duration: 0.24,
          ease: [0.22, 1, 0.36, 1],
          delay: isDragging ? 0 : Math.min(index * 0.035, 0.3),
        }}
        className="relative flex cursor-grab items-center gap-3 px-3.5 py-3 active:cursor-grabbing"
      >
        {/* hairline of light along the top edge */}
        <span
          aria-hidden
          className="pointer-events-none absolute inset-x-4 top-0 h-px bg-gradient-to-r from-transparent via-white/25 to-transparent"
        />
        {/* accent spine, revealed as the row is hovered */}
        <span
          aria-hidden
          className={cn(
            'pointer-events-none absolute inset-y-2.5 left-0 w-[2.5px] rounded-r-full bg-theme-accent transition-opacity duration-300',
            task.completed ? 'opacity-100' : 'opacity-0 group-hover:opacity-70',
          )}
        />

        <span
          aria-hidden
          className="shrink-0 text-theme-muted opacity-30 transition-opacity duration-200 group-hover:opacity-100"
        >
          <GripVertical className="h-4 w-4" />
        </span>

        <button
          type="button"
          role="checkbox"
          aria-checked={task.completed}
          aria-label={task.completed ? `Mark ${task.name} incomplete` : `Complete ${task.name}`}
          onPointerDown={(e) => e.stopPropagation()}
          onKeyDown={(e) => e.stopPropagation()}
          onClick={() => toggleTemporaryTask(task.id)}
          className={cn(
            'flex h-[22px] w-[22px] shrink-0 items-center justify-center rounded-[8px] border transition-colors duration-200',
            task.completed
              ? 'border-theme-accent bg-theme-accent text-theme-bg'
              : 'border-theme-text/25 hover:border-theme-text/60',
          )}
        >
          <AnimatePresence initial={false}>
            {task.completed && (
              <motion.span
                key="tick"
                initial={{ scale: 0.4, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                exit={{ scale: 0.4, opacity: 0 }}
                transition={{ type: 'spring', stiffness: 560, damping: 30 }}
              >
                <Check className="h-3 w-3" strokeWidth={3.5} />
              </motion.span>
            )}
          </AnimatePresence>
        </button>

        {isEditing ? (
          // Metrics are pinned to match the span exactly — no padding, no
          // border, an explicit line height — so the row cannot resize mid-edit.
          <input
            ref={inputRef}
            type="text"
            value={editName}
            onChange={(e) => setEditName(e.target.value)}
            onPointerDown={(e) => e.stopPropagation()}
            onBlur={handleSave}
            onKeyDown={(e) => {
              // The row is a dnd-kit keyboard draggable, and Space/Enter is how
              // its sensor starts a drag. Without this, typing a space would
              // hijack the key, set aria-disabled, and freeze the row.
              e.stopPropagation();

              if (e.key === 'Enter') handleSave();
              if (e.key === 'Escape') {
                setEditName(task.name);
                setIsEditing(false);
              }
            }}
            className="min-w-0 flex-1 border-0 bg-transparent p-0 font-display text-[15px] leading-6 text-theme-text caret-theme-accent outline-none"
          />
        ) : (
          <span
            onClick={() => setIsEditing(true)}
            title="Click to rename"
            className={cn(
              'min-w-0 flex-1 cursor-text truncate font-display text-[15px] leading-6 transition-colors duration-200',
              task.completed
                ? 'text-theme-muted line-through decoration-theme-muted/40'
                : 'text-theme-text',
            )}
          >
            {task.name}
          </span>
        )}

        <button
          onPointerDown={(e) => e.stopPropagation()}
          onKeyDown={(e) => e.stopPropagation()}
          onClick={() => deleteTemporaryTask(task.id)}
          aria-label={`Delete ${task.name}`}
          className="shrink-0 rounded-full p-1.5 text-theme-muted opacity-0 transition-all duration-200 hover:bg-red-500/10 hover:text-red-500 focus-visible:opacity-100 group-hover:opacity-100"
        >
          <Trash2 className="h-3.5 w-3.5" />
        </button>
      </motion.div>
    </div>
  );
};