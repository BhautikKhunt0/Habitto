export type Frequency =
  | { type: 'daily' }
  | { type: 'alternate'; startDate: string } // "YYYY-MM-DD"
  | { type: 'weekly'; daysOfWeek: number[] } // 0-6 (Sun-Sat)
  | { type: 'custom'; interval: number; startDate: string };

export interface Task {
  id: string;
  name: string;
  category?: string; // replacing channelName
  channelName?: string; // deprecated, for backward compatibility
  color: string;
  icon?: string;
  frequency: Frequency;
  createdAt: string;
  archived: boolean;
  notes?: string;
}

export interface CompletionRecord {
  taskId: string;
  date: string; // "YYYY-MM-DD"
  completedAt: string; // timestamp
}

export interface CustomTheme {
  id: string;
  name: string;
  lightColor: string;
  darkColor: string;
}

export interface AppData {
  tasks: Task[];
  completions: CompletionRecord[];
  version: string;
  quote?: string;
  themeMode?: 'light' | 'dark';
  themeColor?: string;
  themeId?: string;
  customThemes?: CustomTheme[];
  animationsEnabled?: boolean;
}
