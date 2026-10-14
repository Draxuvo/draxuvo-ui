// src/components/work-orders/progress-bar.tsx
export function ProgressBar({ value }: { value: number }) {
  const color =
    value === 100 ? "bg-estado-completada-border" : value > 50 ? "bg-estado-progreso-border" : "bg-muted-foreground/30";
  return (
    <div className="w-full bg-muted rounded-full h-1.5">
      <div
        className={`h-1.5 rounded-full transition-all ${color}`}
        style={{ width: `${value}%` }}
      />
    </div>
  );
}
