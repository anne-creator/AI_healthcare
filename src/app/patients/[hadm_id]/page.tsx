"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, AlertTriangle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { StatusChip } from "@/components/custom/status-chip";
import { SeverityTag } from "@/components/custom/severity-tag";
import { ConfidenceBar } from "@/components/custom/confidence-bar";
import { QueuePositionBadge } from "@/components/custom/queue-position-badge";
import { TimeWaiting } from "@/components/custom/time-waiting";
import { ContradictionCount } from "@/components/custom/contradiction-count";
import { SectionSpacer } from "@/components/custom/section-spacer";
import { WhatIsWrongBlock } from "@/components/blocks/what-is-wrong-block";
import { WhatHasBeenTriedBlock } from "@/components/blocks/what-has-been-tried-block";
import { WatchRightNowBlock } from "@/components/blocks/watch-right-now-block";
import { ContradictionEngineBlock } from "@/components/blocks/contradiction-engine-block";
import { Skeleton } from "@/components/ui/skeleton";
import type {
  PatientStatusEnum,
  Severity,
  DiagnosisEntry,
  LabEntry,
  PrescriptionEntry,
  Contradiction,
} from "@/types";

function scoreToSeverity(score: number | null): Severity {
  if (score == null) return "low";
  if (score >= 80) return "critical";
  if (score >= 60) return "high";
  if (score >= 40) return "medium";
  return "low";
}

interface QueuePatientDetail {
  id: string;
  hadmId: number;
  subjectId: number;
  arrivedAt: string;
  status: PatientStatusEnum;
  queuePosition: number;
  severityScore: number | null;
  confidenceScore: number | null;
  contradictions: Contradiction[] | null;
  aiSummary: string | null;
  scoredAt: string | null;
  age: number;
  gender: string;
  admissionDiagnosis: string;
  dischargeSummary: string;
  diagnoses: DiagnosisEntry[];
  labs: LabEntry[];
  prescriptions: PrescriptionEntry[];
  notes: { id: string; role: string; content: string; createdAt: string }[];
}

export default function PatientDetailPage() {
  const params = useParams();
  const paramId = params.hadm_id as string;

  const [patient, setPatient] = useState<QueuePatientDetail | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const isUuid = paramId.includes("-");
    const url = isUuid
      ? `/api/queue/patient?id=${paramId}`
      : `/api/queue/patient?hadmId=${paramId}`;

    fetch(url)
      .then((res) => res.json())
      .then((data) => {
        setPatient(data);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, [paramId]);

  if (loading) {
    return (
      <main className="mx-auto max-w-5xl px-6 py-8">
        <Skeleton className="h-6 w-32 mb-6" />
        <Skeleton className="h-8 w-64 mb-2" />
        <Skeleton className="h-4 w-96 mb-8" />
        <div className="space-y-4">
          {Array.from({ length: 3 }).map((_, i) => (
            <Skeleton key={i} className="h-40 w-full rounded-lg" />
          ))}
        </div>
      </main>
    );
  }

  if (!patient || patient.id == null) {
    return (
      <main className="mx-auto max-w-5xl px-6 py-8">
        <Link href="/">
          <Button variant="ghost" size="sm">
            <ArrowLeft className="mr-1.5 h-4 w-4" aria-hidden="true" />
            Back to Queue
          </Button>
        </Link>
        <SectionSpacer size="sm" />
        <p className="text-muted-foreground">Patient not found.</p>
      </main>
    );
  }

  const severity = scoreToSeverity(patient.severityScore);
  const lowConfidence =
    patient.confidenceScore != null && patient.confidenceScore < 60;
  const contradictions = Array.isArray(patient.contradictions)
    ? (patient.contradictions as Contradiction[])
    : [];

  return (
    <main className="mx-auto max-w-5xl px-6 py-8">
      <Link href="/">
        <Button variant="ghost" size="sm">
          <ArrowLeft className="mr-1.5 h-4 w-4" aria-hidden="true" />
          Back to Queue
        </Button>
      </Link>

      <SectionSpacer size="sm" />

      {/* Header with queue context */}
      <div className="space-y-3">
        <div className="flex items-center gap-3 flex-wrap">
          <h1 className="text-2xl font-bold tracking-tight">
            Patient {patient.hadmId}
          </h1>
          <StatusChip status={patient.status} />
          <QueuePositionBadge position={patient.queuePosition} />
        </div>

        <p className="text-lg text-muted-foreground">
          {patient.admissionDiagnosis}
        </p>

        <div className="flex flex-wrap items-center gap-4 text-sm text-muted-foreground">
          <span>
            {patient.age}
            {patient.gender === "M" ? "M" : "F"}
          </span>
          <TimeWaiting arrivedAt={patient.arrivedAt} />
        </div>

        {/* Severity + Confidence row */}
        <div className="flex flex-wrap items-center gap-6">
          <div className="flex items-center gap-2">
            <SeverityTag severity={severity} />
            <span className="text-sm tabular-nums">
              {patient.severityScore ?? "—"}
            </span>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-xs text-muted-foreground">Confidence</span>
            <ConfidenceBar value={patient.confidenceScore ?? 0} />
            {lowConfidence && (
              <AlertTriangle
                className="h-4 w-4 text-warning-amber"
                aria-label="Low confidence — AI is uncertain"
              />
            )}
          </div>
        </div>
      </div>

      <SectionSpacer size="sm" />
      <Separator />
      <SectionSpacer size="sm" />

      {/* AI Reasoning — open by default, streaming */}
      <ContradictionEngineBlock hadmId={patient.hadmId} />

      <SectionSpacer size="sm" />

      {/* Contradiction flags */}
      {contradictions.length > 0 && (
        <>
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <ContradictionCount count={contradictions.length} />
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {contradictions.map((c, i) => (
                  <div
                    key={i}
                    className="rounded-md border p-3 space-y-1"
                  >
                    <div className="flex items-center gap-2">
                      <span
                        className={`text-xs font-semibold ${
                          c.severity === "CRITICAL"
                            ? "text-severity-critical"
                            : c.severity === "HIGH"
                              ? "text-severity-high"
                              : "text-severity-medium"
                        }`}
                      >
                        {c.severity}
                      </span>
                      <span className="text-sm font-medium">{c.title}</span>
                    </div>
                    <p className="text-xs text-muted-foreground">
                      {c.description}
                    </p>
                    <p className="text-xs font-medium">
                      Action: {c.action}
                    </p>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
          <SectionSpacer size="sm" />
        </>
      )}

      {/* Clinical data blocks */}
      <WhatIsWrongBlock
        admissionDiagnosis={patient.admissionDiagnosis}
        diagnoses={patient.diagnoses}
      />

      <SectionSpacer size="sm" />

      <WhatHasBeenTriedBlock prescriptions={patient.prescriptions} />

      <SectionSpacer size="sm" />

      <WatchRightNowBlock labs={patient.labs} />

      {/* Notes thread */}
      {patient.notes.length > 0 && (
        <>
          <SectionSpacer size="sm" />
          <Card>
            <CardHeader>
              <CardTitle>Notes</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {patient.notes.map((note) => (
                  <div key={note.id} className="rounded-md border p-3">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="text-xs font-semibold uppercase">
                        {note.role}
                      </span>
                      <span className="text-xs text-muted-foreground">
                        {new Date(note.createdAt).toLocaleTimeString()}
                      </span>
                    </div>
                    <p className="text-sm">{note.content}</p>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </>
      )}

      <SectionSpacer size="md" />
    </main>
  );
}
