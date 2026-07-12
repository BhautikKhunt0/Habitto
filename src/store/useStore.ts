import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { Task, CompletionRecord, AppData, CustomTheme } from '../types';
import { format } from 'date-fns';

export const DEFAULT_THEMES = [
  { id: 'purple', name: 'Purple', lightColor: '#a855f7', darkColor: '#ddb7ff' },
  { id: 'teal', name: 'Teal', lightColor: '#0d9488', darkColor: '#3cddc7' },
  { id: 'orange', name: 'Orange', lightColor: '#ea580c', darkColor: '#fabc4e' },
  { id: 'pink', name: 'Pink', lightColor: '#db2777', darkColor: '#ffb4ab' },
  { id: 'blue', name: 'Blue', lightColor: '#2563eb', darkColor: '#93c5fd' },
  { id: 'green', name: 'Green', lightColor: '#16a34a', darkColor: '#86efac' },
];

interface StoreState extends AppData {
  themeMode: 'light' | 'dark';
  themeColor: string;
  themeId: string;
  customThemes: CustomTheme[];
  quote: string;
  setThemeMode: (mode: 'light' | 'dark') => void;
  setThemeColor: (color: string) => void;
  setThemeId: (id: string) => void;
  addCustomTheme: (theme: CustomTheme) => void;
  deleteCustomTheme: (id: string) => void;
  setQuote: (quote: string) => void;
  addTask: (task: Omit<Task, 'id' | 'createdAt' | 'archived'>) => void;
  updateTask: (id: string, updates: Partial<Task>) => void;
  deleteTask: (id: string, keepHistory: boolean) => void;
  toggleCompletion: (taskId: string, date: string) => void;
  importData: (data: AppData) => void;
  clearData: () => void;
}

export const useStore = create<StoreState>()(
  persist(
    (set, get) => ({
      tasks: [],
      completions: [],
      version: '1.0',
      quote: "Consistency is the only bridge between goals and accomplishment.",
      themeMode: 'dark',
      themeColor: '#ddb7ff',
      themeId: 'purple',
      customThemes: [],
      
      setThemeMode: (themeMode) => set({ themeMode }),
      setThemeColor: (themeColor) => set({ themeColor }),
      setThemeId: (themeId) => set({ themeId }),
      addCustomTheme: (theme) => set((state) => ({ customThemes: [...state.customThemes, theme] })),
      deleteCustomTheme: (id) => set((state) => ({ customThemes: state.customThemes.filter(t => t.id !== id) })),
      setQuote: (quote) => set({ quote }),

      addTask: (taskData) => set((state) => ({
        tasks: [
          ...state.tasks,
          {
            ...taskData,
            id: crypto.randomUUID(),
            createdAt: format(new Date(), 'yyyy-MM-dd'),
            archived: false,
          }
        ]
      })),

      updateTask: (id, updates) => set((state) => ({
        tasks: state.tasks.map(t => t.id === id ? { ...t, ...updates } : t)
      })),

      deleteTask: (id, keepHistory) => set((state) => ({
        tasks: state.tasks.filter(t => t.id !== id),
        completions: keepHistory ? state.completions : state.completions.filter(c => c.taskId !== id)
      })),

      toggleCompletion: (taskId, date) => set((state) => {
        const existing = state.completions.find(c => c.taskId === taskId && c.date === date);
        if (existing) {
          return { completions: state.completions.filter(c => !(c.taskId === taskId && c.date === date)) };
        } else {
          return {
            completions: [
              ...state.completions,
              { taskId, date, completedAt: new Date().toISOString() }
            ]
          };
        }
      }),

      importData: (data) => set(() => ({
        tasks: data.tasks,
        completions: data.completions,
        version: data.version || '1.0',
        quote: data.quote || "Consistency is the only bridge between goals and accomplishment.",
        themeMode: data.themeMode || 'dark',
        themeColor: data.themeColor || '#ddb7ff',
        themeId: data.themeId || 'purple',
        customThemes: data.customThemes || [],
      })),

      clearData: () => set(() => ({ tasks: [], completions: [] }))
    }),
    {
      name: 'habit-tracker-data',
    }
  )
);
