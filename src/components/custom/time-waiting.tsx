import { Clock } from "lucide-react";

interface TimeWaitingProps {
  arrivedAt: string;
}

export function TimeWaiting({ arrivedAt }: TimeWaitingProps) {
  const arrived = new Date(arrivedAt);
  const hours = arrived.getHours();
  const minutes = arrived.getMinutes();
  const timeStr = `${String(hours).padStart(2, "0")}:${String(minutes).padStart(2, "0")}`;

  return (
    <span className="inline-flex items-center gap-1 text-xs text-muted-foreground">
      <Clock className="h-3 w-3" aria-hidden="true" />
      Arrived {timeStr}
    </span>
  );
}
