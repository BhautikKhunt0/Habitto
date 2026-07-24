import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { Task, CompletionRecord, AppData, CustomTheme, JournalEntry } from '../types';
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
  themeMode: 'light' | 'dark' | 'system';
  themeColor: string;
  themeId: string;
  customThemes: CustomTheme[];
  journalEntries: JournalEntry[];
  quote: string;
  animationsEnabled: boolean;
  navPosition: 'bottom' | 'left' | 'right';
  setThemeMode: (mode: 'light' | 'dark' | 'system') => void;
  setThemeColor: (color: string) => void;
  setThemeId: (id: string) => void;
  addCustomTheme: (theme: CustomTheme) => void;
  updateCustomTheme: (id: string, theme: CustomTheme) => void;
  deleteCustomTheme: (id: string) => void;
  setQuote: (quote: string) => void;
  setAnimationsEnabled: (enabled: boolean) => void;
  setNavPosition: (position: 'bottom' | 'left' | 'right') => void;
  addTask: (task: Omit<Task, 'id' | 'createdAt' | 'archived'>) => void;
  updateTask: (id: string, updates: Partial<Task>) => void;
  deleteTask: (id: string, keepHistory: boolean) => void;
  toggleCompletion: (taskId: string, date: string) => void;
  
  addJournalEntry: (entry: Omit<JournalEntry, 'id' | 'createdAt' | 'updatedAt'>) => void;
  updateJournalEntry: (id: string, updates: Partial<JournalEntry>) => void;
  deleteJournalEntry: (id: string) => void;

  importData: (data: AppData) => void;
  clearData: () => void;
}

export const useStore = create<StoreState>()(
  persist(
    (set, get) => ({
      tasks: [],
      completions: [],
      journalEntries: [],
      version: '1.0',
      quote: "Consistency is the only bridge between goals and accomplishment.",
      themeMode: 'dark',
      themeColor: '#ddb7ff',
      themeId: 'purple',
      customThemes: [],
      animationsEnabled: true,
      navPosition: 'bottom',
      
      setThemeMode: (themeMode) => set({ themeMode }),
      setThemeColor: (themeColor) => set({ themeColor }),
      setThemeId: (themeId) => set({ themeId }),
      addCustomTheme: (theme) => set((state) => ({ customThemes: [...state.customThemes, theme] })),
      updateCustomTheme: (id, theme) => set((state) => ({
        customThemes: state.customThemes.map(t => t.id === id ? theme : t)
      })),
      deleteCustomTheme: (id) => set((state) => ({
        customThemes: state.customThemes.filter(t => t.id !== id),
        themeId: state.themeId === id ? 'purple' : state.themeId
      })),
      setQuote: (quote) => set({ quote }),
      setAnimationsEnabled: (animationsEnabled) => set({ animationsEnabled }),
      setNavPosition: (navPosition) => set({ navPosition }),

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

      addJournalEntry: (entryData) => set((state) => ({
        journalEntries: [
          ...state.journalEntries,
          {
            ...entryData,
            id: crypto.randomUUID(),
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString()
          }
        ]
      })),

      updateJournalEntry: (id, updates) => set((state) => ({
        journalEntries: state.journalEntries.map(e => e.id === id ? { ...e, ...updates, updatedAt: new Date().toISOString() } : e)
      })),

      deleteJournalEntry: (id) => set((state) => ({
        journalEntries: state.journalEntries.filter(e => e.id !== id)
      })),

      importData: (data) => set(() => ({
        tasks: data.tasks,
        completions: data.completions,
        journalEntries: data.journalEntries || [],
        version: data.version || '1.0',
        quote: data.quote || "Consistency is the only bridge between goals and accomplishment.",
        themeMode: data.themeMode || 'dark',
        themeColor: data.themeColor || '#ddb7ff',
        themeId: data.themeId || 'purple',
        customThemes: data.customThemes || [],
        animationsEnabled: data.animationsEnabled !== undefined ? data.animationsEnabled : true,
        navPosition: data.navPosition || 'bottom',
      })),

      clearData: () => set(() => ({ tasks: [], completions: [], journalEntries: [] }))
    }),
    {
      name: 'habit-tracker-data',
    }
  )
);
