import { useState, useRef, ChangeEvent } from "react";
import { useStore, DEFAULT_THEMES } from "../store/useStore";
import { Trash2, Download, Upload, AlertCircle, Moon, Sun, Monitor, Palette, Check } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { cn } from "../lib/utils";
import { createPortal } from "react-dom";

export function Settings() {
  const {
    tasks, completions,
    themeMode, setThemeMode,
    themeId, setThemeId,
    customThemes, addCustomTheme, deleteCustomTheme,
    animationsEnabled, setAnimationsEnabled
  } = useStore();
  
  const [isClearModalOpen, setIsClearModalOpen] = useState(false);
  const [isAddThemeModalOpen, setIsAddThemeModalOpen] = useState(false);
  const [editingThemeId, setEditingThemeId] = useState<string | null>(null);
  
  const [newThemeName, setNewThemeName] = useState("");
  const [newThemeLight, setNewThemeLight] = useState("#000000");
  const [newThemeDark, setNewThemeDark] = useState("#ffffff");

  const openEditModal = (theme: any) => {
    setEditingThemeId(theme.id);
    setNewThemeName(theme.name);
    setNewThemeLight(theme.lightColor);
    setNewThemeDark(theme.darkColor);
    setIsAddThemeModalOpen(true);
  };

  const openAddModal = () => {
    setEditingThemeId(null);
    setNewThemeName("");
    setNewThemeLight("#000000");
    setNewThemeDark("#ffffff");
    setIsAddThemeModalOpen(true);
  };

  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleExport = () => {
    const data = { tasks, completions };
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

  const handleImport = (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const json = JSON.parse(event.target?.result as string);
        if (json.tasks && json.completions) {
          useStore.setState({ tasks: json.tasks, completions: json.completions });
          alert("Data imported successfully!");
        } else {
          alert("Invalid backup file format.");
        }
      } catch (err) {
        alert("Error parsing backup file.");
      }
    };
    reader.readAsText(file);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const handleClear = () => {
    useStore.setState({ tasks: [], completions: [] });
    setIsClearModalOpen(false);
  };

  const handleSaveCustomTheme = () => {
    if (newThemeName.trim()) {
      if (editingThemeId) {
        useStore.getState().updateCustomTheme(editingThemeId, {
          id: editingThemeId,
          name: newThemeName.trim(),
          lightColor: newThemeLight,
          darkColor: newThemeDark
        });
      } else {
        addCustomTheme({
          id: crypto.randomUUID(),
          name: newThemeName.trim(),
          lightColor: newThemeLight,
          darkColor: newThemeDark
        });
      }
      setIsAddThemeModalOpen(false);
      setNewThemeName("");
      setEditingThemeId(null);
    }
  };

  const handleDeleteCustomTheme = () => {
    if (editingThemeId) {
      deleteCustomTheme(editingThemeId);
      setIsAddThemeModalOpen(false);
      setEditingThemeId(null);
    }
  };

  const allThemes = [...DEFAULT_THEMES, ...customThemes];

  return (
    <div className="w-full pt-4 space-y-12">
      <div>
        <h2 className="text-3xl font-display font-medium text-theme-text">Settings</h2>
      </div>

      <div className="bg-theme-surface border border-theme-border rounded-[2rem] overflow-hidden">
        
        <div className="p-8 md:p-10 border-b border-theme-border">
          <h2 className="text-xl font-display font-medium text-theme-text mb-6">Appearance</h2>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
            <div>
              <label className="block text-xs font-semibold tracking-widest uppercase text-theme-muted mb-4">Color Theme</label>
              <div className="grid grid-cols-3 gap-3">
                <button
                  onClick={() => setThemeMode('light')}
                  className={cn(
                    "flex flex-col items-center gap-3 p-4 rounded-2xl border transition-all",
                    themeMode === 'light' ? "border-theme-text bg-theme-bg" : "border-theme-border hover:bg-theme-bg/50"
                  )}
                >
                  <Sun className="w-6 h-6" />
                  <span className="text-sm font-medium">Light</span>
                </button>
                <button
                  onClick={() => setThemeMode('dark')}
                  className={cn(
                    "flex flex-col items-center gap-3 p-4 rounded-2xl border transition-all",
                    themeMode === 'dark' ? "border-theme-text bg-theme-bg" : "border-theme-border hover:bg-theme-bg/50"
                  )}
                >
                  <Moon className="w-6 h-6" />
                  <span className="text-sm font-medium">Dark</span>
                </button>
                <button
                  onClick={() => setThemeMode('system')}
                  className={cn(
                    "flex flex-col items-center gap-3 p-4 rounded-2xl border transition-all",
                    themeMode === 'system' ? "border-theme-text bg-theme-bg" : "border-theme-border hover:bg-theme-bg/50"
                  )}
                >
                  <Monitor className="w-6 h-6" />
                  <span className="text-sm font-medium">System</span>
                </button>
              </div>
            </div>

            <div>
              <div className="flex items-center justify-between mb-4">
                <label className="block text-xs font-semibold tracking-widest uppercase text-theme-muted">Accent Color</label>
              </div>
              <div className="flex flex-col gap-4">
                <div className="flex flex-wrap gap-3">
                  {DEFAULT_THEMES.map(theme => (
                    <button
                      key={theme.id}
                      onClick={() => setThemeId(theme.id)}
                      className={cn(
                        "w-12 h-12 rounded-full flex items-center justify-center transition-transform",
                        themeId === theme.id ? "scale-110 ring-2 ring-offset-2 ring-offset-theme-surface ring-theme-text" : "hover:scale-110"
                      )}
                      style={{ backgroundColor: themeMode === 'light' ? theme.lightColor : theme.darkColor }}
                      title={theme.name}
                    >
                      {themeId === theme.id && <Check className="w-5 h-5 text-white" />}
                    </button>
                  ))}
                </div>

                {customThemes.length > 0 && (
                  <>
                    <div className="h-px bg-theme-border w-full my-1" />
                    <label className="block text-[10px] font-semibold tracking-widest uppercase text-theme-muted">Custom Themes</label>
                    <div className="flex flex-wrap gap-3">
                      {customThemes.map((theme, i) => {
                        const baseId = theme.id || `custom-${i}`;
                        const isDuplicate = customThemes.findIndex(t => t.id === theme.id) !== i;
                        const isDefaultConflict = DEFAULT_THEMES.some(d => d.id === baseId);
                        const tId = (isDuplicate || isDefaultConflict) ? `custom-dedup-${baseId}-${i}` : baseId;
                        return (
                        <div key={tId} className="relative group">
                          <button
                            onClick={() => {
                               if (tId !== theme.id) {
                                  useStore.getState().updateCustomTheme(theme.id, { ...theme, id: tId });
                               }
                               setThemeId(tId);
                            }}
                            className={cn(
                              "w-12 h-12 rounded-full flex items-center justify-center transition-transform",
                              themeId === tId ? "scale-110 ring-2 ring-offset-2 ring-offset-theme-surface ring-theme-text" : "hover:scale-110"
                            )}
                            style={{ backgroundColor: themeMode === 'light' ? theme.lightColor : theme.darkColor }}
                            title={theme.name}
                          >
                            {themeId === tId && <Check className="w-5 h-5 text-white" />}
                          </button>
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              if (theme.id) {
                                openEditModal(theme);
                              }
                            }}
                            className="absolute -top-2 -right-2 w-6 h-6 bg-theme-text text-theme-bg rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity shadow-lg"
                            title="Edit theme"
                          >
                            <Palette className="w-3 h-3" />
                          </button>
                        </div>
                        );
                      })}
                    </div>
                  </>
                )}
                
                <div className="mt-2">
                  <button
                    onClick={openAddModal}
                    className="flex items-center gap-2 px-4 py-2 rounded-full border border-dashed border-theme-border text-theme-muted hover:text-theme-text hover:border-theme-text transition-colors text-sm font-medium"
                  >
                    <Palette className="w-4 h-4" />
                    Create Custom Theme
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>

        <div className="p-8 md:p-10 border-b border-theme-border flex items-center justify-between gap-4">
          <div>
            <h2 className="text-xl font-display font-medium text-theme-text mb-1">Fluid Animations</h2>
            <p className="text-sm text-theme-muted">Enable or disable UI motion and transitions.</p>
          </div>
          <button
            onClick={() => setAnimationsEnabled(!animationsEnabled)}
            className={cn(
              "relative inline-flex h-7 w-12 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none focus:ring-2 focus:ring-theme-text focus:ring-offset-2",
              animationsEnabled ? "bg-theme-text" : "bg-theme-border"
            )}
          >
            <span
              className={cn(
                "inline-block h-6 w-6 transform rounded-full bg-theme-bg transition-transform",
                animationsEnabled ? "translate-x-5" : "translate-x-0"
              )}
            />
          </button>
        </div>

        <div className="p-8 md:p-10 border-b border-theme-border">
          <h2 className="text-xl font-display font-medium text-theme-text mb-4">Data Management</h2>
          <p className="text-theme-muted mb-8 max-w-xl text-sm">
            All your data is stored locally in this browser. To back up your data or move it to another device, use the export and import tools below.
          </p>
          
          <div className="flex flex-col sm:flex-row gap-4">
            <button 
              onClick={handleExport}
              className="flex items-center justify-center gap-2 bg-theme-text text-theme-bg px-8 py-3.5 rounded-full hover:opacity-90 transition-opacity font-medium"
            >
              <Download className="w-5 h-5" />
              <span>Export Backup</span>
            </button>
            
            <button 
              onClick={() => fileInputRef.current?.click()}
              className="flex items-center justify-center gap-2 bg-theme-bg text-theme-text border border-theme-border px-8 py-3.5 rounded-full hover:border-theme-text transition-colors font-medium"
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
        
        <div className="p-8 md:p-10 bg-[#ff3b30]/5">
          <div className="flex flex-col md:flex-row gap-6 items-start md:items-center justify-between">
            <div>
              <div className="flex items-center gap-3 mb-2">
                <AlertCircle className="w-6 h-6 text-[#ff3b30]" />
                <h3 className="text-xl font-display font-medium text-[#ff3b30]">Danger Zone</h3>
              </div>
              <p className="text-[#ff3b30]/70 max-w-xl text-sm">
                Clearing your data will permanently remove all tasks, categories, and completion history from this browser. Please export a backup first.
              </p>
            </div>
            <button 
              onClick={() => setIsClearModalOpen(true)}
              className="flex items-center justify-center gap-2 bg-[#ff3b30]/10 text-[#ff3b30] border border-[#ff3b30]/20 px-8 py-3.5 rounded-full hover:bg-[#ff3b30]/20 transition-colors font-medium shrink-0"
            >
              <Trash2 className="w-5 h-5" />
              <span>Clear Data</span>
            </button>
          </div>
        </div>

      </div>

      {createPortal(
        <AnimatePresence>
          {isClearModalOpen && (
            <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
              <motion.div 
                initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                className="absolute inset-0 bg-black/30 backdrop-blur-md"
                onClick={() => setIsClearModalOpen(false)}
              />
              <motion.div 
                initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.95 }}
                className="relative bg-theme-surface border border-theme-border rounded-[2rem] p-8 md:p-10 w-full max-w-md shadow-2xl"
              >
                <h2 className="text-2xl font-display font-medium text-theme-text mb-4">Clear all data?</h2>
                <p className="text-theme-muted mb-8 text-sm">This action cannot be undone. All tasks, categories, and completion history will be permanently deleted.</p>
                <div className="flex justify-end gap-3">
                  <button 
                    onClick={() => setIsClearModalOpen(false)}
                    className="px-6 py-3 rounded-full text-theme-text border border-theme-border hover:border-theme-text transition-colors font-medium text-sm"
                  >
                    Cancel
                  </button>
                  <button 
                    onClick={handleClear}
                    className="px-6 py-3 rounded-full bg-[#ff3b30] text-white hover:opacity-90 transition-opacity font-medium text-sm"
                  >
                    Clear Data
                  </button>
                </div>
              </motion.div>
            </div>
          )}
        </AnimatePresence>,
        document.body
      )}

      {createPortal(
        <AnimatePresence>
          {isAddThemeModalOpen && (
            <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
              <motion.div 
                initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                className="absolute inset-0 bg-black/30 backdrop-blur-md"
                onClick={() => setIsAddThemeModalOpen(false)}
              />
              <motion.div 
                initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.95 }}
                className="relative bg-theme-surface border border-theme-border rounded-[2rem] p-8 md:p-10 w-full max-w-sm shadow-2xl"
              >
                <h2 className="text-2xl font-display font-medium text-theme-text mb-8">{editingThemeId ? 'Edit Custom Theme' : 'New Custom Theme'}</h2>
                
                <div className="space-y-6 mb-10">
                  <div>
                    <label className="block text-xs font-semibold tracking-widest uppercase text-theme-muted mb-3">Theme Name</label>
                    <input 
                      type="text" 
                      value={newThemeName}
                      onChange={e => setNewThemeName(e.target.value)}
                      placeholder="e.g. Midnight Blue"
                      className="w-full bg-theme-bg border border-theme-border rounded-xl px-4 py-3 text-sm text-theme-text focus:outline-none focus:border-theme-text transition-colors"
                      autoFocus
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold tracking-widest uppercase text-theme-muted mb-3">Accent Colors</label>
                    <div className="grid grid-cols-2 gap-4">
                      <div className="flex flex-col gap-2">
                        <label className="text-[10px] font-semibold text-theme-muted uppercase tracking-wider">Light Mode</label>
                        <div className="flex items-center gap-3 bg-theme-bg p-2 rounded-2xl border border-theme-border">
                          <div 
                            className="w-10 h-10 rounded-full overflow-hidden border-2 border-theme-border relative flex-shrink-0 shadow-sm"
                            style={{ backgroundColor: newThemeLight }}
                          >
                            <input 
                              type="color" 
                              value={newThemeLight}
                              onChange={e => setNewThemeLight(e.target.value)}
                              className="absolute inset-0 opacity-0 w-[200%] h-[200%] -top-[50%] -left-[50%] cursor-pointer"
                            />
                          </div>
                          <span className="text-sm font-medium text-theme-text uppercase tracking-wider">{newThemeLight}</span>
                        </div>
                      </div>
                      
                      <div className="flex flex-col gap-2">
                        <label className="text-[10px] font-semibold text-theme-muted uppercase tracking-wider">Dark Mode</label>
                        <div className="flex items-center gap-3 bg-theme-bg p-2 rounded-2xl border border-theme-border">
                          <div 
                            className="w-10 h-10 rounded-full overflow-hidden border-2 border-theme-border relative flex-shrink-0 shadow-sm"
                            style={{ backgroundColor: newThemeDark }}
                          >
                            <input 
                              type="color" 
                              value={newThemeDark}
                              onChange={e => setNewThemeDark(e.target.value)}
                              className="absolute inset-0 opacity-0 w-[200%] h-[200%] -top-[50%] -left-[50%] cursor-pointer"
                            />
                          </div>
                          <span className="text-sm font-medium text-theme-text uppercase tracking-wider">{newThemeDark}</span>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
                
                <div className="flex justify-between items-center gap-3 pt-6 border-t border-theme-border">
                  {editingThemeId ? (
                    <button 
                      onClick={handleDeleteCustomTheme}
                      className="px-4 py-2.5 rounded-full text-[#ff3b30] bg-[#ff3b30]/10 hover:bg-[#ff3b30]/20 transition-colors font-medium text-sm"
                    >
                      Delete
                    </button>
                  ) : <div />}
                  
                  <div className="flex justify-end gap-2">
                    <button 
                      onClick={() => setIsAddThemeModalOpen(false)}
                      className="px-5 py-2.5 rounded-full text-theme-text border border-theme-border hover:border-theme-text transition-colors font-medium text-sm"
                    >
                      Cancel
                    </button>
                    <button 
                      onClick={handleSaveCustomTheme}
                      disabled={!newThemeName.trim()}
                      className="px-5 py-2.5 rounded-full bg-theme-text text-theme-bg hover:opacity-90 transition-opacity font-medium text-sm disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      Save
                    </button>
                  </div>
                </div>
              </motion.div>
            </div>
          )}
        </AnimatePresence>,
        document.body
      )}
    </div>
  );
}
