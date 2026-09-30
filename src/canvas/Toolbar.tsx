import { motion } from "framer-motion";
import { Copy, Hand, MousePointer2, Plus, Redo2, Square, Trash2, Type, Undo2, WandSparkles } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { cn } from "../lib/utils";
import { useCanvas } from "./store";

/** Same spring as the Layout bottom dock pill. */
const PILL_TRANSITION = { type: "spring", damping: 32, stiffness: 420, mass: 0.9 } as const;

/** Layout-style hover tooltip (pops above the control). */
function Tooltip({ label }: { label: string }) {
  return (
    <div className="absolute top-full left-1/2 -translate-x-1/2 mt-3 pointer-events-none opacity-0 -translate-y-2 group-hover:opacity-100 group-hover:translate-y-0 transition-all duration-300 z-50 whitespace-nowrap rounded-full bg-theme-text text-theme-bg text-[11px] font-semibold px-2.5 py-1 shadow-xl">
      {label}
    </div>
  );
}

type ToolButtonProps = {
  icon: LucideIcon;
  /** Used for aria-label, title and the hover tooltip. */
  label: string;
  active?: boolean;
  disabled?: boolean;
  onClick: () => void;
};

/**
 * 36×36 pill button. The `relative group` wrapper lives OUTSIDE the sliding
 * layoutId pill so the shared-layout animation is unaffected by the tooltip.
 */
function ToolButton({ icon: Icon, label, active = false, disabled = false, onClick }: ToolButtonProps) {
  return (
    <div className="relative group">
      <button
        type="button"
        aria-label={label}
        title={label}
        disabled={disabled}
        onPointerDown={(e) => {
          e.preventDefault();
          e.stopPropagation();
        }}
        onClick={(e) => {
          e.stopPropagation();
          onClick();
        }}
        className={cn(
          "relative w-9 h-9 rounded-full flex items-center justify-center transition-colors",
          active
            ? "text-theme-bg"
            : "text-theme-muted hover:bg-theme-text/5 hover:text-theme-text",
          disabled && "opacity-40 pointer-events-none"
        )}
      >
        {active && (
          <motion.span
            layoutId="canvas-tool-pill"
            transition={PILL_TRANSITION}
            className="absolute inset-0 rounded-full bg-theme-accent"
          />
        )}
        <Icon className="relative z-10 w-[18px] h-[18px]" />
      </button>
      <Tooltip label={label} />
    </div>
  );
}

export function Toolbar(): JSX.Element {
  // Primitive subscriptions only — re-renders are cheap and targeted.
  const tool = useCanvas((s) => s.tool);
  const canUndo = useCanvas((s) => s.canUndo);
  const canRedo = useCanvas((s) => s.canRedo);
  const selectionCount = useCanvas((s) => s.selection.length);
  const selectedEdgeId = useCanvas((s) => s.selectedEdgeId);
  // Boolean selector — flips only when layoutability changes, not on every drag.
  const canAutoLayout = useCanvas((s) => {
    const sel = s.selection.filter((id) => s.boxes[id]);
    if (sel.length < 2) return false;
    const set = new Set(sel);
    return Object.values(s.edges).some(
      (e) => set.has(e.from) && set.has(e.to) && e.from !== e.to
    );
  });

  // Actions (stable references).
  const setTool = useCanvas((s) => s.setTool);
  const addBox = useCanvas((s) => s.addBox);
  const setEditing = useCanvas((s) => s.setEditing);
  const addText = useCanvas((s) => s.addText);
  const setTextEditing = useCanvas((s) => s.setTextEditing);
  const undo = useCanvas((s) => s.undo);
  const redo = useCanvas((s) => s.redo);
  const duplicateSelection = useCanvas((s) => s.duplicateSelection);
  const deleteSelection = useCanvas((s) => s.deleteSelection);
  const autoLayoutSelected = useCanvas((s) => s.autoLayoutSelected);

  const handleAddBox = () => {
    const id = addBox();
    setEditing(id);
  };

  const handleAddText = () => {
    const id = addText();
    setTextEditing(id);
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: -12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ type: "spring", damping: 28, stiffness: 340 }}
      className="absolute top-4 left-1/2 -translate-x-1/2 z-30 select-none flex items-center gap-1 p-1.5 rounded-full border border-theme-border bg-theme-surface/80 backdrop-blur-xl shadow-lg shadow-black/5"
    >
      <ToolButton
        icon={MousePointer2}
        label="Select (V)"
        active={tool === "select"}
        onClick={() => setTool("select")}
      />
      <ToolButton
        icon={Square}
        label="Add box — click the canvas (B)"
        active={tool === "box"}
        onClick={() => setTool("box")}
      />
      <ToolButton
        icon={Hand}
        label="Pan (H)"
        active={tool === "pan"}
        onClick={() => setTool("pan")}
      />

      <div className="w-px h-6 bg-theme-border mx-1" aria-hidden="true" />

      <ToolButton icon={Plus} label="New box" onClick={handleAddBox} />
      <ToolButton icon={Type} label="Add text (T)" onClick={handleAddText} />
      <ToolButton icon={Undo2} label="Undo (Ctrl+Z)" disabled={!canUndo} onClick={undo} />
      <ToolButton icon={Redo2} label="Redo (Ctrl+Shift+Z)" disabled={!canRedo} onClick={redo} />

      <div className="w-px h-6 bg-theme-border mx-1" aria-hidden="true" />

      <ToolButton
        icon={WandSparkles}
        label="Auto-layout selected (arrange by connections)"
        disabled={!canAutoLayout}
        onClick={autoLayoutSelected}
      />
      <ToolButton
        icon={Copy}
        label="Duplicate (Ctrl+D)"
        disabled={selectionCount === 0}
        onClick={duplicateSelection}
      />
      <ToolButton
        icon={Trash2}
        label="Delete (Del)"
        disabled={selectionCount === 0 && !selectedEdgeId}
        onClick={deleteSelection}
      />
    </motion.div>
  );
}
