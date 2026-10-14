import React, { useState, useEffect, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Bell, BellOff, Check, Play, Pause, RotateCcw } from "lucide-react";
import { useLocation } from "react-router-dom";
import { cn } from "../lib/utils";
import { useStore } from "../store/useStore";
import { dayKey } from "../lib/stats";
import { playCompletionChime } from "../lib/chime";
import {
  notificationPermission,
  notify,
  requestNotificationPermission,
  type NotifyPermission,
} from "../lib/notify";
import { OverlaySignal } from "../lib/overlay";
import { RainBackdrop } from "../components/RainBackdrop";

const MAX_SECONDS = 24 * 60 * 60; // 24 Hours Max (86400 seconds)

const ALERTS_KEY = "habitto:focus-alerts";

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
  const location = useLocation();
  const tasks = useStore((state) => state.tasks);

  /* Arriving from a habit card carries the habit with it: the purpose is
     pre-filled with its name and finishing the timer ticks it off. */
  const link = (location.state as { taskId?: string; date?: string } | null) ?? null;
  const [linked, setLinked] = useState<{ id: string; name: string; date: string } | null>(null);

  const [totalSeconds, setTotalSeconds] = useState(25 * 60);
  const [timeLeft, setTimeLeft] = useState(25 * 60);
  const [isActive, setIsActive] = useState(false);
  const [progress, setProgress] = useState(0);
  const [purpose, setPurpose] = useState("");

  /* Arriving from a habit card carries the habit with it: the purpose is
     pre-filled with its name and finishing the timer ticks it off. */
  useEffect(() => {
    if (!link?.taskId) {
      setLinked(null);
      return;
    }
    const task = tasks.find((t) => t.id === link.taskId);
    setLinked(task ? { id: task.id, name: task.name, date: link.date ?? dayKey(new Date()) } : null);
    if (task) setPurpose(task.name);
  }, [link?.taskId, link?.date, tasks]);

  // Clean numerical string states for the input boxes
  const [hoursInput, setHoursInput] = useState("00");
  const [minutesInput, setMinutesInput] = useState("25");
  const [secondsInput, setSecondsInput] = useState("00");

  const [activeUnit, setActiveUnit] = useState<"hours" | "minutes" | "seconds" | null>(null);

  const endTimeRef = useRef<number | null>(null);
  const totalTimeRef = useRef<number>(25 * 60);

  // The linked habit is read from the timer loop, which closes over older renders.
  const linkedRef = useRef(linked);
  useEffect(() => {
    linkedRef.current = linked;
  }, [linked]);

  const [finished, setFinished] = useState(false);

  /*
   * Alerts are a user preference, not user data, so they live in localStorage
   * rather than the app store. Read the browser's own permission separately —
   * the two can disagree, and that's exactly what the chip has to describe.
   */
  const [alertsOn, setAlertsOn] = useState<boolean>(() => {
    try {
      return localStorage.getItem(ALERTS_KEY) !== "off";
    } catch {
      return true;
    }
  });
  const [permission, setPermission] = useState<NotifyPermission>(() => notificationPermission());

  // finishSession is invoked from the worker callback, which holds a very old
  // closure — the toggle has to be read through a ref.
  const alertsRef = useRef(alertsOn);

  useEffect(() => {
    alertsRef.current = alertsOn;
    try {
      localStorage.setItem(ALERTS_KEY, alertsOn ? "on" : "off");
    } catch {
      // Private mode — the preference just won't survive a reload.
    }

    // The user can change site permissions in browser settings while we're open.
    const sync = () => setPermission(notificationPermission());
    window.addEventListener("focus", sync);
    return () => window.removeEventListener("focus", sync);
  }, [alertsOn]);

  const toggleAlerts = async () => {
    if (alertsOn) {
      setAlertsOn(false);
      return;
    }

    // Browsers only allow the permission prompt from a real gesture, and only
    // while the site is still un-decided — once blocked, nothing we can do.
    if (notificationPermission() === "default") {
      setPermission(await requestNotificationPermission());
    }
    setAlertsOn(true);
  };

  /*
   * Both the interval below and the worker can spot the end of the session, so
   * the first one to get there wins and the other is ignored.
   */
  const settledRef = useRef(false);

  /* Fired when the clock runs out — from a timer, so it lands whether or not
     the user is looking at this tab. */
  const finishSession = () => {
    if (settledRef.current) return;
    settledRef.current = true;

    // The in-page card is the point of the app, so it shows either way.
    setFinished(true);

    if (alertsRef.current) {
      playCompletionChime();

      const current = linkedRef.current;
      const minutes = Math.max(1, Math.round(totalTimeRef.current / 60));

      // Desktop alert reaches the user when they've wandered off to another tab.
      notify(
        current ? `${current.name} — done` : "Focus session complete",
        current
          ? `${minutes} min logged. Habit ticked off.`
          : `${minutes} min of focus logged.`,
      );
    }

    // Finishing the session counts as doing the habit. Read the store directly:
    // the timer loop closes over values from an older render.
    const current = linkedRef.current;
    if (current) {
      const state = useStore.getState();
      const done = state.completions.some(
        (c) => c.taskId === current.id && c.date === current.date,
      );
      if (!done) state.toggleCompletion(current.id, current.date);
    }
  };

  /*
   * Background-tab backstop.
   *
   * Chrome throttles main-thread timers hard once a tab has been hidden for a
   * while — enough that a 25-minute session could report as finished up to a
   * minute late. Timers inside a dedicated worker escape that throttling, so
   * this is what guarantees the alert actually goes out on time.
   */
  const workerRef = useRef<Worker | null>(null);

  useEffect(() => {
    const source = `let id=null;onmessage=e=>{if(id)clearTimeout(id);
      if(e.data.type==='start'){id=setTimeout(()=>postMessage('elapsed'),e.data.ms)}
      else{id=null}};`;

    try {
      const url = URL.createObjectURL(new Blob([source], { type: "text/javascript" }));
      const worker = new Worker(url);
      URL.revokeObjectURL(url);
      // finishSession only reads refs and stable setters, so capturing the
      // first render's copy is safe.
      worker.onmessage = (event) => {
        if (event.data === "elapsed") finishSession();
      };
      workerRef.current = worker;
    } catch {
      // Workers unavailable or blocked — the interval alone still finishes.
      workerRef.current = null;
    }

    return () => {
      workerRef.current?.terminate();
      workerRef.current = null;
    };
  }, []);

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

  useEffect(() => {
    if (!isActive) {
      endTimeRef.current = null;
      workerRef.current?.postMessage({ type: "cancel" });
      return;
    }

    if (!endTimeRef.current) {
      endTimeRef.current = Date.now() + timeLeft * 1000;
      totalTimeRef.current = totalSeconds;
      settledRef.current = false;
      workerRef.current?.postMessage({ type: "start", ms: timeLeft * 1000 });
    }

    /*
     * setInterval, deliberately not requestAnimationFrame: frames are frozen
     * whenever the tab is backgrounded, so an rAF countdown would stop dead
     * and the finish alert would never fire until the user came back. Timers
     * keep running (throttled, but running) and the clock is derived from
     * wall-clock time anyway, so nothing drifts.
     */
    const id = window.setInterval(() => {
      if (!endTimeRef.current) return;

      const now = Date.now();
      const remainingMs = Math.max(0, endTimeRef.current - now);
      const remainingSec = Math.ceil(remainingMs / 1000);

      if (remainingSec !== timeLeft) setTimeLeft(remainingSec);
      setProgress(Math.min(1, Math.max(0, 1 - remainingMs / 1000 / totalTimeRef.current)));

      if (remainingMs <= 0) {
        window.clearInterval(id);
        endTimeRef.current = null;
        setIsActive(false);
        setProgress(1);
        finishSession();
      }
    }, 250);

    return () => window.clearInterval(id);
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
    workerRef.current?.postMessage({ type: "cancel" });
    settledRef.current = false;
    setFinished(false);
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
    <>
      <RainBackdrop active={isActive} />

      <div className="relative z-10 flex flex-col items-center justify-center w-full max-w-xl mx-auto py-8 px-4">
      <OverlaySignal active={finished} />
      
      {/* Top Header Badge */}
      <div className="mb-6 flex flex-wrap items-center justify-center gap-2">
        <div className="flex items-center gap-2 px-4 py-1.5 rounded-full bg-theme-surface border border-theme-border/70 shadow-sm">
          <div className={cn(
            "w-2.5 h-2.5 rounded-full transition-colors duration-300",
            isActive ? "bg-emerald-500" : "bg-theme-accent"
          )} />
          <span className="text-sm font-semibold tracking-wider uppercase text-theme-text">Focus</span>
        </div>

        {/*
          One toggle for every state, icon-only so it sits quietly next to the
          badge. The state lives in the accessible name and tooltip — a bell
          with a word beside it was the second loudest thing on this screen.
        */}
        {permission !== "unsupported" && (
          <button
            onClick={toggleAlerts}
            aria-pressed={alertsOn}
            aria-label={
              alertsOn
                ? permission === "denied"
                  ? "Alerts on, but blocked by your browser"
                  : "Alerts on. Turn off"
                : "Alerts off. Turn on"
            }
            title={
              alertsOn && permission === "denied"
                ? "Desktop alerts are blocked for this site. Allow notifications in your browser settings to get them; toggling this mutes the completion chime."
                : alertsOn
                  ? "Play a chime and send a desktop alert when a session finishes"
                  : "No chime, no desktop alert — the in-page card still appears"
            }
            className={cn(
              "flex h-8 w-8 shrink-0 items-center justify-center rounded-full border shadow-sm transition-colors duration-200",
              alertsOn
                ? "border-theme-accent/40 bg-theme-accent/12 text-theme-text"
                : "border-theme-border/70 bg-theme-surface text-theme-muted hover:text-theme-text",
            )}
          >
            {alertsOn ? <Bell className="h-3.5 w-3.5" /> : <BellOff className="h-3.5 w-3.5" />}
          </button>
        )}
      </div>

      {/* Clean Purpose / Goal Input without Boxy Outline */}
      <div className="w-full max-w-lg mb-8 flex flex-col items-center">
        <input
          type="text"
          value={purpose}
          onChange={(e) => setPurpose(e.target.value)}
          readOnly={isActive}
          placeholder="What are you focusing on?"
          className={cn(
            "w-full bg-transparent text-center font-display text-2xl md:text-3xl font-medium leading-tight text-theme-text placeholder:text-theme-muted/40 placeholder:text-xl md:placeholder:text-2xl focus:outline-none py-2 transition-all border-b border-transparent",
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

      {/* Completion card — the in-page half of the alert, for when you are here. */}
      <AnimatePresence>
        {finished && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[110] grid place-items-center bg-black/45 px-4 backdrop-blur-sm"
          >
            <motion.div
              initial={{ opacity: 0, y: 18, scale: 0.96 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 18, scale: 0.96 }}
              transition={{ type: "spring", stiffness: 260, damping: 26 }}
              className="w-full max-w-sm rounded-[2rem] border border-theme-border bg-theme-surface p-8 text-center shadow-[0_40px_80px_-30px_rgb(0_0_0/0.6)]"
            >
              <motion.span
                initial={{ scale: 0.4, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                transition={{ type: "spring", stiffness: 320, damping: 18, delay: 0.08 }}
                className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-theme-accent text-theme-bg"
              >
                <Check className="h-7 w-7" strokeWidth={3} />
              </motion.span>

              <h2 className="mt-5 font-display text-xl font-medium text-theme-text">
                Session complete
              </h2>
              <p className="mt-2 text-sm text-theme-muted">
                {Math.max(1, Math.round(totalTimeRef.current / 60))} minutes logged
              </p>

              {linked && (
                <p className="mt-3 rounded-full bg-theme-accent/12 px-3 py-1.5 text-xs text-theme-text">
                  Ticked off <span className="font-medium">{linked.name}</span>
                </p>
              )}

              <button
                onClick={() => {
                  setFinished(false);
                  resetTimer();
                }}
                className="mt-7 w-full rounded-full bg-theme-text py-3 text-sm font-medium text-theme-bg transition-transform duration-200 active:scale-[0.98]"
              >
                Done
              </button>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
      </div>
    </>
  );
}
