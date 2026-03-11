import { Badge } from "@/components/ui/badge";
import type { Severity } from "@/types";

const config: Record<Severity, { label: string; className: string }> = {
  critical: {
    label: "Critical",
    className: "border-severity-critical text-severity-critical",
  },
  high: {
    label: "High",
    className: "border-severity-high text-severity-high",
  },
  medium: {
    label: "Medium",
    className: "border-severity-medium text-severity-medium",
  },
  low: {
    label: "Low",
    className: "border-severity-low text-severity-low",
  },
};

interface SeverityTagProps {
  severity: Severity;
}

export function SeverityTag({ severity }: SeverityTagProps) {
  const { label, className } = config[severity];
  return (
    <Badge variant="outline" className={className}>
      {label}
    </Badge>
  );
}
