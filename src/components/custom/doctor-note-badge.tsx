import { MessageSquare } from "lucide-react";

interface DoctorNoteBadgeProps {
  note: string;
}

export function DoctorNoteBadge({ note }: DoctorNoteBadgeProps) {
  return (
    <div className="flex items-start gap-2 rounded-md border border-warning-amber/40 bg-warning-amber/5 px-3 py-2">
      <MessageSquare
        className="mt-0.5 h-3.5 w-3.5 shrink-0 text-warning-amber"
        aria-hidden="true"
      />
      <p className="text-xs text-foreground/80">
        <span className="font-medium">Dr. override:</span> {note}
      </p>
    </div>
  );
}
