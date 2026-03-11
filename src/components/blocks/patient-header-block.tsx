import { AlertBadge } from "@/components/custom/alert-badge";
import type { AlertLevel } from "@/types";

interface PatientHeaderBlockProps {
  caseId: string;
  hadmId: number;
  age: number;
  gender: string;
  admissionDiagnosis: string;
  alertLevel: AlertLevel;
}

export function PatientHeaderBlock({
  caseId,
  age,
  gender,
  admissionDiagnosis,
  alertLevel,
}: PatientHeaderBlockProps) {
  return (
    <div className="space-y-2">
      <div className="flex items-center gap-3">
        <h1 className="text-2xl font-bold tracking-tight">{caseId}</h1>
        <AlertBadge level={alertLevel} />
      </div>
      <p className="text-lg text-muted-foreground">{admissionDiagnosis}</p>
      <div className="flex gap-4 text-sm text-muted-foreground">
        <span>Age: {age}</span>
        <span>Gender: {gender}</span>
      </div>
    </div>
  );
}
