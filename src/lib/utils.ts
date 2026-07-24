import { type ClassValue, clsx } from "clsx";
import { twMerge } from "tailwind-merge";
import { Task, Frequency } from "../types";
import { differenceInDays, parseISO, startOfDay, getDay } from "date-fns";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function hexToRgb(hex: string) {
  const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
  return result ? `${parseInt(result[1], 16)} ${parseInt(result[2], 16)} ${parseInt(result[3], 16)}` : null;
}

export function formatFrequency(frequency: Frequency): string {
  switch (frequency.type) {
    case 'daily': return 'Daily';
    case 'alternate': return 'Every other day';
    case 'weekly': {
      if (frequency.daysOfWeek.length === 7) return 'Every day';
      if (frequency.daysOfWeek.length === 0) return 'No days selected';
      const days = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
      return frequency.daysOfWeek.map(d => days[d]).join(', ');
    }
    case 'custom': return `Every ${frequency.interval} days`;
    default: return 'Custom';
  }
}

export function isTaskScheduledOnDate(task: Task, date: Date | string): boolean {
  if (task.archived) return false;

  const targetDate = typeof date === 'string' ? parseISO(date) : date;
  const targetStart = startOfDay(targetDate);
  const createdStart = startOfDay(parseISO(task.createdAt));

  if (targetStart < createdStart) {
      return false;
  }

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
