"use client";

import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import {
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { QueueCardBlock } from "@/components/blocks/queue-card-block";
import type { QueuePatientResponse } from "@/types";

interface QueueListBlockProps {
  patients: QueuePatientResponse[];
  mode: "doctor" | "nurse";
  doctorNotes: Record<string, string>;
  onReorder: (patientId: string, oldIndex: number, newIndex: number) => void;
  onStatusChange: (patientId: string) => void;
  onViewPatient: (id: string) => void;
}

function SortableCard({
  patient,
  mode,
  doctorNote,
  onViewPatient,
  onStatusChange,
  isDragDisabled,
}: {
  patient: QueuePatientResponse;
  mode: "doctor" | "nurse";
  doctorNote?: string | null;
  onViewPatient: (id: string) => void;
  onStatusChange: (patientId: string) => void;
  isDragDisabled: boolean;
}) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({
    id: patient.id,
    disabled: isDragDisabled,
  });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
    zIndex: isDragging ? 10 : undefined,
  };

  return (
    <div ref={setNodeRef} style={style} {...attributes}>
      <QueueCardBlock
        patient={patient}
        mode={mode}
        dragHandleProps={isDragDisabled ? undefined : listeners}
        onViewPatient={onViewPatient}
        onStatusChange={onStatusChange}
        doctorNote={doctorNote}
      />
    </div>
  );
}

export function QueueListBlock({
  patients,
  mode,
  doctorNotes,
  onReorder,
  onStatusChange,
  onViewPatient,
}: QueueListBlockProps) {
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  const isDragDisabled = mode === "nurse";

  function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event;
    if (!over || active.id === over.id) return;

    const oldIndex = patients.findIndex((p) => p.id === active.id);
    const newIndex = patients.findIndex((p) => p.id === over.id);
    if (oldIndex === -1 || newIndex === -1) return;

    onReorder(active.id as string, oldIndex, newIndex);
  }

  const ids = patients.map((p) => p.id);

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={closestCenter}
      onDragEnd={handleDragEnd}
    >
      <SortableContext items={ids} strategy={verticalListSortingStrategy}>
        <div className="flex flex-col gap-(--queue-card-gap)">
          {patients.map((patient) => (
            <SortableCard
              key={patient.id}
              patient={patient}
              mode={mode}
              doctorNote={doctorNotes[patient.id] ?? null}
              onViewPatient={onViewPatient}
              onStatusChange={onStatusChange}
              isDragDisabled={isDragDisabled}
            />
          ))}
        </div>
      </SortableContext>
    </DndContext>
  );
}
