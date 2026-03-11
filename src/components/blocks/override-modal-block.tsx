"use client";

import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";

interface OverrideModalBlockProps {
  open: boolean;
  patientLabel: string;
  originalPosition: number;
  newPosition: number;
  onConfirm: (note: string) => void;
  onCancel: () => void;
}

export function OverrideModalBlock({
  open,
  patientLabel,
  originalPosition,
  newPosition,
  onConfirm,
  onCancel,
}: OverrideModalBlockProps) {
  const [note, setNote] = useState("");

  function handleConfirm() {
    onConfirm(note);
    setNote("");
  }

  function handleCancel() {
    onCancel();
    setNote("");
  }

  return (
    <Dialog open={open} onOpenChange={(o) => !o && handleCancel()}>
      <DialogContent showCloseButton={false}>
        <DialogHeader>
          <DialogTitle>Override queue position</DialogTitle>
          <DialogDescription>
            Moving <span className="font-medium">{patientLabel}</span> from
            position #{originalPosition} to{" "}
            <span className="font-semibold">#{newPosition}</span>
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-2">
          <label
            htmlFor="override-note"
            className="text-sm font-medium text-foreground"
          >
            Reason (optional)
          </label>
          <Textarea
            id="override-note"
            placeholder="e.g. INR 6.9 — bleeding risk, bring in immediately"
            value={note}
            onChange={(e) => setNote(e.target.value)}
            rows={2}
          />
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={handleCancel}>
            Cancel
          </Button>
          <Button onClick={handleConfirm}>Confirm Move</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
