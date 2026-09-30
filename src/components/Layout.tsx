import { Link, Outlet, useLocation } from "react-router-dom";
import { LayoutDashboard, CheckSquare, BarChart2, Settings, Book, Kanban, Timer, Shapes } from "lucide-react";
import { useEffect, useMemo, useRef, type FC, type MouseEvent as ReactMouseEvent } from "react";
import { cn, hexToRgb } from "../lib/utils";
import { motion } from "framer-motion";
import { useStore, DEFAULT_THEMES } from "../store/useStore";

const DockIcon: FC<{
  item: any,
  isActive: boolean,
}> = ({
  item,
  isActive,
}) => {
  return (
    <div className="relative group z-10">
      <Link
        to={item.path}
        className={cn(
          "relative flex items-center justify-center w-10 h-10 md:w-12 md:h-12 rounded-full transition-colors duration-300 hover:-translate-y-0.5 transition-transform",
          isActive
            ? "text-theme-bg"
            : "text-theme-muted hover:bg-theme-text/[0.06] hover:text-theme-text"
        )}
      >
        {isActive && (
          <motion.span
            layoutId="habitto-dock-pill"
            transition={{ type: "spring", damping: 32, stiffness: 420, mass: 0.9 }}
            className="absolute inset-0 rounded-full bg-theme-accent shadow-[0_6px_20px_rgb(var(--accent-rgb)/0.45)]"
          />
        )}
        <item.icon className={cn("w-5 h-5 relative z-10", isActive && "[filter:drop-shadow(0_0_6px_rgb(var(--accent-rgb)/0.6))]")} />
      </Link>

      {/* Tooltip */}
      <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-3 pointer-events-none opacity-0 translate-y-[10px] group-hover:opacity-100 group-hover:translate-y-0 transition-all duration-300 z-50">
        <div className="bg-theme-text text-theme-bg text-xs font-semibold tracking-wide px-3 py-1.5 rounded-full shadow-xl whitespace-nowrap">
          {item.name}
        </div>
      </div>
    </div>
  );
};

export function Layout() {
  const location = useLocation();

  const isCanvas = location.pathname === "/canvas";

  const themeMode = useStore(state => state.themeMode);
  const themeId = useStore(state => state.themeId);
  const customThemes = useStore(state => state.customThemes);
  const themeColorState = useStore(state => state.themeColor);

  const mainRef = useRef<HTMLElement>(null);
  const navRef = useRef<HTMLElement>(null);
  const beamRaf = useRef(0);

  // Thin neon edge locked precisely to the cursor's border point (no lag, no follower dot)
  const handleNeonMove = (e: ReactMouseEvent<HTMLElement>) => {
    const node = navRef.current;
    if (!node) return;
    const rect = node.getBoundingClientRect();
    const px = e.clientX - rect.left;
    const py = e.clientY - rect.top;
    cancelAnimationFrame(beamRaf.current);
    beamRaf.current = requestAnimationFrame(() => {
      const clamp = (v: number, a: number, b: number) => Math.max(a, Math.min(b, v));
      let nx = clamp(px, 0, rect.width);
      let ny = clamp(py, 0, rect.height);
      const inside = px >= 0 && px <= rect.width && py >= 0 && py <= rect.height;
      if (inside) {
        const dl = px, dr = rect.width - px, dt = py, db = rect.height - py;
        const m = Math.min(dl, dr, dt, db);
        if (m === dl) nx = 0;
        else if (m === dr) nx = rect.width;
        else if (m === dt) ny = 0;
        else ny = rect.height;
      }
      const ang = Math.atan2(ny - rect.height / 2, nx - rect.width / 2) * 180 / Math.PI + 90;
      node.style.setProperty("--mx", `${px}px`);
      node.style.setProperty("--my", `${py}px`);
      node.style.setProperty("--ang", `${ang}deg`);
      node.style.setProperty("--beam", "1");
    });
  };

  const handleNeonLeave = () => {
    cancelAnimationFrame(beamRaf.current);
    navRef.current?.style.setProperty("--beam", "0");
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
    { name: "Canvas", path: "/canvas", icon: Shapes },
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

        {/* Top Branding (Minimal) — hidden on the full-bleed canvas route */}
        {!isCanvas && (
          <header className="w-full flex items-center justify-between p-6 md:px-12 md:py-8 max-w-7xl mx-auto">
            <Link to="/" className="flex items-center gap-3 hover:opacity-80 transition-opacity">
              <div className="w-8 h-8 rounded-xl bg-theme-text flex items-center justify-center">
                <CheckSquare className="w-4 h-4 text-theme-bg" />
              </div>
              <h1 className="text-xl font-display font-medium tracking-tight text-theme-text">Habitto</h1>
            </Link>
          </header>
        )}

        {/* Scrollable Content wrapper — full-bleed on the canvas route only */}
        <div className={isCanvas ? "flex-1 w-full h-full min-h-0" : "flex-1 w-full max-w-7xl mx-auto px-4 md:px-12 pb-40"}>
          <div className="h-full">
            <Outlet />
          </div>
        </div>
      </main>

      {/* Floating Dock Navigation — fixed bottom-center, sliding pill + thin cursor-tracked neon edge */}
      <motion.nav
        ref={navRef}
        onMouseMove={handleNeonMove}
        onMouseLeave={handleNeonLeave}
        initial={{ opacity: 0, y: 50, filter: "blur(6px)" }}
        animate={{ opacity: 1, y: 0, filter: "blur(0px)" }}
        transition={{ type: "spring", damping: 28, stiffness: 320 }}
        className="neon-dock fixed z-50 flex flex-row items-center gap-2 md:gap-4 p-2 md:p-3 rounded-full shadow-2xl shadow-black/10 dark:shadow-[0_20px_40px_rgb(0,0,0,0.4)] bottom-8 left-1/2 -translate-x-1/2"
      >
        <div className="absolute inset-0 rounded-full pointer-events-none -z-10" style={{ backdropFilter: 'blur(24px)', WebkitBackdropFilter: 'blur(24px)' }} />
        {navItems.map((item) => (
          <DockIcon
            key={item.path}
            item={item}
            isActive={location.pathname === item.path}
          />
        ))}
      </motion.nav>
    </div>
  );
}
