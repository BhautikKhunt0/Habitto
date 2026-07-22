import { BrowserRouter, Routes, Route } from "react-router-dom";
import { Layout } from "./components/Layout";
import { Dashboard } from "./pages/Dashboard";
import { Tasks } from "./pages/Tasks";
import { Stats } from "./pages/Stats";
import { Settings } from "./pages/Settings";
import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { CheckSquare } from "lucide-react";

import { useStore } from "./store/useStore";

export default function App() {
  const animationsEnabled = useStore(state => state.animationsEnabled);
  const [isLoaded, setIsLoaded] = useState(!animationsEnabled);

  useEffect(() => {
    if (!animationsEnabled) {
      setIsLoaded(true);
      return;
    }
    // Small delay to ensure styles are loaded and give a smooth entry
    const timer = setTimeout(() => {
      setIsLoaded(true);
    }, 800);
    return () => clearTimeout(timer);
  }, [animationsEnabled]);

  return (
    <>
      <AnimatePresence>
        {!isLoaded && (
          <motion.div
            initial={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.5, ease: "easeInOut" }}
            className="fixed inset-0 z-[999] bg-theme-bg flex flex-col items-center justify-center pointer-events-none"
          >
            <motion.div
              initial={{ scale: 0.8, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              transition={{ duration: 0.4, ease: "easeOut" }}
              className="flex flex-col items-center gap-4"
            >
              <div className="w-16 h-16 rounded-2xl bg-theme-accent flex items-center justify-center shadow-lg shadow-theme-accent/30 relative overflow-hidden">
                <motion.div 
                  initial={{ x: "-100%" }}
                  animate={{ x: "100%" }}
                  transition={{ duration: 1.5, repeat: Infinity, ease: "easeInOut" }}
                  className="absolute inset-0 bg-white/20 w-1/2 -skew-x-12"
                />
                <CheckSquare className="w-8 h-8 text-theme-bg relative z-10" />
              </div>
              <motion.h1 
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.2, duration: 0.4 }}
                className="text-2xl font-medium tracking-tight text-theme-text"
              >
                Habitto
              </motion.h1>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {isLoaded && (
        <BrowserRouter>
          <Routes>
            <Route path="/" element={<Layout />}>
              <Route index element={<Dashboard />} />
              <Route path="tasks" element={<Tasks />} />
              <Route path="stats" element={<Stats />} />
              <Route path="settings" element={<Settings />} />
            </Route>
          </Routes>
        </BrowserRouter>
      )}
    </>
  );
}
