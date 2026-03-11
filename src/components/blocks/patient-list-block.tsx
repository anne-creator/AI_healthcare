"use client";

import { useRouter } from "next/navigation";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { AlertBadge } from "@/components/custom/alert-badge";
import type { AlertLevel } from "@/types";

interface PatientRow {
  caseId: string;
  hadmId: number;
  age: number;
  gender: string;
  admissionDiagnosis: string;
  alertLevel: AlertLevel;
  labCount: number;
  prescriptionCount: number;
  diagnosisCount: number;
}

interface PatientListBlockProps {
  patients: PatientRow[];
  searchQuery: string;
  onSearchChange: (query: string) => void;
}

export function PatientListBlock({
  patients,
  searchQuery,
  onSearchChange,
}: PatientListBlockProps) {
  const router = useRouter();

  const filtered = patients.filter((p) =>
    p.admissionDiagnosis.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className="space-y-4">
      <input
        type="text"
        placeholder="Search by diagnosis..."
        value={searchQuery}
        onChange={(e) => onSearchChange(e.target.value)}
        className="w-full max-w-sm rounded-md border border-input bg-background px-3 py-2 text-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
      />
      <div className="overflow-x-auto rounded-md border">
        <Table className="min-w-[800px]">
          <TableHeader>
            <TableRow>
              <TableHead className="w-28">Case ID</TableHead>
              <TableHead>Diagnosis</TableHead>
              <TableHead className="w-24">Status</TableHead>
              <TableHead className="w-16">Age</TableHead>
              <TableHead className="w-20">Gender</TableHead>
              <TableHead className="w-16 text-right">Labs</TableHead>
              <TableHead className="w-16 text-right">Rx</TableHead>
              <TableHead className="w-16 text-right">Dx</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filtered.map((patient) => (
              <TableRow
                key={patient.hadmId}
                className="cursor-pointer hover:bg-muted/50"
                onClick={() => router.push(`/patients/${patient.hadmId}`)}
              >
                <TableCell className="font-mono text-sm">
                  {patient.caseId}
                </TableCell>
                <TableCell className="max-w-md truncate">
                  {patient.admissionDiagnosis}
                </TableCell>
                <TableCell>
                  <AlertBadge level={patient.alertLevel} />
                </TableCell>
                <TableCell>{patient.age}y</TableCell>
                <TableCell>{patient.gender}</TableCell>
                <TableCell className="text-right">{patient.labCount}</TableCell>
                <TableCell className="text-right">
                  {patient.prescriptionCount}
                </TableCell>
                <TableCell className="text-right">
                  {patient.diagnosisCount}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
      <p className="text-sm text-muted-foreground">
        Showing {filtered.length} of {patients.length} patients
      </p>
    </div>
  );
}
