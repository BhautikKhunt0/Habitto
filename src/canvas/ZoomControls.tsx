import { motion } from "framer-motion";
import { Maximize, Minus, Plus } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { useCanvas } from "./store";

/** Layout-style hover tooltip (pops above the control). */
function Tooltip({ label }: { label: string }) {
  return (
    <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-3 pointer-events-none opacity-0 translate-y-2 group-hover:opacity-100 group-hover:translate-y-0 transition-all duration-300 z-50 whitespace-nowrap rounded-full bg-theme-text text-theme-bg text-[11px] font-semibold px-2.5 py-1 shadow-xl">
      {label}
    </div>
  );
}

type ZoomButtonProps = {
  icon: LucideIcon;
  /** Used for aria-label, title and the hover tooltip. */
  label: string;
  onClick: () => void;
};

function ZoomButton({ icon: Icon, label, onClick }: ZoomButtonProps) {
  return (
    <div className="relative group">
      <button
        type="button"
        aria-label={label}
        title={label}
        onPointerDown={(e) => {
          e.preventDefault();
          e.stopPropagation();
        }}
        onClick={(e) => {
          e.stopPropagation();
          onClick();
        }}
        className="w-8 h-8 rounded-full flex items-center justify-center text-theme-muted transition-colors hover:bg-theme-text/5 hover:text-theme-text"
      >
        <Icon className="w-4 h-4" />
      </button>
      <Tooltip label={label} />
    </div>
  );
}

export function ZoomControls(): JSX.Element {
  const zoom = useCanvas((s) => s.viewport.zoom);
  const zoomBy = useCanvas((s) => s.zoomBy);
  const fitView = useCanvas((s) => s.fitView);

  /** Re-center on the current stage centre, then clamp zoom back to 1. */
  const resetZoom = () => {
    const { viewport, stageSize, zoomAt } = useCanvas.getState();
    const wx = (stageSize.w / 2 - viewport.x) / viewport.zoom;
    const wy = (stageSize.h / 2 - viewport.y) / viewport.zoom;
    zoomAt(wx, wy, 1);
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ type: "spring", damping: 28, stiffness: 340 }}
      className="absolute bottom-4 right-4 z-30 select-none flex items-center gap-0.5 p-1.5 rounded-full border border-theme-border bg-theme-surface/80 backdrop-blur-xl shadow-lg shadow-black/5"
    >
      <ZoomButton icon={Minus} label="Zoom out" onClick={() => zoomBy(1 / 1.15)} />

      <div className="relative group">
        <button
          type="button"
          aria-label="Reset zoom to 100%"
          title="Reset to 100%"
          onPointerDown={(e) => {
            e.preventDefault();
            e.stopPropagation();
          }}
          onClick={(e) => {
            e.stopPropagation();
            resetZoom();
          }}
          className="min-w-[52px] h-8 flex items-center justify-center text-center text-xs font-semibold text-theme-muted tabular-nums hover:text-theme-text rounded-full transition-colors"
        >
          {`${Math.round(zoom * 100)}%`}
        </button>
        <Tooltip label="Reset to 100%" />
      </div>

      <ZoomButton icon={Plus} label="Zoom in" onClick={() => zoomBy(1.15)} />

      <div className="w-px h-5 bg-theme-border mx-0.5" aria-hidden="true" />

      <ZoomButton icon={Maximize} label="Fit to content (Shift+1)" onClick={fitView} />
    </motion.div>
  );
}
