// src/components/work-orders/progress-bar.tsx
interface ProgressBarProps {
  /** Porcentaje 0-100. Se ignora si vienen `steps_done` y `steps_count`. */
  value?: number;
  steps_done?: number;
  steps_count?: number;
}

export function ProgressBar({ value = 0, steps_done, steps_count }: ProgressBarProps) {
  const percent =
    steps_count !== undefined && steps_count > 0
      ? Math.round(((steps_done ?? 0) / steps_count) * 100)
      : steps_count === 0
        ? 0
        : value;
  const color =
    percent === 100 ? "bg-estado-completada-border" : percent > 50 ? "bg-estado-progreso-border" : "bg-muted-foreground/30";
  return (
    <div
      className="w-full bg-muted rounded-full h-1.5"
      role="progressbar"
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={percent}
    >
      <div
        className={`h-1.5 rounded-full transition-all ${color}`}
        style={{ width: `${percent}%` }}
      />
    </div>
  );
}
