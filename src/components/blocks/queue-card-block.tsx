"use client";

import { GripVertical, AlertTriangle } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { SeverityTag } from "@/components/custom/severity-tag";
import { ConfidenceBar } from "@/components/custom/confidence-bar";
import { StatusChip } from "@/components/custom/status-chip";
import { QueuePositionBadge } from "@/components/custom/queue-position-badge";
import { TimeWaiting } from "@/components/custom/time-waiting";
import { ContradictionCount } from "@/components/custom/contradiction-count";
import { DoctorNoteBadge } from "@/components/custom/doctor-note-badge";
import { Progress } from "@/components/ui/progress";
import type { QueuePatientResponse, Severity } from "@/types";

function scoreToSeverity(score: number | null): Severity {
  if (score == null) return "low";
  if (score >= 80) return "critical";
  if (score >= 60) return "high";
  if (score >= 40) return "medium";
  return "low";
}

interface QueueCardBlockProps {
  patient: QueuePatientResponse;
  mode: "doctor" | "nurse";
  dragHandleProps?: Record<string, unknown>;
  onViewPatient: (id: string) => void;
  onStatusChange?: (patientId: string) => void;
  doctorNote?: string | null;
}

export function QueueCardBlock({
  patient,
  mode,
  dragHandleProps,
  onViewPatient,
  onStatusChange,
  doctorNote,
}: QueueCardBlockProps) {
  const severity = scoreToSeverity(patient.severityScore);
  const lowConfidence =
    patient.confidenceScore != null && patient.confidenceScore < 60;
  const contradictionCount = Array.isArray(patient.contradictions)
    ? patient.contradictions.length
    : 0;

  return (
    <Card
      className={`relative transition-shadow duration-150 ${
        lowConfidence ? "border-l-4 border-l-warning-amber" : ""
      }`}
    >
      <div className="p-4 space-y-3">
        {/* Row 1: Status + Position + Drag handle */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            {mode === "nurse" && onStatusChange && patient.status !== "DONE" ? (
              <StatusChip
                status={patient.status}
                onClick={() => onStatusChange(patient.id)}
              />
            ) : (
              <StatusChip status={patient.status} />
            )}
            <QueuePositionBadge position={patient.queuePosition} />
          </div>
          {mode === "doctor" && dragHandleProps && (
            <button
              type="button"
              className="cursor-grab touch-none rounded p-1 text-muted-foreground hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring"
              aria-label="Drag to reorder"
              {...dragHandleProps}
            >
              <GripVertical className="h-4 w-4" aria-hidden="true" />
            </button>
          )}
        </div>

        {/* Row 2: Patient identity + arrival time */}
        <div className="flex items-baseline justify-between">
          <div className="flex items-baseline gap-2">
            <span className="text-sm font-semibold">
              Patient {patient.hadmId}
            </span>
            <span className="text-xs text-muted-foreground">
              {patient.age}
              {patient.gender === "M" ? "M" : "F"}
            </span>
          </div>
          <TimeWaiting arrivedAt={patient.arrivedAt} />
        </div>

        {/* Row 3: Chief complaint */}
        <p className="text-sm text-foreground/80 line-clamp-1">
          {patient.admissionDiagnosis}
        </p>

        {/* Row 4: AI summary */}
        {patient.aiSummary && (
          <p className="text-xs text-muted-foreground line-clamp-2">
            {patient.aiSummary}
          </p>
        )}

        {/* Row 5: Severity + Confidence bars */}
        <div className="flex items-center gap-6">
          <div className="flex items-center gap-2">
            <span className="text-xs text-muted-foreground w-16">Severity</span>
            <Progress
              value={patient.severityScore ?? 0}
              className="h-2 w-24"
            />
            <SeverityTag severity={severity} />
          </div>
          <div className="flex items-center gap-2">
            <span className="text-xs text-muted-foreground w-20">
              Confidence
            </span>
            <ConfidenceBar value={patient.confidenceScore ?? 0} />
            {lowConfidence && (
              <AlertTriangle
                className="h-3.5 w-3.5 text-warning-amber"
                aria-label="Low confidence — AI is uncertain"
              />
            )}
          </div>
        </div>

        {/* Row 6: Contradiction count */}
        <ContradictionCount count={contradictionCount} />

        {/* Doctor note notification (nurse mode) */}
        {mode === "nurse" && doctorNote && (
          <DoctorNoteBadge note={doctorNote} />
        )}

        {/* Row 7: Actions */}
        <div className="flex items-center justify-end gap-2 pt-1">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => onViewPatient(patient.id)}
          >
            View Full Profile
          </Button>
        </div>
      </div>
    </Card>
  );
}
