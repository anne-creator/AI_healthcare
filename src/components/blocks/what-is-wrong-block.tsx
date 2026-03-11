import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { DataSourceTag } from "@/components/custom/data-source-tag";
import type { DiagnosisEntry } from "@/types";

interface WhatIsWrongBlockProps {
  admissionDiagnosis: string;
  diagnoses: DiagnosisEntry[];
}

export function WhatIsWrongBlock({
  admissionDiagnosis,
  diagnoses,
}: WhatIsWrongBlockProps) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>What Is Wrong</CardTitle>
        <CardDescription>
          Admission diagnosis and ICD-9 codes
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div>
          <p className="text-sm font-medium">Primary Admission Diagnosis</p>
          <p className="mt-1 text-base">{admissionDiagnosis}</p>
          <div className="mt-2">
            <DataSourceTag source="clinical_cases" />
          </div>
        </div>
        {diagnoses.length > 0 && (
          <div>
            <p className="mb-2 text-sm font-medium">
              Diagnoses ({diagnoses.length})
            </p>
            <div className="space-y-1">
              {diagnoses.map((d, i) => (
                <div
                  key={`${d.icd9Code}-${i}`}
                  className="flex items-baseline gap-2 text-sm"
                >
                  <code className="shrink-0 text-xs text-muted-foreground">
                    {d.icd9Code}
                  </code>
                  <span>{d.longTitle}</span>
                </div>
              ))}
            </div>
            <div className="mt-2">
              <DataSourceTag source="diagnoses_subset + diagnosis_dictionary" />
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
