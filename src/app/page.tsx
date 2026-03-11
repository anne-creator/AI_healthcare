"use client";

import { useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { arrayMove } from "@dnd-kit/sortable";
import { QueueHeaderBlock } from "@/components/blocks/queue-header-block";
import { QueueListBlock } from "@/components/blocks/queue-list-block";
import { OverrideModalBlock } from "@/components/blocks/override-modal-block";
import { PatientRegistrationBlock } from "@/components/blocks/patient-registration-block";
import { SectionSpacer } from "@/components/custom/section-spacer";
import { Skeleton } from "@/components/ui/skeleton";
import { useQueueStream } from "@/hooks/use-queue-stream";
import type { QueuePatientResponse, PatientStatusEnum } from "@/types";

const STATUS_ORDER: PatientStatusEnum[] = [
  "WAITING",
  "TRIAGED",
  "WITH_DOCTOR",
  "DONE",
];

export default function QueuePage() {
  const router = useRouter();

  const [mode, setMode] = useState<"doctor" | "nurse">("doctor");
  const [patients, setPatients] = useState<QueuePatientResponse[]>([]);
  const [feedbackCount, setFeedbackCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [doctorNotes, setDoctorNotes] = useState<Record<string, string>>({});

  // Override modal state
  const [overrideState, setOverrideState] = useState<{
    patientId: string;
    patientLabel: string;
    originalPosition: number;
    newPosition: number;
    reorderedPatients: QueuePatientResponse[];
  } | null>(null);

  // Registration dialog state
  const [registrationOpen, setRegistrationOpen] = useState(false);
  const [isRegistering, setIsRegistering] = useState(false);

  // Reset state
  const [isResetting, setIsResetting] = useState(false);

  // Initial data fetch
  useEffect(() => {
    async function load() {
      const [queueRes, feedbackRes] = await Promise.all([
        fetch("/api/queue"),
        fetch("/api/queue/feedback"),
      ]);

      const queueData = await queueRes.json();
      setPatients(queueData.patients);

      if (feedbackRes.ok) {
        const fbData = await feedbackRes.json();
        setFeedbackCount(fbData.count ?? 0);
      }

      setLoading(false);
    }
    load();
  }, []);

  // SSE real-time updates
  useQueueStream(
    useCallback((updatedPatients: QueuePatientResponse[]) => {
      setPatients(updatedPatients);
    }, [])
  );

  // --- Action handlers (all at L5) ---

  const handleReorder = useCallback(
    (patientId: string, oldIndex: number, newIndex: number) => {
      if (mode !== "doctor") return;

      const patient = patients[oldIndex];
      const optimistic = arrayMove(patients, oldIndex, newIndex);

      setOverrideState({
        patientId,
        patientLabel: `Patient ${patient.hadmId} (${patient.age}${patient.gender === "M" ? "M" : "F"})`,
        originalPosition: patient.queuePosition,
        newPosition: newIndex + 1,
        reorderedPatients: optimistic,
      });
    },
    [mode, patients]
  );

  const handleOverrideConfirm = useCallback(
    async (note: string) => {
      if (!overrideState) return;

      const { patientId, originalPosition, newPosition, reorderedPatients } =
        overrideState;

      // Optimistic update
      setPatients(
        reorderedPatients.map((p, i) => ({ ...p, queuePosition: i + 1 }))
      );
      setOverrideState(null);

      const res = await fetch("/api/queue/feedback", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          patientId,
          originalRank: originalPosition,
          adjustedRank: newPosition,
          note: note || undefined,
          adjustedBy: "DOCTOR",
        }),
      });

      if (res.ok) {
        const data = await res.json();
        setPatients(data.patients);
        setFeedbackCount((c) => c + 1);

        if (note) {
          setDoctorNotes((prev) => ({ ...prev, [patientId]: note }));
        }
      }
    },
    [overrideState]
  );

  const handleOverrideCancel = useCallback(() => {
    setOverrideState(null);
  }, []);

  const handleStatusChange = useCallback(async (patientId: string) => {
    const patient = patients.find((p) => p.id === patientId);
    if (!patient) return;

    const currentIdx = STATUS_ORDER.indexOf(patient.status);
    const nextStatus = STATUS_ORDER[currentIdx + 1];
    if (!nextStatus) return;

    // Optimistic
    setPatients((prev) =>
      prev.map((p) =>
        p.id === patientId ? { ...p, status: nextStatus } : p
      )
    );

    const res = await fetch("/api/queue/status", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ patientId, newStatus: nextStatus }),
    });

    if (!res.ok) {
      // Revert on failure — SSE will correct
      const queueRes = await fetch("/api/queue");
      const data = await queueRes.json();
      setPatients(data.patients);
    }
  }, [patients]);

  const handleViewPatient = useCallback(
    (id: string) => {
      router.push(`/patients/${id}`);
    },
    [router]
  );

  const handleRegisterPatient = useCallback(
    async (chiefComplaint: string) => {
      setIsRegistering(true);
      try {
        const res = await fetch("/api/demo/register", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ chiefComplaint }),
        });

        if (res.ok) {
          setRegistrationOpen(false);
          // SSE will push the updated queue
        }
      } finally {
        setIsRegistering(false);
      }
    },
    []
  );

  const handleResetDemo = useCallback(async () => {
    setIsResetting(true);
    try {
      await fetch("/api/demo/reset", { method: "POST" });
      setDoctorNotes({});
      setFeedbackCount(0);
      // SSE will push the reset queue
    } finally {
      setIsResetting(false);
    }
  }, []);

  if (loading) {
    return (
      <main className="mx-auto max-w-4xl px-6 py-8">
        <Skeleton className="h-8 w-64 mb-4" />
        <Skeleton className="h-4 w-40 mb-8" />
        <div className="space-y-3">
          {Array.from({ length: 5 }).map((_, i) => (
            <Skeleton key={i} className="h-48 w-full rounded-lg" />
          ))}
        </div>
      </main>
    );
  }

  return (
    <main className="mx-auto max-w-4xl px-6 py-8">
      <QueueHeaderBlock
        mode={mode}
        onModeChange={setMode}
        patientCount={patients.length}
        feedbackCount={feedbackCount}
        onRegisterPatient={() => setRegistrationOpen(true)}
        onResetDemo={handleResetDemo}
        isResetting={isResetting}
      />

      <SectionSpacer size="sm" />

      <QueueListBlock
        patients={patients}
        mode={mode}
        doctorNotes={doctorNotes}
        onReorder={handleReorder}
        onStatusChange={handleStatusChange}
        onViewPatient={handleViewPatient}
      />

      <OverrideModalBlock
        open={overrideState !== null}
        patientLabel={overrideState?.patientLabel ?? ""}
        originalPosition={overrideState?.originalPosition ?? 0}
        newPosition={overrideState?.newPosition ?? 0}
        onConfirm={handleOverrideConfirm}
        onCancel={handleOverrideCancel}
      />

      <PatientRegistrationBlock
        open={registrationOpen}
        onRegister={handleRegisterPatient}
        onCancel={() => setRegistrationOpen(false)}
        isRegistering={isRegistering}
      />
    </main>
  );
}
