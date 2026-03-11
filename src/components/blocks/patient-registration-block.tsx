"use client";

import { useState } from "react";
import { Loader2 } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";

interface PatientRegistrationBlockProps {
  open: boolean;
  onRegister: (chiefComplaint: string) => void;
  onCancel: () => void;
  isRegistering: boolean;
}

export function PatientRegistrationBlock({
  open,
  onRegister,
  onCancel,
  isRegistering,
}: PatientRegistrationBlockProps) {
  const [chiefComplaint, setChiefComplaint] = useState(
    "Chest tightness, shortness of breath"
  );

  function handleRegister() {
    onRegister(chiefComplaint);
  }

  function handleCancel() {
    onCancel();
    setChiefComplaint("Chest tightness, shortness of breath");
  }

  return (
    <Dialog open={open} onOpenChange={(o) => !o && handleCancel()}>
      <DialogContent showCloseButton={false}>
        <DialogHeader>
          <DialogTitle>Register new patient</DialogTitle>
          <DialogDescription>
            A new patient walks into the ER. The system will create a record and
            trigger live AI scoring.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3">
          <div className="rounded-md border bg-muted/30 p-3 text-sm space-y-1">
            <p className="font-medium">New walk-in patient</p>
            <p className="text-xs text-muted-foreground">
              Will be matched to a MIMIC clinical record for demo purposes
            </p>
          </div>

          <div className="space-y-2">
            <label
              htmlFor="chief-complaint"
              className="text-sm font-medium text-foreground"
            >
              Chief complaint
            </label>
            <Textarea
              id="chief-complaint"
              value={chiefComplaint}
              onChange={(e) => setChiefComplaint(e.target.value)}
              rows={2}
            />
          </div>
        </div>

        <DialogFooter>
          <Button
            variant="outline"
            onClick={handleCancel}
            disabled={isRegistering}
          >
            Cancel
          </Button>
          <Button onClick={handleRegister} disabled={isRegistering}>
            {isRegistering && (
              <Loader2
                className="mr-1.5 h-4 w-4 animate-spin"
                aria-hidden="true"
              />
            )}
            {isRegistering ? "Scoring..." : "Register & Score"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
