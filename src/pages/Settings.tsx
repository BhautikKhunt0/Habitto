import React, { useRef, useState } from "react";
import { createPortal } from "react-dom";
import { useStore, DEFAULT_THEMES } from "../store/useStore";
import { Download, Upload, Trash2, AlertCircle, Moon, Sun, Palette, Plus, X } from "lucide-react";
import { AppData, CustomTheme } from "../types";
import { cn } from "../lib/utils";
import { motion, AnimatePresence } from "framer-motion";

export function Settings() {
  const fileInputRef = useRef<HTMLInputElement>(null);
  
  const tasks = useStore((state) => state.tasks);
  const completions = useStore((state) => state.completions);
  const themeMode = useStore((state) => state.themeMode);
  const themeId = useStore((state) => state.themeId);
  const customThemes = useStore((state) => state.customThemes);
  const quote = useStore((state) => state.quote);
  const animationsEnabled = useStore((state) => state.animationsEnabled);
  
  const importData = useStore((state) => state.importData);
  const clearData = useStore((state) => state.clearData);
  const setThemeMode = useStore((state) => state.setThemeMode);
  const setThemeId = useStore((state) => state.setThemeId);
  const addCustomTheme = useStore((state) => state.addCustomTheme);
  const deleteCustomTheme = useStore((state) => state.deleteCustomTheme);
  const setAnimationsEnabled = useStore((state) => state.setAnimationsEnabled);

  const [isClearModalOpen, setIsClearModalOpen] = useState(false);
  const [isAddThemeModalOpen, setIsAddThemeModalOpen] = useState(false);
  const [newThemeName, setNewThemeName] = useState('My Theme');
  const [newThemeLight, setNewThemeLight] = useState('#000000');
  const [newThemeDark, setNewThemeDark] = useState('#ffffff');

  const handleExport = () => {
    const data: AppData = {
      tasks,
      completions,
      version: '1.0',
      themeMode,
      themeId,
      customThemes,
      quote,
      animationsEnabled,
    };
    
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `habitto-backup-${new Date().toISOString().split('T')[0]}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const handleImport = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const content = event.target?.result as string;
        const parsed = JSON.parse(content) as AppData;
        
        if (parsed.tasks && parsed.completions && parsed.version) {
          if (confirm('Importing this file will replace your current data. Are you sure?')) {
            importData(parsed);
          }
        } else {
          alert('Invalid backup file format.');
        }
      } catch (err) {
        alert('Error reading the backup file.');
      }
    };
    reader.readAsText(file);
    
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const handleClear = () => {
    clearData();
    setIsClearModalOpen(false);
  };

  const handleSaveCustomTheme = () => {
    if (!newThemeName.trim()) return;
    const newTheme: CustomTheme = {
      id: crypto.randomUUID(),
      name: newThemeName.trim(),
      lightColor: newThemeLight,
      darkColor: newThemeDark
    };
    addCustomTheme(newTheme);
    setThemeId(newTheme.id);
    setIsAddThemeModalOpen(false);
  };

  const allThemes = [...DEFAULT_THEMES, ...customThemes];

  return (
    <div className="space-y-8 max-w-3xl mx-auto">
      <div>
        <h1 className="text-3xl font-light tracking-wide text-theme-text mb-1">Settings</h1>
        <p className="text-theme-muted">Manage your data and preferences.</p>
      </div>

      <div className="bg-theme-surface border border-theme-border rounded-3xl overflow-hidden transition-all duration-300 hover:shadow-xl dark:hover:shadow-[0_8px_30px_rgb(0,0,0,0.2)] hover:border-theme-accent/30">
        <div className="p-6 md:p-8 border-b border-theme-border">
          <h2 className="text-xl font-medium text-theme-text mb-6 flex items-center gap-2">
            <Palette className="w-5 h-5 text-theme-accent" />
            Appearance
          </h2>
          
          <div className="space-y-8">
            <div>
              <p className="text-theme-muted mb-4 font-medium text-sm uppercase tracking-wider">Mode</p>
              <div className="flex flex-wrap gap-4">
                <button 
                  onClick={() => setThemeMode('light')}
                  className={cn(
                    "flex items-center gap-2 px-6 py-3 rounded-full border transition-all font-medium",
                    themeMode === 'light' 
                      ? "bg-theme-accent/10 border-theme-accent/30 text-theme-accent" 
                      : "bg-theme-bg border-theme-border text-theme-muted hover:border-theme-accent/30"
                  )}
                >
                  <Sun className="w-5 h-5" />
                  <span>Light</span>
                </button>
                <button 
                  onClick={() => setThemeMode('dark')}
                  className={cn(
                    "flex items-center gap-2 px-6 py-3 rounded-full border transition-all font-medium",
                    themeMode === 'dark' 
                      ? "bg-theme-accent/10 border-theme-accent/30 text-theme-accent" 
                      : "bg-theme-bg border-theme-border text-theme-muted hover:border-theme-accent/30"
                  )}
                >
                  <Moon className="w-5 h-5" />
                  <span>Dark</span>
                </button>
              </div>
            </div>

            <div>
              <p className="text-theme-muted mb-4 font-medium text-sm uppercase tracking-wider">Theme Color</p>
              <div className="flex flex-wrap gap-4 items-center">
                {allThemes.map(c => {
                  const activeColor = themeMode === 'light' ? c.lightColor : c.darkColor;
                  return (
                    <button
                      key={c.id}
                      type="button"
                      onClick={() => setThemeId(c.id)}
                      className={cn(
                        "group flex flex-col items-center gap-2 transition-transform relative",
                        themeId === c.id ? "scale-110" : "hover:scale-105"
                      )}
                    >
                      <div 
                        className={cn(
                          "w-12 h-12 rounded-full flex items-center justify-center transition-all",
                          themeId === c.id ? "ring-2 ring-offset-2 ring-offset-theme-bg ring-theme-text shadow-lg" : "ring-1 ring-theme-border shadow-sm"
                        )}
                        style={{ backgroundColor: activeColor }}
                      />
                      <span className={cn(
                        "text-xs font-medium transition-colors max-w-[60px] truncate",
                        themeId === c.id ? "text-theme-text" : "text-theme-muted group-hover:text-theme-text"
                      )}>{c.name}</span>
                      
                      {customThemes.some(t => t.id === c.id) && (
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            deleteCustomTheme(c.id);
                            if (themeId === c.id) setThemeId(DEFAULT_THEMES[0].id);
                          }}
                          className="absolute -top-1 -right-1 w-4 h-4 bg-red-500 rounded-full flex items-center justify-center text-white opacity-0 group-hover:opacity-100 transition-opacity"
                        >
                          <X className="w-3 h-3" />
                        </button>
                      )}
                    </button>
                  );
                })}
                
                <button 
                  onClick={() => setIsAddThemeModalOpen(true)}
                  className="group flex flex-col items-center gap-2 transition-transform hover:scale-105"
                >
                  <div className="w-12 h-12 rounded-full flex items-center justify-center transition-all ring-1 ring-theme-border shadow-sm bg-theme-surface group-hover:border-theme-accent">
                    <Plus className="w-5 h-5 text-theme-muted group-hover:text-theme-text" />
                  </div>
                  <span className="text-xs font-medium text-theme-muted group-hover:text-theme-text transition-colors">Custom</span>
                </button>
              </div>
            </div>
          </div>
        </div>

        <div className="p-6 md:p-8 border-b border-theme-border">
          <h2 className="text-xl font-medium text-theme-text mb-6 flex items-center gap-2">
            <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-theme-accent"><polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"></polygon></svg>
            Preferences
          </h2>
          
          <div className="flex items-center justify-between py-2">
            <div>
              <div className="font-medium text-theme-text">Enable UI Animations</div>
              <div className="text-sm text-theme-muted mt-1">Show fluid transitions and macOS-style dock effects</div>
            </div>
            
            <button
              onClick={() => setAnimationsEnabled(!animationsEnabled)}
              className={cn(
                "relative inline-flex h-6 w-11 items-center rounded-full transition-colors",
                animationsEnabled ? "bg-theme-accent" : "bg-theme-border"
              )}
            >
              <span
                className={cn(
                  "inline-block h-4 w-4 transform rounded-full bg-white transition-transform",
                  animationsEnabled ? "translate-x-6" : "translate-x-1"
                )}
              />
            </button>
          </div>
        </div>

        <div className="p-6 md:p-8 border-b border-theme-border">
          <h2 className="text-xl font-medium text-theme-text mb-4">Data Management</h2>
          <p className="text-theme-muted mb-6 max-w-xl leading-relaxed">
            All your data is stored locally in this browser. To back up your data or move it to another device, use the export and import tools below.
          </p>
          
          <div className="flex flex-col sm:flex-row gap-4">
            <button 
              onClick={handleExport}
              className="flex items-center justify-center gap-2 bg-theme-accent/10 text-theme-accent border border-theme-accent/20 px-6 py-3 rounded-full hover:bg-theme-accent/20 transition-colors font-medium active:scale-95"
            >
              <Download className="w-5 h-5" />
              <span>Export Backup</span>
            </button>
            
            <button 
              onClick={() => fileInputRef.current?.click()}
              className="flex items-center justify-center gap-2 bg-theme-bg text-theme-text border border-theme-border px-6 py-3 rounded-full hover:bg-theme-border transition-colors font-medium active:scale-95"
            >
              <Upload className="w-5 h-5" />
              <span>Import Backup</span>
            </button>
            <input 
              type="file" 
              accept=".json"
              ref={fileInputRef}
              onChange={handleImport}
              className="hidden"
            />
          </div>
        </div>
        
        <div className="p-6 md:p-8 bg-red-500/5">
          <div className="flex gap-4 items-start">
            <div className="w-10 h-10 rounded-full bg-red-500/10 flex items-center justify-center shrink-0 mt-1">
              <AlertCircle className="w-5 h-5 text-red-500" />
            </div>
            <div>
              <h3 className="text-lg font-medium text-red-500 mb-2">Danger Zone</h3>
              <p className="text-red-500/70 mb-4 max-w-xl leading-relaxed">
                Clearing your data will permanently remove all tasks, categories, and completion history from this browser. Please export a backup first if you want to keep your records.
              </p>
              <button 
                onClick={() => setIsClearModalOpen(true)}
                className="flex items-center justify-center gap-2 bg-red-500/10 text-red-500 border border-red-500/20 px-6 py-2.5 rounded-full hover:bg-red-500/20 transition-colors font-medium active:scale-95"
              >
                <Trash2 className="w-4 h-4" />
                <span>Clear All Data</span>
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Clear Data Modal */}
      <AnimatePresence>
        {isClearModalOpen && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
            <motion.div 
              initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              className="absolute inset-0 bg-black/60 backdrop-blur-sm"
              onClick={() => setIsClearModalOpen(false)}
            />
            <motion.div 
              initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.95 }}
              className="relative bg-theme-surface border border-theme-border rounded-3xl p-6 md:p-8 w-full max-w-sm shadow-2xl"
            >
              <h2 className="text-xl font-medium text-theme-text mb-4">Clear all data?</h2>
              <p className="text-theme-muted mb-8">This action cannot be undone. All tasks, categories, and completion history will be permanently deleted.</p>
              <div className="flex justify-end gap-3">
                <button 
                  onClick={() => setIsClearModalOpen(false)}
                  className="px-5 py-2.5 rounded-xl text-theme-muted hover:bg-theme-border transition-colors font-medium"
                >
                  Cancel
                </button>
                <button 
                  onClick={handleClear}
                  className="px-5 py-2.5 rounded-xl bg-red-500/10 text-red-500 hover:bg-red-500/20 transition-colors font-medium"
                >
                  Clear Data
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
      {/* Add Custom Theme Modal */}
      <AnimatePresence>
        {isAddThemeModalOpen && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
            <motion.div 
              initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              className="absolute inset-0 bg-black/60 backdrop-blur-sm"
              onClick={() => setIsAddThemeModalOpen(false)}
            />
            <motion.div 
              initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.95 }}
              className="relative bg-theme-surface border border-theme-border rounded-3xl p-6 md:p-8 w-full max-w-sm shadow-2xl"
            >
              <h2 className="text-xl font-medium text-theme-text mb-6">Create Custom Theme</h2>
              
              <div className="space-y-4 mb-8">
                <div>
                  <label className="block text-sm font-medium text-theme-muted mb-1.5">Theme Name</label>
                  <input 
                    type="text" 
                    value={newThemeName}
                    onChange={e => setNewThemeName(e.target.value)}
                    className="w-full bg-theme-bg border border-theme-border rounded-xl px-4 py-3 text-theme-text focus:outline-none focus:border-theme-accent"
                  />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-theme-muted mb-1.5">Light Mode Color</label>
                    <div className="flex items-center gap-2">
                      <input 
                        type="color" 
                        value={newThemeLight}
                        onChange={e => setNewThemeLight(e.target.value)}
                        className="w-10 h-10 rounded-lg cursor-pointer bg-theme-bg border border-theme-border p-1"
                      />
                      <span className="text-sm text-theme-text uppercase">{newThemeLight}</span>
                    </div>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-theme-muted mb-1.5">Dark Mode Color</label>
                    <div className="flex items-center gap-2">
                      <input 
                        type="color" 
                        value={newThemeDark}
                        onChange={e => setNewThemeDark(e.target.value)}
                        className="w-10 h-10 rounded-lg cursor-pointer bg-theme-bg border border-theme-border p-1"
                      />
                      <span className="text-sm text-theme-text uppercase">{newThemeDark}</span>
                    </div>
                  </div>
                </div>
              </div>
              
              <div className="flex justify-end gap-3">
                <button 
                  onClick={() => setIsAddThemeModalOpen(false)}
                  className="px-5 py-2.5 rounded-xl text-theme-muted hover:bg-theme-border transition-colors font-medium"
                >
                  Cancel
                </button>
                <button 
                  onClick={handleSaveCustomTheme}
                  className="px-5 py-2.5 rounded-xl bg-theme-accent text-theme-bg hover:bg-theme-accent/90 transition-colors font-medium"
                >
                  Save Theme
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
