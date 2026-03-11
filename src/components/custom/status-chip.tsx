import { Badge } from "@/components/ui/badge";
import type { PatientStatusEnum } from "@/types";

const config: Record<
  PatientStatusEnum,
  { label: string; className: string }
> = {
  WAITING: {
    label: "Waiting",
    className: "border-status-waiting text-status-waiting bg-transparent",
  },
  TRIAGED: {
    label: "Triaged",
    className:
      "border-status-triaged bg-status-triaged/10 text-status-triaged",
  },
  WITH_DOCTOR: {
    label: "With Doctor",
    className:
      "border-status-with-doctor bg-status-with-doctor text-primary-foreground",
  },
  DONE: {
    label: "Done",
    className: "border-status-done bg-status-done/10 text-status-done",
  },
};

interface StatusChipProps {
  status: PatientStatusEnum;
  onClick?: () => void;
}

export function StatusChip({ status, onClick }: StatusChipProps) {
  const { label, className } = config[status];

  if (onClick) {
    return (
      <button
        type="button"
        onClick={onClick}
        className="focus-visible:ring-2 focus-visible:ring-ring rounded-md"
        aria-label={`Advance status from ${label}`}
      >
        <Badge variant="outline" className={className}>
          {label}
        </Badge>
      </button>
    );
  }

  return (
    <Badge variant="outline" className={className}>
      {label}
    </Badge>
  );
}
