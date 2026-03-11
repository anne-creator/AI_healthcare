import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { DataSourceTag } from "@/components/custom/data-source-tag";
import type { PrescriptionEntry } from "@/types";

interface WhatHasBeenTriedBlockProps {
  prescriptions: PrescriptionEntry[];
}

export function WhatHasBeenTriedBlock({
  prescriptions,
}: WhatHasBeenTriedBlockProps) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>What Has Been Tried</CardTitle>
        <CardDescription>
          Medications prescribed ({prescriptions.length})
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="rounded-md border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Drug</TableHead>
                <TableHead>Dose</TableHead>
                <TableHead>Route</TableHead>
                <TableHead>Start</TableHead>
                <TableHead>End</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {prescriptions.map((rx, i) => (
                <TableRow key={`${rx.drug}-${i}`}>
                  <TableCell className="font-medium">{rx.drug}</TableCell>
                  <TableCell>
                    {rx.doseValue != null
                      ? `${rx.doseValue} ${rx.doseUnit ?? ""}`
                      : "—"}
                  </TableCell>
                  <TableCell>{rx.route ?? "—"}</TableCell>
                  <TableCell className="text-xs">
                    {rx.startdate
                      ? new Date(rx.startdate).toLocaleDateString()
                      : "—"}
                  </TableCell>
                  <TableCell className="text-xs">
                    {rx.enddate
                      ? new Date(rx.enddate).toLocaleDateString()
                      : "—"}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
        <div className="mt-3">
          <DataSourceTag source="prescriptions_subset" />
        </div>
      </CardContent>
    </Card>
  );
}
