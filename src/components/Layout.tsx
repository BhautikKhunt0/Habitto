import { Link, Outlet, useLocation } from "react-router-dom";
import { LayoutDashboard, CheckSquare, BarChart2, Settings, Book, Kanban, Timer } from "lucide-react";
import { useState, useEffect, useMemo, useRef } from "react";
import { cn, hexToRgb } from "../lib/utils";
import { AnimatePresence, motion, useMotionValue } from "framer-motion";
import { useStore, DEFAULT_THEMES } from "../store/useStore";

function DockIcon({ 
  item, 
  isActive, 
  navPosition,
}: { 
  item: any, 
  isActive: boolean, 
  navPosition: 'bottom' | 'left' | 'right' | 'bottom-right'
}) {
  const tooltipClass = navPosition === 'left' 
    ? "absolute left-full top-1/2 -translate-y-1/2 ml-3 pointer-events-none opacity-0 -translate-x-[10px] group-hover:opacity-100 group-hover:translate-x-0 transition-all duration-300 z-50"
    : navPosition === 'right'
    ? "absolute right-full top-1/2 -translate-y-1/2 mr-3 pointer-events-none opacity-0 translate-x-[10px] group-hover:opacity-100 group-hover:translate-x-0 transition-all duration-300 z-50"
    : "absolute bottom-full left-1/2 -translate-x-1/2 mb-3 pointer-events-none opacity-0 translate-y-[10px] group-hover:opacity-100 group-hover:translate-y-0 transition-all duration-300 z-50";

  return (
    <div className="relative group z-10">
      <Link
        to={item.path}
        className={cn(
          "flex items-center justify-center w-10 h-10 md:w-12 md:h-12 rounded-full transition-all duration-300 relative",
          isActive 
            ? "bg-theme-accent text-theme-bg" 
            : "text-theme-muted hover:bg-theme-surface hover:text-theme-text"
        )}
      >
        <div className="flex items-center justify-center">
          <item.icon className={cn("w-5 h-5 relative z-10 transition-colors")} />
        </div>
      </Link>
      
      {/* Tooltip */}
      <div className={tooltipClass}>
        <div className="bg-theme-text text-theme-bg text-xs font-semibold tracking-wide px-3 py-1.5 rounded-full shadow-xl whitespace-nowrap">
          {item.name}
        </div>
      </div>
    </div>
  );
}

export function Layout() {
  const location = useLocation();

  const themeMode = useStore(state => state.themeMode);
  const themeId = useStore(state => state.themeId);
  const customThemes = useStore(state => state.customThemes);
  const themeColorState = useStore(state => state.themeColor);
  const navPosition = useStore(state => state.navPosition);
  const setNavPosition = useStore(state => state.setNavPosition);

  const mainRef = useRef<HTMLElement>(null);
  const [dragHoverZone, setDragHoverZone] = useState<'left' | 'right' | 'bottom' | 'bottom-right' | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [isDockHovered, setIsDockHovered] = useState(false);
  const [recentlyDragged, setRecentlyDragged] = useState(false);

  const handleDragStart = () => {
    setIsDragging(true);
    setRecentlyDragged(true);
  };


  const handleDrag = (event: any, info: any) => {
    const { point } = info;
    const width = window.innerWidth;
    const height = window.innerHeight;
    
    if (point.x > width * 0.75 && point.y > height * 0.6) {
      setDragHoverZone('bottom-right');
    } else if (point.x < width * 0.25) {
      setDragHoverZone('left');
    } else if (point.x > width * 0.75) {
      setDragHoverZone('right');
    } else if (point.y > height * 0.6) {
      setDragHoverZone('bottom');
    } else {
      setDragHoverZone(navPosition);
    }
  };

  const handleDragEnd = (event: any, info: any) => {
    setIsDragging(false);
    setDragHoverZone(null);
    setTimeout(() => setRecentlyDragged(false), 800); // Wait for snap animation to finish
    
    const { point } = info;
    const width = window.innerWidth;
    const height = window.innerHeight;

    if (point.x > width * 0.75 && point.y > height * 0.6) {
      setNavPosition('bottom-right');
    } else if (point.x < width * 0.25) {
      setNavPosition('left');
    } else if (point.x > width * 0.75) {
      setNavPosition('right');
    } else if (point.y > height * 0.6) {
      setNavPosition('bottom');
    }
    // if dropped in the middle (top/center), keep current position
  };

  useEffect(() => {
    if (mainRef.current) {
      mainRef.current.scrollTop = 0;
    }
  }, [location.pathname]);

  const activeColor = useMemo(() => {
    const allThemes = [...DEFAULT_THEMES, ...customThemes];
    const theme = allThemes.find(t => t.id === themeId);
    if (theme) {
      return themeMode === 'light' ? theme.lightColor : theme.darkColor;
    }
    return themeColorState; 
  }, [themeId, customThemes, themeMode, themeColorState]);

  useEffect(() => {
    let isDark = themeMode === 'dark';
    if (themeMode === 'system') {
      isDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
    }
    
    if (isDark) {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
    
    const rgb = hexToRgb(activeColor);
    if (rgb) {
      document.documentElement.style.setProperty('--accent-rgb', rgb);
    }
  }, [themeMode, activeColor]);

  const navItems = [
    { name: "Dashboard", path: "/", icon: LayoutDashboard },
    { name: "Tasks", path: "/tasks", icon: CheckSquare },
    { name: "Kanban", path: "/kanban", icon: Kanban },
    { name: "Focus", path: "/focus", icon: Timer },
    { name: "Journal", path: "/journal", icon: Book },
    { name: "Analytics", path: "/stats", icon: BarChart2 },
    { name: "Settings", path: "/settings", icon: Settings },
  ];

  return (
    <div className="flex h-screen w-full bg-theme-bg text-theme-text font-sans selection:bg-theme-accent/30 selection:text-theme-accent transition-colors duration-300 relative overflow-hidden">
      
      {/* Elegant Ambient Background */}
      <div 
        className="fixed inset-0 z-0 pointer-events-none opacity-20 dark:opacity-10"
        style={{
          backgroundImage: "radial-gradient(circle at 15% 15%, currentColor 0%, transparent 40%), radial-gradient(circle at 85% 85%, currentColor 0%, transparent 50%)",
          color: "rgb(var(--accent-rgb))"
        }}
      />
      
      {/* Main Content Area */}
      <main ref={mainRef} className="flex-1 flex flex-col h-full w-full relative z-10 overflow-y-auto">
        
        {/* Top Branding (Minimal) */}
        <header className="w-full flex items-center justify-between p-6 md:px-12 md:py-8 max-w-7xl mx-auto">
          <Link to="/" className="flex items-center gap-3 hover:opacity-80 transition-opacity">
            <div className="w-8 h-8 rounded-xl bg-theme-text flex items-center justify-center">
              <CheckSquare className="w-4 h-4 text-theme-bg" />
            </div>
            <h1 className="text-xl font-display font-medium tracking-tight text-theme-text">Habitto</h1>
          </Link>
        </header>

        {/* Scrollable Content wrapper */}
        <div className="flex-1 w-full max-w-7xl mx-auto px-4 md:px-12 pb-40">
          <AnimatePresence mode="wait">
              <motion.div
                key={location.pathname}
                initial={{ opacity: 0, scale: 0.98, filter: "blur(4px)" }}
                animate={{ opacity: 1, scale: 1, filter: "blur(0px)" }}
                exit={{ opacity: 0, scale: 0.98, filter: "blur(4px)" }}
                transition={{ duration: 0.4, ease: [0.22, 1, 0.36, 1] }}
                className="h-full"
              >
                <Outlet />
              </motion.div>
          </AnimatePresence>
        </div>
      </main>

      {/* Drop Zone Previews */}
      <AnimatePresence>
        {isDragging && dragHoverZone === 'left' && (
          <motion.div
            initial={{ opacity: 0, scale: 0.9, filter: "blur(4px)" }}
            animate={{ opacity: 1, scale: 1, filter: "blur(0px)" }}
            exit={{ opacity: 0, scale: 0.9, filter: "blur(4px)" }}
            transition={{ type: "spring", damping: 20, stiffness: 300 }}
            className="fixed left-8 top-1/2 -translate-y-1/2 w-[72px] h-[340px] bg-theme-accent/5 border-2 border-theme-accent/20 rounded-full z-40 pointer-events-none"
          />
        )}
        {isDragging && dragHoverZone === 'right' && (
          <motion.div
            initial={{ opacity: 0, scale: 0.9, filter: "blur(4px)" }}
            animate={{ opacity: 1, scale: 1, filter: "blur(0px)" }}
            exit={{ opacity: 0, scale: 0.9, filter: "blur(4px)" }}
            transition={{ type: "spring", damping: 20, stiffness: 300 }}
            className="fixed right-8 top-1/2 -translate-y-1/2 w-[72px] h-[340px] bg-theme-accent/5 border-2 border-theme-accent/20 rounded-full z-40 pointer-events-none"
          />
        )}
        {isDragging && dragHoverZone === 'bottom' && (
          <motion.div
            initial={{ opacity: 0, scale: 0.9, filter: "blur(4px)" }}
            animate={{ opacity: 1, scale: 1, filter: "blur(0px)" }}
            exit={{ opacity: 0, scale: 0.9, filter: "blur(4px)" }}
            transition={{ type: "spring", damping: 20, stiffness: 300 }}
            className="fixed bottom-8 left-1/2 -translate-x-1/2 w-[340px] h-[72px] bg-theme-accent/5 border-2 border-theme-accent/20 rounded-full z-40 pointer-events-none"
          />
        )}
        {isDragging && dragHoverZone === 'bottom-right' && (
          <motion.div
            initial={{ opacity: 0, scale: 0.5, filter: "blur(4px)" }}
            animate={{ opacity: 1, scale: 1, filter: "blur(0px)" }}
            exit={{ opacity: 0, scale: 0.5, filter: "blur(4px)" }}
            transition={{ type: "spring", damping: 20, stiffness: 300 }}
            className="fixed bottom-8 right-8 w-[72px] h-[72px] bg-theme-accent/5 border-2 border-theme-accent/20 rounded-full z-40 pointer-events-none"
          />
        )}
      </AnimatePresence>

      {/* Floating Dock Navigation */}
      <motion.nav
        layout
        drag
        dragMomentum={false}
        dragSnapToOrigin={true}
        whileDrag={{ scale: 1.05, cursor: "grabbing" }}
        onDragStart={handleDragStart}
        onDrag={handleDrag}
        onDragEnd={handleDragEnd}
        onMouseEnter={() => setIsDockHovered(true)}
        onMouseLeave={() => setIsDockHovered(false)}
        initial={{ y: 50, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ type: "spring", damping: 30, stiffness: 300, mass: 0.8 }}
        className={cn(
          "fixed z-50 flex items-center p-2 md:p-3 rounded-full bg-theme-surface/70 border border-theme-border/50 shadow-2xl shadow-black/10 dark:shadow-[0_20px_40px_rgb(0,0,0,0.4)] cursor-grab",
          navPosition === 'left' ? "left-8 top-1/2 -translate-y-1/2 flex-col gap-2 md:gap-4" : "",
          navPosition === 'right' ? "right-8 top-1/2 -translate-y-1/2 flex-col gap-2 md:gap-4" : "",
          navPosition === 'bottom' ? "bottom-8 left-1/2 -translate-x-1/2 flex-row gap-2 md:gap-4" : "",
          navPosition === 'bottom-right' ? "bottom-8 right-8 flex-col gap-0" : ""
        )}
      >
        <div className="absolute inset-0 rounded-full pointer-events-none -z-10" style={{ backdropFilter: 'blur(24px)', WebkitBackdropFilter: 'blur(24px)' }} />
        <AnimatePresence>
          {(navPosition === 'bottom-right' ? [...navItems].reverse() : navItems).map((item, index) => {
            const isActive = location.pathname === item.path;
            const isDashboard = item.name === "Dashboard";
            
            const isVisible = navPosition !== 'bottom-right' || isDockHovered || isDashboard || isDragging || recentlyDragged;

            return (
              <motion.div
                layout
                key={item.path}
                initial={navPosition === 'bottom-right' ? { opacity: 0, height: 0, y: 15, scale: 0.8, filter: 'blur(4px)', marginTop: 0 } : false}
                animate={
                  navPosition === 'bottom-right' 
                    ? isVisible 
                      ? { opacity: 1, height: "auto", y: 0, scale: 1, filter: 'blur(0px)', marginBottom: isDashboard ? 0 : 8, pointerEvents: 'auto' } 
                      : { opacity: 0, height: 0, y: 15, scale: 0.8, filter: 'blur(4px)', marginBottom: 0, pointerEvents: 'none' } 
                    : { opacity: 1, height: "auto", y: 0, scale: 1, filter: 'blur(0px)', marginBottom: 0, pointerEvents: 'auto' }
                }
                transition={{ type: "spring", damping: 20, stiffness: 300 }}
                className={cn(navPosition === 'bottom-right' ? "overflow-visible flex items-center justify-center relative" : "")}
              >
                <DockIcon
                  item={item}
                  isActive={isActive}
                  navPosition={navPosition === 'bottom-right' ? 'right' : navPosition}
                />
              </motion.div>
            )
          })}
        </AnimatePresence>
      </motion.nav>
    </div>
  );
}
