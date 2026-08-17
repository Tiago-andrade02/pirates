import { StarIcon, StarOutlineIcon } from "./icons";

export function Stars({ value, className }: { value: number; className?: string }) {
  const filled = Math.round(value);
  return (
    <div className={`flex items-center gap-0.5 ${className ?? ""}`}>
      {Array.from({ length: 5 }).map((_, i) =>
        i < filled ? (
          <StarIcon key={i} className="h-3.5 w-3.5 text-white" />
        ) : (
          <StarOutlineIcon key={i} className="h-3.5 w-3.5 text-faint" />
        )
      )}
    </div>
  );
}

export function Meter({ value, label }: { value: number; label: string }) {
  return (
    <div className="flex items-center justify-between gap-4">
      <span className="w-28 shrink-0 text-sm text-muted">{label}</span>
      <div className="flex flex-1 gap-1">
        {Array.from({ length: 5 }).map((_, i) => (
          <span
            key={i}
            className={`h-1.5 flex-1 rounded-full ${
              i < value ? "bg-white" : "bg-surface-3"
            }`}
          />
        ))}
      </div>
    </div>
  );
}
