import React, { useState, useEffect, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Play, Pause, RotateCcw, Check, Sparkles, Minus, Plus } from "lucide-react";
import { cn } from "../lib/utils";

type TimerMode = "pomodoro" | "shortBreak" | "longBreak" | "custom";

const MODE_DURATIONS: Record<TimerMode, number> = {
  pomodoro: 25 * 60,
  shortBreak: 5 * 60,
  longBreak: 15 * 60,
  custom: 25 * 60,
};

const AnimatedDigit: React.FC<{ digit: string, isNumber: boolean }> = ({ digit, isNumber }) => {
  if (!isNumber) {
    return <span className="inline-block text-theme-text/20 mx-1 -translate-y-[0.05em]">{digit}</span>;
  }
  return (
    <span className="relative inline-block w-[0.55em] text-center tabular-nums">
      <AnimatePresence>
        <motion.span
          key={digit}
          initial={{ y: "25%", opacity: 0, filter: "blur(8px)", scale: 0.9 }}
          animate={{ y: "0%", opacity: 1, filter: "blur(0px)", scale: 1 }}
          exit={{ y: "-25%", opacity: 0, filter: "blur(8px)", scale: 0.9 }}
          transition={{ type: "spring", stiffness: 350, damping: 35 }}
          className="absolute inset-0 flex items-center justify-center"
        >
          {digit}
        </motion.span>
      </AnimatePresence>
      <span className="invisible">{digit}</span>
    </span>
  );
};

export function Focus() {
  const [mode, setMode] = useState<TimerMode>("pomodoro");
  const [timeLeft, setTimeLeft] = useState(MODE_DURATIONS.pomodoro);
  const [isActive, setIsActive] = useState(false);
  const [customMinutes, setCustomMinutes] = useState(25);
  const [sessionCount, setSessionCount] = useState(0);
  const [progress, setProgress] = useState(0);

  const endTimeRef = useRef<number | null>(null);
  const totalTimeRef = useRef<number>(MODE_DURATIONS.pomodoro);

  useEffect(() => {
    let frameId: number;

    const tick = () => {
      if (!isActive || !endTimeRef.current) return;

      const now = Date.now();
      const remainingMs = Math.max(0, endTimeRef.current - now);
      const remainingSec = Math.ceil(remainingMs / 1000);
      
      if (remainingSec !== timeLeft) {
        setTimeLeft(remainingSec);
      }
      
      const p = 1 - (remainingMs / 1000) / totalTimeRef.current;
      setProgress(Math.min(1, Math.max(0, p)));

      if (remainingMs > 0) {
        frameId = requestAnimationFrame(tick);
      } else {
        setIsActive(false);
        if (mode === "pomodoro" || mode === "custom") {
          setSessionCount(c => c + 1);
        }
        endTimeRef.current = null;
      }
    };

    if (isActive) {
      if (!endTimeRef.current) {
         endTimeRef.current = Date.now() + timeLeft * 1000;
         totalTimeRef.current = mode === "custom" ? customMinutes * 60 : MODE_DURATIONS[mode];
      }
      frameId = requestAnimationFrame(tick);
    } else {
      endTimeRef.current = null; // Pause: reset end time so it recalculates on resume
    }

    return () => {
      if (frameId) cancelAnimationFrame(frameId);
    };
  }, [isActive, timeLeft, mode, customMinutes]);

  useEffect(() => {
    const time = mode === "custom" ? customMinutes * 60 : MODE_DURATIONS[mode];
    setTimeLeft(time);
    totalTimeRef.current = time;
    setProgress(0);
    setIsActive(false);
    endTimeRef.current = null;
  }, [mode, customMinutes]);

  const toggleTimer = () => setIsActive(!isActive);

  const resetTimer = () => {
    setIsActive(false);
    endTimeRef.current = null;
    const time = mode === "custom" ? customMinutes * 60 : MODE_DURATIONS[mode];
    setTimeLeft(time);
    setProgress(0);
  };

  const formatTime = (seconds: number) => {
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    return `${m.toString().padStart(2, "0")}:${s.toString().padStart(2, "0")}`;
  };

  const radius = 176;
  const stroke = 3;
  const normalizedRadius = radius;
  const circumference = normalizedRadius * 2 * Math.PI;
  const strokeDashoffset = circumference - progress * circumference;

  return (
    <div className="flex flex-col items-center justify-center min-h-[calc(100vh-8rem)] w-full max-w-4xl mx-auto px-4">
      
      {/* Mode Selector */}
      <div className="flex bg-theme-surface/50 p-1.5 rounded-full mb-16 z-10 border border-theme-border/50">
        {(["pomodoro", "shortBreak", "longBreak", "custom"] as TimerMode[]).map((m) => (
          <button
            key={m}
            onClick={() => setMode(m)}
            className={cn(
              "px-5 py-2.5 text-sm font-medium tracking-wide transition-all duration-300 relative rounded-full",
              mode === m ? "text-theme-bg" : "text-theme-muted hover:text-theme-text"
            )}
          >
            {mode === m && (
              <motion.div
                layoutId="active-mode-pill"
                className="absolute inset-0 bg-theme-text rounded-full -z-10"
                transition={{ type: "spring", bounce: 0.2, duration: 0.6 }}
              />
            )}
            <span className="relative z-10">
              {m === "pomodoro" ? "Focus" :
               m === "shortBreak" ? "Short Break" :
               m === "longBreak" ? "Long Break" : "Custom"}
            </span>
          </button>
        ))}
      </div>

      {/* Timer Circular Display */}
      <div className="relative w-[420px] h-[420px] flex items-center justify-center mb-16 z-10">
        
        {/* SVG Progress Ring */}
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
          {/* Rotating dashed background ring when active */}
          <motion.svg
            height={420}
            width={420}
            className="absolute inset-0 text-theme-border/20"
            animate={{ rotate: isActive ? 360 : 0 }}
            transition={{ duration: 40, repeat: Infinity, ease: "linear" }}
          >
            <circle
              stroke="currentColor"
              fill="transparent"
              strokeWidth={1}
              strokeDasharray="4 8"
              r={normalizedRadius + 16}
              cx={210}
              cy={210}
            />
          </motion.svg>
          
          <svg
            height={420}
            width={420}
            className="transform -rotate-90 overflow-visible"
          >
            <defs>
              <linearGradient id="timer-gradient" x1="0%" y1="0%" x2="100%" y2="100%">
                <stop offset="0%" stopColor="currentColor" stopOpacity="0.4" />
                <stop offset="100%" stopColor="currentColor" stopOpacity="1" />
              </linearGradient>
              <filter id="glow" x="-20%" y="-20%" width="140%" height="140%">
                <feGaussianBlur stdDeviation="8" result="blur" />
                <feComposite in="SourceGraphic" in2="blur" operator="over" />
              </filter>
            </defs>
            <circle
              stroke="currentColor"
              fill="transparent"
              strokeWidth={stroke}
              r={normalizedRadius}
              cx={210}
              cy={210}
              className="text-theme-border/10"
            />
            <circle
              stroke="url(#timer-gradient)"
              fill="transparent"
              strokeWidth={stroke}
              strokeDasharray={circumference + " " + circumference}
              style={{ strokeDashoffset }}
              strokeLinecap="round"
              r={normalizedRadius}
              cx={210}
              cy={210}
              className="text-theme-text transition-none"
              filter="url(#glow)"
            />
          </svg>

          {/* Orbiting dot */}
          <div 
            className="absolute inset-0 transition-none"
            style={{ transform: `rotate(${progress * 360}deg)` }}
          >
            <div 
              className={cn(
                "absolute top-0 left-1/2 -translate-x-1/2 -translate-y-1/2 w-4 h-4 rounded-full bg-theme-bg border-[3px] border-theme-text shadow-[0_0_15px_currentColor] text-theme-text transition-opacity duration-300",
                isActive || progress > 0 ? "opacity-100" : "opacity-0"
              )}
              style={{ marginTop: 210 - normalizedRadius }}
            />
          </div>
        </div>

        {/* Time Display */}
        <div className="flex flex-col items-center z-10">
          <div className="text-[6.5rem] font-display font-light text-theme-text tabular-nums tracking-tighter leading-none select-none flex justify-center items-center">
            {formatTime(timeLeft).split('').map((char, i) => (
              <AnimatedDigit key={i} digit={char} isNumber={!isNaN(Number(char))} />
            ))}
          </div>
          
          <AnimatePresence>
            {mode === "custom" && !isActive && (
              <motion.div 
                initial={{ opacity: 0, y: 10, scale: 0.95 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, y: -10, scale: 0.95 }}
                className="mt-6 flex items-center gap-1 bg-theme-surface/80 backdrop-blur-md border border-theme-border rounded-full p-1 shadow-sm"
              >
                <button
                  onClick={() => setCustomMinutes(Math.max(1, customMinutes - 5))}
                  className="w-8 h-8 flex items-center justify-center rounded-full text-theme-muted hover:bg-theme-text/5 hover:text-theme-text transition-colors"
                >
                  <Minus className="w-3.5 h-3.5" />
                </button>
                <div className="flex items-baseline justify-center w-16">
                  <input 
                    type="number" 
                    value={customMinutes}
                    onChange={(e) => setCustomMinutes(Math.max(1, Math.min(180, parseInt(e.target.value) || 1)))}
                    className="w-8 bg-transparent text-center font-display text-lg font-medium text-theme-text focus:outline-none placeholder-theme-muted [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                    min="1"
                    max="180"
                  />
                  <span className="text-theme-muted text-[10px] font-medium tracking-widest uppercase">Min</span>
                </div>
                <button
                  onClick={() => setCustomMinutes(Math.min(180, customMinutes + 5))}
                  className="w-8 h-8 flex items-center justify-center rounded-full text-theme-muted hover:bg-theme-text/5 hover:text-theme-text transition-colors"
                >
                  <Plus className="w-3.5 h-3.5" />
                </button>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>

      {/* Controls */}
      <div className="flex flex-col items-center gap-8 z-10 mt-4">
        <button
          onClick={timeLeft === 0 ? resetTimer : toggleTimer}
          className={cn(
            "w-24 h-24 rounded-full flex items-center justify-center transition-all duration-500 active:scale-95 group relative",
            isActive || timeLeft === 0
              ? "bg-theme-surface border border-theme-border text-theme-text hover:border-theme-text/80" 
              : "bg-theme-text text-theme-bg shadow-2xl shadow-theme-text/20 hover:scale-105"
          )}
        >
          {/* subtle ripple effect when paused */}
          {!isActive && progress === 0 && timeLeft > 0 && (
            <div className="absolute inset-0 rounded-full border border-theme-text/30 animate-ping" style={{ animationDuration: '3s' }} />
          )}
          <div className={cn("transition-transform duration-500 relative z-10", !isActive && timeLeft > 0 && "ml-1 group-hover:scale-110")}>
            {timeLeft === 0 ? <RotateCcw className="w-8 h-8" /> : isActive ? <Pause className="w-8 h-8 fill-current" /> : <Play className="w-8 h-8 fill-current" />}
          </div>
        </button>

        <div className="flex items-center gap-6">
          <button
            onClick={resetTimer}
            className="flex items-center gap-2 px-4 py-2 rounded-full text-xs font-medium tracking-widest uppercase text-theme-muted hover:text-theme-text hover:bg-theme-surface transition-all"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            Reset
          </button>
          
          <div className="w-1 h-1 rounded-full bg-theme-border" />

          <div className="flex items-center gap-2 px-4 py-2 rounded-full text-xs font-medium tracking-widest uppercase text-theme-muted">
            <Sparkles className="w-3.5 h-3.5" />
            {sessionCount} Session{sessionCount !== 1 ? 's' : ''}
          </div>
        </div>
      </div>
    </div>
  );
}
