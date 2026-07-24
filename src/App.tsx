import { BrowserRouter, Routes, Route } from "react-router-dom";
import { Layout } from "./components/Layout";
import { Dashboard } from "./pages/Dashboard";
import { Tasks } from "./pages/Tasks";
import { Stats } from "./pages/Stats";
import { Settings } from "./pages/Settings";
import { Journal } from "./pages/Journal";
import { Kanban } from "./pages/Kanban";
import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { CheckSquare } from "lucide-react";

import { useStore } from "./store/useStore";

export default function App() {
  const [isLoaded, setIsLoaded] = useState(false);

  useEffect(() => {
    // Smooth entry
    const timer = setTimeout(() => {
      setIsLoaded(true);
    }, 1200);
    return () => clearTimeout(timer);
  }, []);

  return (
    <>
      <AnimatePresence>
        {!isLoaded && (
          <motion.div
            initial={{ opacity: 1 }}
            exit={{ opacity: 0, filter: "blur(10px)" }}
            transition={{ duration: 0.6, ease: [0.22, 1, 0.36, 1] }}
            className="fixed inset-0 z-[999] bg-theme-bg flex flex-col items-center justify-center pointer-events-none"
          >
            <motion.div
              initial={{ scale: 0.9, opacity: 0, filter: "blur(10px)" }}
              animate={{ scale: 1, opacity: 1, filter: "blur(0px)" }}
              transition={{ duration: 0.8, ease: [0.22, 1, 0.36, 1] }}
              className="flex flex-col items-center gap-6"
            >
              <div className="w-20 h-20 rounded-[2rem] bg-theme-text flex items-center justify-center relative overflow-hidden">
                <CheckSquare className="w-10 h-10 text-theme-bg relative z-10" />
              </div>
              <motion.h1 
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.3, duration: 0.6, ease: [0.22, 1, 0.36, 1] }}
                className="text-3xl font-display font-medium tracking-tight text-theme-text"
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
              <Route path="kanban" element={<Kanban />} />
              <Route path="stats" element={<Stats />} />
              <Route path="journal" element={<Journal />} />
              <Route path="settings" element={<Settings />} />
            </Route>
          </Routes>
        </BrowserRouter>
      )}
    </>
  );
}
