export type Frequency =
  | { type: 'daily' }
  | { type: 'alternate'; startDate: string } // "YYYY-MM-DD"
  | { type: 'weekly'; daysOfWeek: number[] } // 0-6 (Sun-Sat)
  | { type: 'custom'; interval: number; startDate: string };

export type Priority = 'low' | 'medium' | 'high';

export interface Task {
  id: string;
  name: string;
  category?: string; // replacing channelName
  channelName?: string; // deprecated, for backward compatibility
  color: string;
  icon?: string;
  frequency: Frequency;
  priority?: Priority;
  createdAt: string;
  endDate?: string; // "YYYY-MM-DD"
  archived: boolean;
  notes?: string;
}

export interface CompletionRecord {
  taskId: string;
  date: string; // "YYYY-MM-DD"
  completedAt: string; // timestamp
}

export interface JournalEntry {
  id: string;
  date: string; // "YYYY-MM-DD"
  content: string;
  mood?: 'great' | 'good' | 'neutral' | 'bad' | 'awful';
  createdAt: string;
  updatedAt: string;
}

export interface CustomTheme {
  id: string;
  name: string;
  lightColor: string;
  darkColor: string;
}

export interface KanbanTask {
  id: string;
  title: string;
  description?: string;
  priority: 'low' | 'medium' | 'high';
  status: 'todo' | 'in-progress' | 'done';
  createdAt: string;
  order: number;
}

export interface AppData {
  tasks: Task[];
  completions: CompletionRecord[];
  journalEntries?: JournalEntry[];
  kanbanTasks?: KanbanTask[];
  version: string;
  quote?: string;
  themeMode?: 'light' | 'dark' | 'system';
  themeColor?: string;
  themeId?: string;
  customThemes?: CustomTheme[];
  navPosition?: 'bottom' | 'left' | 'right';
}
