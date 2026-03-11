export type AlertLevel = "red" | "yellow" | "green";

export type Severity = "critical" | "high" | "medium" | "low";

export interface PatientSummary {
  caseId: string;
  hadmId: number;
  age: number;
  gender: string;
  admissionDiagnosis: string;
  alertLevel: AlertLevel;
}

export interface PatientDetail {
  caseId: string;
  hadmId: number;
  subjectId: number;
  age: number;
  gender: string;
  admissionDiagnosis: string;
  dischargeSummary: string;
  diagnoses: DiagnosisEntry[];
  labs: LabEntry[];
  prescriptions: PrescriptionEntry[];
}

export interface DiagnosisEntry {
  seqNum: number | null;
  icd9Code: string;
  shortTitle: string;
  longTitle: string;
}

export interface LabEntry {
  labName: string;
  fluid: string;
  category: string;
  charttime: string;
  value: number | null;
  unit: string | null;
}

export interface PrescriptionEntry {
  drug: string;
  doseValue: number | null;
  doseUnit: string | null;
  route: string | null;
  startdate: string | null;
  enddate: string | null;
}

export interface Contradiction {
  severity: "CRITICAL" | "HIGH" | "MODERATE";
  title: string;
  description: string;
  drug: string;
  labOrDiagnosis: string;
  action: string;
}

export interface ScoringResult {
  severityScore: number;
  confidenceScore: number;
  contradictions: Contradiction[];
  summary: string;
  recommendedActions: string[];
}

export interface PatientContext {
  hadmId: number;
  subjectId: number;
  age: number;
  gender: string;
  admissionDiagnosis: string;
  labs: LabEntry[];
  prescriptions: PrescriptionEntry[];
  diagnoses: DiagnosisEntry[];
  priorAdmissions: {
    hadmId: number;
    admissionDiagnosis: string;
    age: number;
  }[];
}

export interface AIReasoningResult {
  whatIsWrong: {
    text: string;
    confidence: number;
  };
  contradictions: Contradiction[];
}

// ---------------------------------------------------------------------------
// Queue system types
// ---------------------------------------------------------------------------

export type PatientStatusEnum = "WAITING" | "TRIAGED" | "WITH_DOCTOR" | "DONE";

export type StaffRoleEnum = "NURSE" | "DOCTOR";

export interface QueuePatientResponse {
  id: string;
  hadmId: number;
  subjectId: number;
  arrivedAt: string;
  status: PatientStatusEnum;
  queuePosition: number;
  severityScore: number | null;
  confidenceScore: number | null;
  contradictions: unknown[] | null;
  aiSummary: string | null;
  scoredAt: string | null;
  // Joined from clinical_cases
  age: number;
  gender: string;
  admissionDiagnosis: string;
}

export interface ReorderRequest {
  patientId: string;
  newPosition: number;
}

export interface StatusTransitionRequest {
  patientId: string;
  newStatus: PatientStatusEnum;
}

export interface FeedbackRequest {
  patientId: string;
  originalRank: number;
  adjustedRank: number;
  note?: string;
  adjustedBy: StaffRoleEnum;
}
