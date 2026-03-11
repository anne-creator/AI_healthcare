"use client";

import { Stethoscope, HeartPulse } from "lucide-react";

type Mode = "doctor" | "nurse";

interface ModeToggleProps {
  mode: Mode;
  onModeChange: (mode: Mode) => void;
}

export function ModeToggle({ mode, onModeChange }: ModeToggleProps) {
  return (
    <div className="inline-flex items-center rounded-lg border bg-muted p-0.5">
      <button
        type="button"
        onClick={() => onModeChange("doctor")}
        className={`inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 text-sm font-medium transition-colors duration-150 focus-visible:ring-2 focus-visible:ring-ring ${
          mode === "doctor"
            ? "bg-background text-foreground shadow-sm"
            : "text-muted-foreground hover:text-foreground"
        }`}
        aria-label="Switch to Doctor mode"
        aria-pressed={mode === "doctor"}
      >
        <Stethoscope className="h-4 w-4" aria-hidden="true" />
        Doctor
      </button>
      <button
        type="button"
        onClick={() => onModeChange("nurse")}
        className={`inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 text-sm font-medium transition-colors duration-150 focus-visible:ring-2 focus-visible:ring-ring ${
          mode === "nurse"
            ? "bg-background text-foreground shadow-sm"
            : "text-muted-foreground hover:text-foreground"
        }`}
        aria-label="Switch to Nurse mode"
        aria-pressed={mode === "nurse"}
      >
        <HeartPulse className="h-4 w-4" aria-hidden="true" />
        Nurse
      </button>
    </div>
  );
}
