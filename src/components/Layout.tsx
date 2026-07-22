import { Link, Outlet, useLocation } from "react-router-dom";
import { LayoutDashboard, CheckSquare, BarChart2, Settings, Menu, X, ChevronLeft, ChevronRight } from "lucide-react";
import { useState, useEffect, useMemo, useRef } from "react";
import { cn, hexToRgb } from "../lib/utils";
import { AnimatePresence, motion, useMotionValue, useSpring, useTransform } from "framer-motion";
import { useStore, DEFAULT_THEMES } from "../store/useStore";

// --- Dock Icon Component ---
function DockIcon({ 
  item, 
  isActive, 
  isSidebarCollapsed, 
  mouseY,
  animationsEnabled 
}: { 
  key?: string,
  item: any, 
  isActive: boolean, 
  isSidebarCollapsed: boolean, 
  mouseY: any,
  animationsEnabled: boolean
}) {
  const ref = useRef<HTMLAnchorElement>(null);
  
  // Calculate distance from mouse
  const distance = useTransform(mouseY, (val: number) => {
    if (!ref.current || !isSidebarCollapsed || !animationsEnabled) return 0;
    const bounds = ref.current.getBoundingClientRect();
    const iconCenter = bounds.top + bounds.height / 2;
    return val - iconCenter;
  });
  
  // Map distance to scale (bell curve)
  const scaleRaw = useTransform(distance, [-150, 0, 150], [1, 1.4, 1]);
  const scale = useSpring(scaleRaw, { mass: 0.1, stiffness: 300, damping: 20 });
  const yRaw = useTransform(distance, [-150, 0, 150], [0, -4, 0]);
  const y = useSpring(yRaw, { mass: 0.1, stiffness: 300, damping: 20 });

  return (
    <motion.div
      style={isSidebarCollapsed && animationsEnabled ? { scale, y } : {}}
      whileHover={!isSidebarCollapsed && animationsEnabled ? { scale: 1.02 } : {}}
      whileTap={animationsEnabled ? { scale: 0.95 } : {}}
      className="relative group z-10 hover:z-50"
    >
      <Link
        ref={ref}
        to={item.path}
        className={cn(
          "flex items-center rounded-2xl transition-colors duration-200 relative",
          isSidebarCollapsed ? "justify-center p-3" : "gap-3 px-4 py-3",
          isActive 
            ? "text-theme-accent bg-theme-accent/5 shadow-[inset_0_1px_4px_rgba(0,0,0,0.05)] dark:shadow-[inset_0_1px_4px_rgba(0,0,0,0.2)]" 
            : "text-theme-muted hover:bg-theme-border/50 hover:text-theme-text"
        )}
      >
        {isActive && (
          <motion.div layoutId="active-nav-bg" transition={animationsEnabled ? undefined : { duration: 0 }} className="absolute inset-0 bg-theme-accent/10 border border-theme-accent/20 rounded-2xl" />
        )}
        <item.icon className={cn("w-5 h-5 relative z-10 transition-colors shrink-0", isActive ? "text-theme-accent" : "group-hover:text-theme-text")} />
        {!isSidebarCollapsed && (
          <span className="font-medium relative z-10 whitespace-nowrap">{item.name}</span>
        )}
      </Link>

      {/* Custom Tooltip for Collapsed Mode */}
      {isSidebarCollapsed && (
        <div className="absolute left-full top-1/2 -translate-y-1/2 ml-4 pointer-events-none opacity-0 translate-x-[-10px] group-hover:opacity-100 group-hover:translate-x-0 transition-all duration-300 z-50">
          <div className="bg-theme-surface border border-theme-border text-theme-text text-sm font-medium px-3 py-1.5 rounded-lg shadow-xl whitespace-nowrap relative">
            {item.name}
            <div className="absolute top-1/2 -left-[5px] -translate-y-1/2 border-[5px] border-transparent border-r-theme-border" />
            <div className="absolute top-1/2 -left-[4px] -translate-y-1/2 border-[5px] border-transparent border-r-theme-surface" />
          </div>
        </div>
      )}
    </motion.div>
  );
}
// ---------------------------

export function Layout() {
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);
  const location = useLocation();

  const themeMode = useStore(state => state.themeMode);
  const themeId = useStore(state => state.themeId);
  const customThemes = useStore(state => state.customThemes);
  const animationsEnabled = useStore(state => state.animationsEnabled);
  // fallback for backward compatibility
  const themeColorState = useStore(state => state.themeColor);

  const [isNavigating, setIsNavigating] = useState(false);
  const [displayLocation, setDisplayLocation] = useState(location);
  const mouseY = useMotionValue(Infinity);

  useEffect(() => {
    if (location.pathname !== displayLocation.pathname) {
      if (!animationsEnabled) {
        setDisplayLocation(location);
        return;
      }
      setIsNavigating(true);
      const timer = setTimeout(() => {
        setDisplayLocation(location);
        setIsNavigating(false);
      }, 500); // Show loading effect for 500ms
      return () => clearTimeout(timer);
    }
  }, [location, displayLocation, animationsEnabled]);

  const activeColor = useMemo(() => {
    const allThemes = [...DEFAULT_THEMES, ...customThemes];
    const theme = allThemes.find(t => t.id === themeId);
    if (theme) {
      return themeMode === 'light' ? theme.lightColor : theme.darkColor;
    }
    return themeColorState; // fallback
  }, [themeId, customThemes, themeMode, themeColorState]);

  useEffect(() => {
    if (themeMode === 'dark') {
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
    { name: "Analytics", path: "/stats", icon: BarChart2 },
    { name: "Settings", path: "/settings", icon: Settings },
  ];

  const closeMenu = () => setIsMobileMenuOpen(false);

  return (
    <div className="flex h-screen overflow-hidden bg-theme-bg text-theme-text font-sans selection:bg-theme-accent/30 selection:text-theme-accent transition-colors duration-300">
      {/* Sidebar Desktop */}
      <motion.aside 
        initial={false}
        animate={{ width: isSidebarCollapsed ? 80 : 256 }}
        className="hidden md:flex flex-col border-r border-theme-border bg-theme-bg z-20 shrink-0 overflow-y-auto relative transition-colors duration-300"
      >
        <div className={cn("flex items-center mt-6 mb-10 transition-all duration-300", isSidebarCollapsed ? "justify-center px-4" : "gap-3 px-6")}>
          <button 
            onClick={() => setIsSidebarCollapsed(!isSidebarCollapsed)}
            className="group relative w-10 h-10 rounded-xl bg-theme-accent flex items-center justify-center shadow-lg shadow-theme-accent/20 shrink-0 overflow-hidden cursor-pointer hover:scale-105 transition-transform duration-300"
            title={isSidebarCollapsed ? "Expand sidebar" : "Collapse sidebar"}
          >
            <CheckSquare className={cn("w-5 h-5 text-theme-bg transition-all duration-300 absolute", "group-hover:opacity-0 group-hover:scale-50")} />
            {isSidebarCollapsed ? (
              <ChevronRight className={cn("w-6 h-6 text-theme-bg opacity-0 scale-50 transition-all duration-300 absolute", "group-hover:opacity-100 group-hover:scale-100")} />
            ) : (
              <ChevronLeft className={cn("w-6 h-6 text-theme-bg opacity-0 scale-50 transition-all duration-300 absolute", "group-hover:opacity-100 group-hover:scale-100")} />
            )}
          </button>
          {!isSidebarCollapsed && (
            <motion.h1 
              initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              className="text-xl font-medium tracking-tight text-theme-accent whitespace-nowrap"
            >
              Habitto
            </motion.h1>
          )}
        </div>

        <nav 
          className="flex-1 space-y-3 px-3 mt-4"
          onMouseMove={(e) => mouseY.set(e.clientY)}
          onMouseLeave={() => mouseY.set(Infinity)}
        >
          {navItems.map((item) => {
            const isActive = location.pathname === item.path;
            return (
              <DockIcon
                key={item.path}
                item={item}
                isActive={isActive}
                isSidebarCollapsed={isSidebarCollapsed}
                mouseY={mouseY}
                animationsEnabled={animationsEnabled}
              />
            )
          })}
        </nav>
      </motion.aside>

      {/* Main Content */}
      <main className="flex-1 flex flex-col h-screen relative overflow-y-auto">
        {/* Background glow effects */}
        <div className="fixed top-0 left-1/4 w-[50vw] h-[50vw] bg-theme-accent/5 rounded-full blur-[120px] pointer-events-none -translate-y-1/2 opacity-50 transition-colors duration-500" />
        <div className="fixed bottom-0 right-0 w-[40vw] h-[40vw] bg-theme-accent/10 rounded-full blur-[100px] pointer-events-none translate-x-1/3 translate-y-1/3 opacity-50 transition-colors duration-500" />

        {/* Mobile Header */}
        <header className="md:hidden flex items-center justify-between p-4 border-b border-theme-border bg-theme-bg/80 backdrop-blur-md sticky top-0 z-40 transition-colors duration-300">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-theme-accent flex items-center justify-center">
              <CheckSquare className="w-4 h-4 text-theme-bg" />
            </div>
            <h1 className="text-lg font-medium text-theme-accent">Habitto</h1>
          </div>
          <button onClick={() => setIsMobileMenuOpen(true)} className="p-2 text-theme-muted hover:text-theme-text">
            <Menu className="w-6 h-6" />
          </button>
        </header>

        {/* Mobile Menu Overlay */}
        <AnimatePresence>
          {isMobileMenuOpen && (
            <>
              <motion.div 
                initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 md:hidden"
                onClick={closeMenu}
              />
              <motion.div
                initial={{ x: "100%" }} animate={{ x: 0 }} exit={{ x: "100%" }}
                transition={{ type: "spring", damping: 25, stiffness: 200 }}
                className="fixed top-0 right-0 bottom-0 w-64 bg-theme-surface border-l border-theme-border z-50 p-6 shadow-2xl flex flex-col md:hidden"
              >
                <div className="flex items-center justify-between mb-8">
                  <h2 className="text-lg font-medium text-theme-text">Menu</h2>
                  <button onClick={closeMenu} className="p-2 text-theme-muted hover:text-theme-text">
                    <X className="w-5 h-5" />
                  </button>
                </div>
                <nav className="flex-1 space-y-2">
                  {navItems.map((item) => (
                    <Link
                      key={item.path}
                      to={item.path}
                      onClick={closeMenu}
                      className={cn(
                        "flex items-center gap-3 px-4 py-3 rounded-xl transition-all",
                        location.pathname === item.path ? "bg-theme-accent/10 text-theme-accent border border-theme-accent/20" : "text-theme-muted"
                      )}
                    >
                      <item.icon className="w-5 h-5" />
                      <span className="font-medium">{item.name}</span>
                    </Link>
                  ))}
                </nav>
              </motion.div>
            </>
          )}
        </AnimatePresence>

        <div className="flex-1 p-4 md:p-8 lg:p-10 max-w-7xl mx-auto w-full relative z-10 pb-32 md:pb-10">
          <AnimatePresence mode="wait">
            {!isNavigating && (
              <motion.div
                key={location.pathname}
                initial={animationsEnabled ? { opacity: 0, y: 5 } : { opacity: 1, y: 0 }}
                animate={{ opacity: 1, y: 0 }}
                exit={animationsEnabled ? { opacity: 0, y: -5 } : { opacity: 1, y: 0 }}
                transition={animationsEnabled ? { duration: 0.3, ease: "easeOut" } : { duration: 0 }}
              >
                <Outlet />
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* Page Transition Loading Overlay */}
        <AnimatePresence>
          {isNavigating && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.2, ease: "easeInOut" }}
              className="fixed inset-0 z-[999] bg-theme-bg flex flex-col items-center justify-center pointer-events-none"
            >
              <motion.div
                initial={{ scale: 0.8, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                exit={{ scale: 0.9, opacity: 0 }}
                transition={{ duration: 0.3, ease: "easeOut" }}
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
                  transition={{ delay: 0.1, duration: 0.3 }}
                  className="text-2xl font-medium tracking-tight text-theme-text"
                >
                  Habitto
                </motion.h1>
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>
      </main>
    </div>
  );
}
