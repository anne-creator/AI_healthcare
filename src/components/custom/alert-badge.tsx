import { Badge } from "@/components/ui/badge";
import type { AlertLevel } from "@/types";

const config: Record<AlertLevel, { label: string; className: string }> = {
  red: {
    label: "ALERT",
    className: "bg-alert-red text-white border-alert-red",
  },
  yellow: {
    label: "WATCH",
    className: "bg-alert-yellow text-black border-alert-yellow",
  },
  green: {
    label: "STABLE",
    className: "bg-alert-green text-white border-alert-green",
  },
};

interface AlertBadgeProps {
  level: AlertLevel;
}

export function AlertBadge({ level }: AlertBadgeProps) {
  const { label, className } = config[level];
  return (
    <Badge variant="default" className={className}>
      <span className="mr-1">●</span>
      {label}
    </Badge>
  );
}
