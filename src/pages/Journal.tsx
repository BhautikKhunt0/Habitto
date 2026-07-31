import { useState } from "react";
import { useStore } from "../store/useStore";
import { JournalEntry } from "../types";
import { Plus, Search, Edit2, Smile, Frown, Meh, ArrowRight } from "lucide-react";
import { format } from "date-fns";
import { cn } from "../lib/utils";
import { motion, AnimatePresence } from "framer-motion";

const MOODS = [
  { id: 'great', icon: Smile, color: 'text-green-500', bg: 'bg-green-500/10' },
  { id: 'good', icon: Smile, color: 'text-teal-500', bg: 'bg-teal-500/10' },
  { id: 'neutral', icon: Meh, color: 'text-blue-500', bg: 'bg-blue-500/10' },
  { id: 'bad', icon: Frown, color: 'text-orange-500', bg: 'bg-orange-500/10' },
  { id: 'awful', icon: Frown, color: 'text-red-500', bg: 'bg-red-500/10' },
] as const;

export function Journal() {
  const journalEntries = useStore((state) => state.journalEntries) || [];
  const addJournalEntry = useStore((state) => state.addJournalEntry);
  const updateJournalEntry = useStore((state) => state.updateJournalEntry);
  const deleteJournalEntry = useStore((state) => state.deleteJournalEntry);

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingEntry, setEditingEntry] = useState<JournalEntry | null>(null);
  const [searchQuery, setSearchQuery] = useState("");

  const handleOpenModal = (entry?: JournalEntry) => {
    setEditingEntry(entry || null);
    setIsModalOpen(true);
  };

  const handleCloseModal = () => {
    setIsModalOpen(false);
    setEditingEntry(null);
  };

  const filteredEntries = journalEntries
    .filter(e => e.content.toLowerCase().includes(searchQuery.toLowerCase()) || e.date.includes(searchQuery))
    .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

  return (
    <div className="w-full pt-4">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-10">
        <h2 className="text-3xl font-display font-medium text-theme-text">Journal</h2>
        
        <div className="flex items-center gap-3 w-full md:w-auto">
          <div className="relative flex-1 md:w-64">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-theme-muted" />
            <input 
              type="text" 
              placeholder="Search journals..."
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              className="w-full bg-theme-bg border border-theme-border rounded-full pl-11 pr-4 py-2.5 text-sm text-theme-text focus:outline-none focus:border-theme-text transition-colors placeholder:text-theme-muted/50"
            />
          </div>
          <button 
            onClick={() => handleOpenModal()}
            className="flex items-center justify-center w-10 h-10 rounded-full bg-theme-text text-theme-bg hover:opacity-90 transition-opacity shrink-0"
          >
            <Plus className="w-5 h-5" />
          </button>
        </div>
      </div>

      {filteredEntries.length === 0 ? (
        <div className="text-center py-20 border border-dashed border-theme-border rounded-[2rem]">
          <p className="text-theme-muted text-sm uppercase tracking-widest font-medium mb-4">No journal entries found</p>
          <button 
            onClick={() => handleOpenModal()}
            className="px-6 py-2.5 rounded-full border border-theme-border hover:border-theme-text text-theme-text text-sm font-medium transition-colors"
          >
            Write your first entry
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          <AnimatePresence mode="popLayout">
            {filteredEntries.map(entry => {
              const moodData = MOODS.find(m => m.id === entry.mood);
              const MoodIcon = moodData?.icon;

              return (
                <motion.div
                  layout
                  initial={{ opacity: 0, scale: 0.95 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.95 }}
                  key={entry.id}
                  onClick={() => handleOpenModal(entry)}
                  className="bg-theme-surface border border-theme-border rounded-[2rem] p-6 group hover:border-theme-text/20 cursor-pointer transition-all duration-300 relative flex flex-col justify-between min-h-[160px]"
                >
                  <div>
                    <div className="flex justify-between items-start gap-4 mb-4">
                      <h3 className="font-display text-lg font-medium text-theme-text leading-tight">
                        {format(new Date(entry.date), "MMMM d, yyyy")}
                      </h3>
                      {MoodIcon && moodData && (
                        <div className={cn("p-2 rounded-full", moodData.bg, moodData.color)}>
                          <MoodIcon className="w-4 h-4" />
                        </div>
                      )}
                    </div>
                    <p className="text-sm text-theme-muted line-clamp-3 whitespace-pre-wrap">{entry.content}</p>
                  </div>

                  <div className="mt-6 flex justify-end">
                    <button className="w-8 h-8 rounded-full border border-theme-border flex items-center justify-center text-theme-text hover:bg-theme-text hover:text-theme-bg transition-colors opacity-0 group-hover:opacity-100">
                      <ArrowRight className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </motion.div>
              );
            })}
          </AnimatePresence>
        </div>
      )}

      {/* Modal */}
      <AnimatePresence>
        {isModalOpen && (
          <JournalModal 
            entry={editingEntry} 
            onClose={handleCloseModal} 
            onSave={(entryData) => {
              if (editingEntry) {
                updateJournalEntry(editingEntry.id, entryData);
              } else {
                addJournalEntry(entryData);
              }
              handleCloseModal();
            }}
            onDelete={editingEntry ? () => {
              deleteJournalEntry(editingEntry.id);
              handleCloseModal();
            } : undefined}
          />
        )}
      </AnimatePresence>
    </div>
  );
}

function JournalModal({ 
  entry: editingEntry, 
  onClose, 
  onSave, 
  onDelete
}: { 
  entry: JournalEntry | null, 
  onClose: () => void, 
  onSave: (data: Omit<JournalEntry, 'id' | 'createdAt' | 'updatedAt'>) => void,
  onDelete?: () => void
}) {
  const [date, setDate] = useState(editingEntry?.date || format(new Date(), "yyyy-MM-dd"));
  const [content, setContent] = useState(editingEntry?.content || "");
  const [mood, setMood] = useState(editingEntry?.mood || "neutral");
  
  const handleSave = () => {
    if (!content.trim()) return;
    onSave({
      date,
      content: content.trim(),
      mood: mood as any
    });
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
      <motion.div 
        initial={{ opacity: 0 }} 
        animate={{ opacity: 1 }} 
        exit={{ opacity: 0 }}
        className="absolute inset-0 bg-black/30 backdrop-blur-md"
        onClick={onClose}
      />
      <motion.div 
        initial={{ opacity: 0, scale: 0.95, y: 10 }} 
        animate={{ opacity: 1, scale: 1, y: 0 }} 
        exit={{ opacity: 0, scale: 0.95, y: 10 }}
        className="relative bg-theme-surface border border-theme-border rounded-[2.5rem] w-full max-w-2xl shadow-2xl flex flex-col max-h-[90vh] overflow-hidden"
      >
        <div className="flex items-center justify-between p-6 md:p-8 border-b border-theme-border">
          <input 
            type="date"
            value={date}
            onChange={e => setDate(e.target.value)}
            className="bg-transparent text-xl font-display font-medium text-theme-text focus:outline-none"
          />
          <button onClick={onClose} className="p-2 -mr-2 text-theme-muted hover:text-theme-text transition-colors rounded-full hover:bg-theme-bg">
            <Plus className="w-5 h-5 rotate-45" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-6 md:p-8 space-y-6 flex flex-col">
          
          <div>
            <label className="block text-xs font-semibold tracking-widest uppercase text-theme-muted mb-3">How are you feeling?</label>
            <div className="flex gap-2">
              {MOODS.map(m => {
                const Icon = m.icon;
                return (
                  <button
                    key={m.id}
                    onClick={() => setMood(m.id)}
                    className={cn(
                      "p-3 rounded-2xl flex-1 flex flex-col items-center gap-2 border transition-colors",
                      mood === m.id 
                        ? cn("border-transparent", m.bg, m.color)
                        : "border-theme-border text-theme-muted hover:border-theme-text/30 bg-theme-bg"
                    )}
                  >
                    <Icon className="w-6 h-6" />
                    <span className="text-[10px] uppercase font-bold tracking-wider">{m.id}</span>
                  </button>
                )
              })}
            </div>
          </div>

          <div className="flex-1 min-h-[200px] flex flex-col">
            <label className="block text-xs font-semibold tracking-widest uppercase text-theme-muted mb-2">Entry</label>
            <textarea 
              value={content}
              onChange={e => setContent(e.target.value)}
              placeholder="What's on your mind today?"
              className="w-full flex-1 bg-theme-bg border border-theme-border rounded-2xl p-4 text-theme-text focus:outline-none focus:border-theme-text transition-colors resize-none leading-relaxed"
              autoFocus
            />
          </div>
        </div>

        <div className="p-6 md:p-8 border-t border-theme-border bg-theme-surface flex items-center justify-between gap-4">
          {editingEntry ? (
            <button 
              onClick={onDelete}
              className="px-4 py-3 rounded-full text-sm font-medium text-red-500 bg-red-500/10 hover:bg-red-500/20 transition-colors"
            >
              Delete
            </button>
          ) : <div />}
          
          <button 
            onClick={handleSave}
            disabled={!content.trim()}
            className="px-8 py-3 rounded-full bg-theme-text text-theme-bg text-sm font-medium hover:opacity-90 transition-opacity disabled:opacity-50 disabled:cursor-not-allowed"
          >
            Save Entry
          </button>
        </div>
      </motion.div>
    </div>
  );
}
