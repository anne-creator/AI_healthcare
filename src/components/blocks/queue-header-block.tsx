"use client";

import { UserPlus, RotateCcw, Brain } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ModeToggle } from "@/components/compound/mode-toggle";

interface QueueHeaderBlockProps {
  mode: "doctor" | "nurse";
  onModeChange: (mode: "doctor" | "nurse") => void;
  patientCount: number;
  feedbackCount: number;
  onRegisterPatient: () => void;
  onResetDemo: () => void;
  isResetting: boolean;
}

export function QueueHeaderBlock({
  mode,
  onModeChange,
  patientCount,
  feedbackCount,
  onRegisterPatient,
  onResetDemo,
  isResetting,
}: QueueHeaderBlockProps) {
  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">
            Clinical Reasoning Engine
          </h1>
          <p className="text-sm text-muted-foreground">
            {patientCount} patients in queue
          </p>
        </div>
        <ModeToggle mode={mode} onModeChange={onModeChange} />
      </div>

      <div className="flex items-center justify-between">
        <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
          <Brain className="h-3.5 w-3.5" aria-hidden="true" />
          <span>
            Model refined from{" "}
            <span className="font-semibold text-foreground tabular-nums">
              {feedbackCount}
            </span>{" "}
            doctor correction{feedbackCount !== 1 ? "s" : ""}
          </span>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={onRegisterPatient}
            aria-label="Register new patient"
          >
            <UserPlus className="mr-1.5 h-4 w-4" aria-hidden="true" />
            New Patient
          </Button>
          <Button
            variant="ghost"
            size="sm"
            onClick={onResetDemo}
            disabled={isResetting}
            aria-label="Reset demo to initial state"
          >
            <RotateCcw
              className={`mr-1.5 h-4 w-4 ${isResetting ? "animate-spin" : ""}`}
              aria-hidden="true"
            />
            {isResetting ? "Resetting..." : "Reset Demo"}
          </Button>
        </div>
      </div>
    </div>
  );
}
