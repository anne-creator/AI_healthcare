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
import type { LabEntry } from "@/types";

interface WatchRightNowBlockProps {
  labs: LabEntry[];
}

export function WatchRightNowBlock({ labs }: WatchRightNowBlockProps) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Watch Right Now</CardTitle>
        <CardDescription>
          Recent lab results ({labs.length})
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="rounded-md border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Lab Test</TableHead>
                <TableHead>Category</TableHead>
                <TableHead className="text-right">Value</TableHead>
                <TableHead>Unit</TableHead>
                <TableHead>Time</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {labs.map((lab, i) => (
                <TableRow key={`${lab.labName}-${i}`}>
                  <TableCell className="font-medium">{lab.labName}</TableCell>
                  <TableCell className="text-xs text-muted-foreground">
                    {lab.category}
                  </TableCell>
                  <TableCell className="text-right font-mono">
                    {lab.value != null ? lab.value : "—"}
                  </TableCell>
                  <TableCell className="text-xs">{lab.unit ?? "—"}</TableCell>
                  <TableCell className="text-xs text-muted-foreground">
                    {new Date(lab.charttime).toLocaleString()}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
        <div className="mt-3">
          <DataSourceTag source="labs_subset + lab_dictionary" />
        </div>
      </CardContent>
    </Card>
  );
}
