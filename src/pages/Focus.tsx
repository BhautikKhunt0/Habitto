import React, { useState, useEffect, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Play, Pause, RotateCcw } from "lucide-react";
import { cn } from "../lib/utils";

const MAX_SECONDS = 24 * 60 * 60; // 24 Hours Max (86400 seconds)

const AnimatedNumber = ({ value }: { value: string }) => {
  return (
    <div className="flex items-center justify-center h-[1.2em] min-w-[1.2em]">
      {value.split("").map((char, index) => (
        <div key={index} className="relative flex items-center justify-center overflow-hidden h-[1.2em]">
          <AnimatePresence mode="popLayout" initial={false}>
            <motion.span
              key={`${index}-${char}`}
              initial={{ y: "-100%", opacity: 0, filter: "blur(2px)", scale: 0.9 }}
              animate={{ y: "0%", opacity: 1, filter: "blur(0px)", scale: 1 }}
              exit={{ y: "100%", opacity: 0, filter: "blur(2px)", scale: 0.9 }}
              transition={{ duration: 0.35, ease: "easeOut" }}
              className="inline-flex items-center justify-center tabular-nums leading-none"
            >
              {char}
            </motion.span>
          </AnimatePresence>
        </div>
      ))}
    </div>
  );
};

export function Focus() {
  const [totalSeconds, setTotalSeconds] = useState(25 * 60);
  const [timeLeft, setTimeLeft] = useState(25 * 60);
  const [isActive, setIsActive] = useState(false);
  const [progress, setProgress] = useState(0);
  const [purpose, setPurpose] = useState("");

  // Clean numerical string states for the input boxes
  const [hoursInput, setHoursInput] = useState("00");
  const [minutesInput, setMinutesInput] = useState("25");
  const [secondsInput, setSecondsInput] = useState("00");

  const [activeUnit, setActiveUnit] = useState<"hours" | "minutes" | "seconds" | null>(null);

  const endTimeRef = useRef<number | null>(null);
  const totalTimeRef = useRef<number>(25 * 60);

  const hoursRef = useRef<HTMLInputElement>(null);
  const minutesRef = useRef<HTMLInputElement>(null);
  const secondsRef = useRef<HTMLInputElement>(null);

  // Ref to hold the latest input values to avoid stale closures during rapid typing/blur events
  const inputValuesRef = useRef({ h: "00", m: "25", s: "00" });

  // Sync inputs with timeLeft when timer is idle and not focused
  useEffect(() => {
    if (!isActive && !activeUnit) {
      const h = Math.floor(timeLeft / 3600);
      const m = Math.floor((timeLeft % 3600) / 60);
      const s = timeLeft % 60;
      
      const hStr = h.toString().padStart(2, "0");
      const mStr = m.toString().padStart(2, "0");
      const sStr = s.toString().padStart(2, "0");

      setHoursInput(hStr);
      setMinutesInput(mStr);
      setSecondsInput(sStr);
      inputValuesRef.current = { h: hStr, m: mStr, s: sStr };
    }
  }, [timeLeft, isActive, activeUnit]);

  // Audio chime
  const playChime = () => {
    try {
      const AudioCtx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      const ctx = new AudioCtx();
      const now = ctx.currentTime;

      // Note 1
      const osc1 = ctx.createOscillator();
      const gain1 = ctx.createGain();
      osc1.type = "sine";
      osc1.frequency.setValueAtTime(523.25, now);
      gain1.gain.setValueAtTime(0.25, now);
      gain1.gain.exponentialRampToValueAtTime(0.001, now + 0.8);
      osc1.connect(gain1);
      gain1.connect(ctx.destination);
      osc1.start(now);
      osc1.stop(now + 0.8);

      // Note 2
      const osc2 = ctx.createOscillator();
      const gain2 = ctx.createGain();
      osc2.type = "sine";
      osc2.frequency.setValueAtTime(659.25, now + 0.15);
      gain2.gain.setValueAtTime(0.25, now + 0.15);
      gain2.gain.exponentialRampToValueAtTime(0.001, now + 1.2);
      osc2.connect(gain2);
      gain2.connect(ctx.destination);
      osc2.start(now + 0.15);
      osc2.stop(now + 1.2);

      // Note 3
      const osc3 = ctx.createOscillator();
      const gain3 = ctx.createGain();
      osc3.type = "sine";
      osc3.frequency.setValueAtTime(783.99, now + 0.3);
      gain3.gain.setValueAtTime(0.3, now + 0.3);
      gain3.gain.exponentialRampToValueAtTime(0.001, now + 1.6);
      osc3.connect(gain3);
      gain3.connect(ctx.destination);
      osc3.start(now + 0.3);
      osc3.stop(now + 1.6);
    } catch {
      // Audio context may be restricted
    }
  };

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
        endTimeRef.current = null;
        setProgress(1);
        playChime();
      }
    };

    if (isActive) {
      if (!endTimeRef.current) {
        endTimeRef.current = Date.now() + timeLeft * 1000;
        totalTimeRef.current = totalSeconds;
      }
      frameId = requestAnimationFrame(tick);
    } else {
      endTimeRef.current = null;
    }

    return () => {
      if (frameId) cancelAnimationFrame(frameId);
    };
  }, [isActive, timeLeft, totalSeconds]);

  // Recalculate duration from direct string values
  const commitTime = (hVal: string, mVal: string, sVal: string) => {
    let h = parseInt(hVal, 10);
    let m = parseInt(mVal, 10);
    let s = parseInt(sVal, 10);

    if (isNaN(h) || h < 0) h = 0;
    if (isNaN(m) || m < 0) m = 0;
    if (isNaN(s) || s < 0) s = 0;

    if (h > 24) h = 24;
    if (h === 24) {
      m = 0;
      s = 0;
    } else {
      if (m > 59) m = 59;
      if (s > 59) s = 59;
    }

    let total = h * 3600 + m * 60 + s;
    if (total > MAX_SECONDS) total = MAX_SECONDS;
    if (total <= 0) total = 60; // 1 min default if all 0

    const formattedH = Math.floor(total / 3600).toString().padStart(2, "0");
    const formattedM = Math.floor((total % 3600) / 60).toString().padStart(2, "0");
    const formattedS = (total % 60).toString().padStart(2, "0");

    setHoursInput(formattedH);
    setMinutesInput(formattedM);
    setSecondsInput(formattedS);
    inputValuesRef.current = { h: formattedH, m: formattedM, s: formattedS };

    setTotalSeconds(total);
    setTimeLeft(total);
    totalTimeRef.current = total;
    setProgress(0);
    return total;
  };

  const handleInputChange = (
    unit: "hours" | "minutes" | "seconds",
    e: React.ChangeEvent<HTMLInputElement>
  ) => {
    // strictly numbers
    let raw = e.target.value.replace(/\D/g, "");
    
    // If they typed into an existing value and it exceeded 2 digits, take the last 2 digits (microwave timer behavior)
    if (raw.length > 2) {
      raw = raw.slice(-2);
    }

    if (unit === "hours") {
      inputValuesRef.current.h = raw;
      setHoursInput(raw);
      if (raw.length === 2) {
        minutesRef.current?.focus();
        minutesRef.current?.select();
      }
    } else if (unit === "minutes") {
      inputValuesRef.current.m = raw;
      setMinutesInput(raw);
      if (raw.length === 2) {
        secondsRef.current?.focus();
        secondsRef.current?.select();
      }
    } else if (unit === "seconds") {
      inputValuesRef.current.s = raw;
      setSecondsInput(raw);
    }
  };

  const handleKeyDown = (
    unit: "hours" | "minutes" | "seconds",
    e: React.KeyboardEvent<HTMLInputElement>
  ) => {
    if (e.key === "ArrowRight" || e.key === ":") {
      e.preventDefault();
      if (unit === "hours") {
        minutesRef.current?.focus();
        minutesRef.current?.select();
      } else if (unit === "minutes") {
        secondsRef.current?.focus();
        secondsRef.current?.select();
      }
    } else if (e.key === "ArrowLeft") {
      if (unit === "seconds" && (e.currentTarget.selectionStart === 0 || e.currentTarget.value.length === 0)) {
        e.preventDefault();
        minutesRef.current?.focus();
        minutesRef.current?.select();
      } else if (unit === "minutes" && (e.currentTarget.selectionStart === 0 || e.currentTarget.value.length === 0)) {
        e.preventDefault();
        hoursRef.current?.focus();
        hoursRef.current?.select();
      }
    } else if (e.key === "Enter") {
      e.preventDefault();
      commitTime(inputValuesRef.current.h, inputValuesRef.current.m, inputValuesRef.current.s);
      e.currentTarget.blur();
      toggleTimer();
    }
  };

  const handleBlur = (e: React.FocusEvent<HTMLInputElement>) => {
    // If moving to another time input field, don't format/commit yet
    const relatedTarget = e.relatedTarget as HTMLElement;
    if (relatedTarget && relatedTarget.closest('.timer-inputs-container')) {
      return;
    }
    
    setActiveUnit(null);
    commitTime(inputValuesRef.current.h, inputValuesRef.current.m, inputValuesRef.current.s);
  };

  const toggleTimer = () => {
    if (timeLeft === 0) {
      resetTimer();
      return;
    }
    if (!isActive) {
      const h = parseInt(inputValuesRef.current.h, 10) || 0;
      const m = parseInt(inputValuesRef.current.m, 10) || 0;
      const s = parseInt(inputValuesRef.current.s, 10) || 0;
      const inputTotal = h * 3600 + m * 60 + s;
      
      // If the inputs don't match the paused time, it means they were edited, so commit them as a new total.
      if (inputTotal !== Math.floor(timeLeft)) {
        commitTime(inputValuesRef.current.h, inputValuesRef.current.m, inputValuesRef.current.s);
      }
    }
    setIsActive(!isActive);
  };

  const resetTimer = () => {
    setIsActive(false);
    endTimeRef.current = null;
    setTimeLeft(totalSeconds);
    totalTimeRef.current = totalSeconds;
    setProgress(0);
    const h = Math.floor(totalSeconds / 3600);
    const m = Math.floor((totalSeconds % 3600) / 60);
    const s = totalSeconds % 60;
    
    const hStr = h.toString().padStart(2, "0");
    const mStr = m.toString().padStart(2, "0");
    const sStr = s.toString().padStart(2, "0");
    
    setHoursInput(hStr);
    setMinutesInput(mStr);
    setSecondsInput(sStr);
    inputValuesRef.current = { h: hStr, m: mStr, s: sStr };
  };

  // Format running display
  const runningH = Math.floor(timeLeft / 3600).toString().padStart(2, "0");
  const runningM = Math.floor((timeLeft % 3600) / 60).toString().padStart(2, "0");
  const runningS = (timeLeft % 60).toString().padStart(2, "0");

  return (
    <div className="flex flex-col items-center justify-center w-full max-w-xl mx-auto py-8 px-4">
      
      {/* Top Header Badge */}
      <div className="flex items-center gap-2 px-4 py-1.5 rounded-full bg-theme-surface border border-theme-border/70 shadow-sm mb-6">
        <div className={cn(
          "w-2.5 h-2.5 rounded-full transition-colors duration-300",
          isActive ? "bg-emerald-500" : "bg-theme-accent"
        )} />
        <span className="text-sm font-semibold tracking-wider uppercase text-theme-text">Focus</span>
      </div>

      {/* Clean Purpose / Goal Input without Boxy Outline */}
      <div className="w-full max-w-md mb-8 flex flex-col items-center">
        <input
          type="text"
          value={purpose}
          onChange={(e) => setPurpose(e.target.value)}
          readOnly={isActive}
          placeholder="What are you focusing on?"
          className={cn(
            "w-full bg-transparent text-center font-display text-lg md:text-xl font-medium text-theme-text placeholder:text-theme-muted/40 focus:outline-none py-1.5 transition-all border-b border-transparent",
            isActive ? "cursor-default text-theme-text/90" : "hover:border-theme-border/60 focus:border-theme-text/40"
          )}
        />
      </div>

      {/* Main Focus Display */}
      <div className="relative flex items-center justify-center select-none py-12">
        
        {/* Center Inline Typing Timer Controls */}
        <div className="flex flex-col items-center justify-center z-10 w-full px-4">
          
          <div className="flex flex-col items-center timer-inputs-container relative">
            
            {/* The Timer Digits (Both active and inactive share the exact same layout) */}
            <div className="flex items-center justify-center text-5xl md:text-6xl font-display font-light text-theme-text leading-none">
              
              {isActive ? (
                <>
                  <div className="w-16 md:w-20 flex justify-center tabular-nums">
                    <AnimatedNumber value={runningH} />
                  </div>
                  <span className="text-theme-text/40 font-light mx-0.5 -translate-y-1 select-none">:</span>
                  <div className="w-16 md:w-20 flex justify-center tabular-nums">
                    <AnimatedNumber value={runningM} />
                  </div>
                  <span className="text-theme-text/40 font-light mx-0.5 -translate-y-1 select-none">:</span>
                  <div className="w-16 md:w-20 flex justify-center tabular-nums">
                    <AnimatedNumber value={runningS} />
                  </div>
                </>
              ) : (
                <>
                  {/* Hours Unit */}
                  <input
                    ref={hoursRef}
                    type="text"
                    inputMode="numeric"
                    pattern="[0-9]*"
                    placeholder="00"
                    value={hoursInput}
                    onClick={(e) => e.currentTarget.select()}
                    onFocus={(e) => {
                      setActiveUnit("hours");
                      e.target.select();
                    }}
                    onChange={(e) => handleInputChange("hours", e)}
                    onBlur={handleBlur}
                    onKeyDown={(e) => handleKeyDown("hours", e)}
                    className={cn(
                      "w-16 md:w-20 h-[1.2em] bg-transparent text-center text-5xl md:text-6xl font-display font-light text-theme-text tabular-nums focus:outline-none rounded-xl transition-all duration-200 cursor-text p-0 placeholder:text-theme-muted/30",
                      activeUnit === "hours" ? "bg-theme-surface/80 shadow-inner text-theme-accent ring-1 ring-theme-accent/30" : "hover:bg-theme-surface/30"
                    )}
                  />

                  <span className="text-theme-text/40 font-light mx-0.5 -translate-y-1 select-none">:</span>

                  {/* Minutes Unit */}
                  <input
                    ref={minutesRef}
                    type="text"
                    inputMode="numeric"
                    pattern="[0-9]*"
                    placeholder="00"
                    value={minutesInput}
                    onClick={(e) => e.currentTarget.select()}
                    onFocus={(e) => {
                      setActiveUnit("minutes");
                      e.target.select();
                    }}
                    onChange={(e) => handleInputChange("minutes", e)}
                    onBlur={handleBlur}
                    onKeyDown={(e) => handleKeyDown("minutes", e)}
                    className={cn(
                      "w-16 md:w-20 h-[1.2em] bg-transparent text-center text-5xl md:text-6xl font-display font-light text-theme-text tabular-nums focus:outline-none rounded-xl transition-all duration-200 cursor-text p-0 placeholder:text-theme-muted/30",
                      activeUnit === "minutes" ? "bg-theme-surface/80 shadow-inner text-theme-accent ring-1 ring-theme-accent/30" : "hover:bg-theme-surface/30"
                    )}
                  />

                  <span className="text-theme-text/40 font-light mx-0.5 -translate-y-1 select-none">:</span>

                  {/* Seconds Unit */}
                  <input
                    ref={secondsRef}
                    type="text"
                    inputMode="numeric"
                    pattern="[0-9]*"
                    placeholder="00"
                    value={secondsInput}
                    onClick={(e) => e.currentTarget.select()}
                    onFocus={(e) => {
                      setActiveUnit("seconds");
                      e.target.select();
                    }}
                    onChange={(e) => handleInputChange("seconds", e)}
                    onBlur={handleBlur}
                    onKeyDown={(e) => handleKeyDown("seconds", e)}
                    className={cn(
                      "w-16 md:w-20 h-[1.2em] bg-transparent text-center text-5xl md:text-6xl font-display font-light text-theme-text tabular-nums focus:outline-none rounded-xl transition-all duration-200 cursor-text p-0 placeholder:text-theme-muted/30",
                      activeUnit === "seconds" ? "bg-theme-surface/80 shadow-inner text-theme-accent ring-1 ring-theme-accent/30" : "hover:bg-theme-surface/30"
                    )}
                  />
                </>
              )}
            </div>

            {/* Labels below digits - always in DOM so height never shifts */}
            <div className={cn(
              "flex items-center justify-between w-full max-w-[210px] text-[11px] font-semibold uppercase tracking-widest text-theme-muted mt-3 px-2 select-none transition-opacity duration-300",
              isActive ? "opacity-0 pointer-events-none" : "opacity-100"
            )}>
              <span>Hours</span>
              <span>Mins</span>
              <span>Secs</span>
            </div>
            
          </div>
        </div>
      </div>

      {/* Primary Action Controls: Play/Pause is 100% Dead-Centered */}
      <div className="relative flex items-center justify-center mt-10 w-full">
        {/* Reset button positioned to the left without shifting Play/Pause from dead-center */}
        {(progress > 0 || timeLeft !== totalSeconds || isActive) && (
          <button
            onClick={resetTimer}
            title="Reset timer"
            className="absolute right-[calc(50%+54px)] w-12 h-12 rounded-full flex items-center justify-center bg-theme-surface border border-theme-border text-theme-muted hover:text-theme-text transition-all active:scale-95 shadow-sm hover:border-theme-text/40 z-10"
          >
            <RotateCcw className="w-5 h-5" />
          </button>
        )}

        {/* Play / Pause button - 100% horizontal center */}
        <button
          onClick={toggleTimer}
          className={cn(
            "w-20 h-20 rounded-full flex items-center justify-center transition-all duration-300 active:scale-95 group relative shadow-xl z-10",
            isActive || timeLeft === 0
              ? "bg-theme-surface border-2 border-theme-border text-theme-text hover:border-theme-text hover:shadow-2xl"
              : "bg-theme-text text-theme-bg shadow-theme-text/25 hover:scale-105"
          )}
        >
          {!isActive && progress === 0 && timeLeft > 0 && (
            <div className="absolute inset-0 rounded-full border border-theme-text/40 animate-ping" style={{ animationDuration: '2.5s' }} />
          )}
          <div className={cn("relative z-10", !isActive && timeLeft > 0 && "ml-1")}>
            {timeLeft === 0 ? (
              <RotateCcw className="w-8 h-8" />
            ) : isActive ? (
              <Pause className="w-8 h-8 fill-current" />
            ) : (
              <Play className="w-8 h-8 fill-current" />
            )}
          </div>
        </button>
      </div>

    </div>
  );
}
