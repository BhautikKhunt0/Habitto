import { Link, Outlet, useLocation } from "react-router-dom";
import { LayoutDashboard, CheckSquare, BarChart2, Settings, Book } from "lucide-react";
import { useState, useEffect, useMemo, useRef } from "react";
import { cn, hexToRgb } from "../lib/utils";
import { AnimatePresence, motion, useMotionValue } from "framer-motion";
import { useStore, DEFAULT_THEMES } from "../store/useStore";

function DockIcon({ 
  item, 
  isActive, 
  navPosition,
}: { 
  key?: string,
  item: any, 
  isActive: boolean, 
  navPosition: 'bottom' | 'left' | 'right'
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
            ? "bg-theme-accent text-theme-bg shadow-lg shadow-theme-accent/20" 
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
  const animationsEnabled = useStore(state => state.animationsEnabled);
  const themeColorState = useStore(state => state.themeColor);
  const navPosition = useStore(state => state.navPosition);
  const setNavPosition = useStore(state => state.setNavPosition);

  const mainRef = useRef<HTMLElement>(null);
  const [dragHoverZone, setDragHoverZone] = useState<'left' | 'right' | 'bottom' | null>(null);
  const [isDragging, setIsDragging] = useState(false);

  const handleDragStart = () => {
    setIsDragging(true);
  };

  const handleDrag = (event: any, info: any) => {
    const { point } = info;
    const width = window.innerWidth;
    if (point.x < width * 0.25) {
      setDragHoverZone('left');
    } else if (point.x > width * 0.75) {
      setDragHoverZone('right');
    } else {
      setDragHoverZone('bottom');
    }
  };

  const handleDragEnd = (event: any, info: any) => {
    setIsDragging(false);
    setDragHoverZone(null);
    const { point } = info;
    const width = window.innerWidth;

    if (point.x < width * 0.25) {
      setNavPosition('left');
    } else if (point.x > width * 0.75) {
      setNavPosition('right');
    } else {
      setNavPosition('bottom');
    }
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
    { name: "Journal", path: "/journal", icon: Book },
    { name: "Analytics", path: "/stats", icon: BarChart2 },
    { name: "Settings", path: "/settings", icon: Settings },
  ];

  return (
    <div className="flex h-screen w-full bg-theme-bg text-theme-text font-sans selection:bg-theme-accent/30 selection:text-theme-accent transition-colors duration-300 relative overflow-hidden">
      
      {/* Immersive Background Gradients */}
      <div className="fixed top-[-20%] left-[-10%] w-[60vw] h-[60vw] bg-theme-accent/10 rounded-full blur-[140px] pointer-events-none transition-colors duration-700" />
      <div className="fixed bottom-[-10%] right-[-10%] w-[50vw] h-[50vw] bg-theme-accent/10 rounded-full blur-[140px] pointer-events-none transition-colors duration-700" />
      
      {/* Main Content Area */}
      <main ref={mainRef} className="flex-1 flex flex-col h-full w-full relative z-10 overflow-y-auto">
        
        {/* Top Branding (Minimal) */}
        <header className="w-full flex items-center justify-between p-6 md:px-12 md:py-8 max-w-7xl mx-auto">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-xl bg-theme-text flex items-center justify-center">
              <CheckSquare className="w-4 h-4 text-theme-bg" />
            </div>
            <h1 className="text-xl font-display font-medium tracking-tight text-theme-text">Habitto</h1>
          </div>
        </header>

        {/* Scrollable Content wrapper */}
        <div className="flex-1 w-full max-w-7xl mx-auto px-4 md:px-12 pb-40">
          <AnimatePresence mode="wait">
              <motion.div
                key={location.pathname}
                initial={animationsEnabled ? { opacity: 0, scale: 0.98, filter: "blur(4px)" } : { opacity: 1 }}
                animate={{ opacity: 1, scale: 1, filter: "blur(0px)" }}
                exit={animationsEnabled ? { opacity: 0, scale: 0.98, filter: "blur(4px)" } : { opacity: 1 }}
                transition={animationsEnabled ? { duration: 0.4, ease: [0.22, 1, 0.36, 1] } : { duration: 0 }}
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
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.9 }}
            className="fixed left-4 top-1/2 -translate-y-1/2 w-20 h-64 bg-theme-accent/10 border-2 border-theme-accent/30 rounded-3xl z-40 pointer-events-none"
          />
        )}
        {isDragging && dragHoverZone === 'right' && (
          <motion.div
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.9 }}
            className="fixed right-4 top-1/2 -translate-y-1/2 w-20 h-64 bg-theme-accent/10 border-2 border-theme-accent/30 rounded-3xl z-40 pointer-events-none"
          />
        )}
        {isDragging && dragHoverZone === 'bottom' && (
          <motion.div
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.9 }}
            className="fixed bottom-4 left-1/2 -translate-x-1/2 w-80 h-20 bg-theme-accent/10 border-2 border-theme-accent/30 rounded-3xl z-40 pointer-events-none"
          />
        )}
      </AnimatePresence>

      {/* Floating Dock Navigation */}
      <motion.nav 
        layout
        drag
        dragMomentum={false}
        dragSnapToOrigin={true}
        onDragStart={handleDragStart}
        onDrag={handleDrag}
        onDragEnd={handleDragEnd}
        initial={{ y: 50, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ type: "spring", damping: 25, stiffness: 200 }}
        className={cn(
          "fixed z-50 flex items-center p-2 md:p-3 rounded-full bg-theme-surface/70 backdrop-blur-2xl border border-theme-border/50 shadow-2xl dark:shadow-[0_20px_40px_rgb(0,0,0,0.4)] cursor-grab active:cursor-grabbing",
          navPosition === 'left' ? "left-8 top-1/2 -translate-y-1/2 flex-col gap-2 md:gap-4" : "",
          navPosition === 'right' ? "right-8 top-1/2 -translate-y-1/2 flex-col gap-2 md:gap-4" : "",
          navPosition === 'bottom' ? "bottom-8 left-1/2 -translate-x-1/2 flex-row gap-2 md:gap-4" : ""
        )}
      >
        {navItems.map((item) => {
          const isActive = location.pathname === item.path;
          return (
            <DockIcon
              key={item.path}
              item={item}
              isActive={isActive}
              navPosition={navPosition}
            />
          )
        })}
      </motion.nav>
    </div>
  );
}
