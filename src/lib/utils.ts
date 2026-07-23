import { type ClassValue, clsx } from "clsx";
import { twMerge } from "tailwind-merge";
import { Task } from "../types";
import { differenceInDays, parseISO, startOfDay, getDay } from "date-fns";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function hexToRgb(hex: string) {
  const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
  return result ? `${parseInt(result[1], 16)} ${parseInt(result[2], 16)} ${parseInt(result[3], 16)}` : null;
}

export function isTaskScheduledOnDate(task: Task, date: Date | string): boolean {
  if (task.archived) return false;

  const targetDate = typeof date === 'string' ? parseISO(date) : date;
  const targetStart = startOfDay(targetDate);
  const createdStart = startOfDay(parseISO(task.createdAt));

  // If the target date is before the task was created, it's not scheduled.
  if (targetStart < createdStart) {
      return false;
  }

  // If the task has an end date and the target date is after it, it's not scheduled.
  if (task.endDate) {
    const endDateStart = startOfDay(parseISO(task.endDate));
    if (targetStart > endDateStart) {
      return false;
    }
  }

  const { frequency } = task;

  switch (frequency.type) {
    case 'daily':
      return true;
    case 'alternate': {
      const startDate = startOfDay(parseISO(frequency.startDate));
      if (targetStart < startDate) return false;
      const daysDiff = differenceInDays(targetStart, startDate);
      return daysDiff % 2 === 0;
    }
    case 'weekly': {
      const dayOfWeek = getDay(targetStart);
      return frequency.daysOfWeek.includes(dayOfWeek);
    }
    case 'custom': {
      const startDate = startOfDay(parseISO(frequency.startDate));
      if (targetStart < startDate) return false;
      const daysDiff = differenceInDays(targetStart, startDate);
      return daysDiff % frequency.interval === 0;
    }
    default:
      return false;
  }
}
